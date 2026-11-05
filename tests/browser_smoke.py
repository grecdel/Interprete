"""Browser integration checks, using simulated search and microphone responses.

Run: python3 -m unittest discover -s tests -p browser_smoke.py -v
Requires Playwright and Chromium. No API key or paid request is used.
"""
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from playwright.sync_api import expect, sync_playwright
from server import Handler

FAKE_MIC = """
class SimulatedRecognition {
  start() { queueMicrotask(() => this.onstart?.()); }
  stop() { queueMicrotask(() => this.onend?.()); }
  emit(text) {
    const result = [{transcript: text}]; result.isFinal = true;
    this.onresult?.({resultIndex: 0, results: [result]});
  }
}
window.SpeechRecognition = class extends SimulatedRecognition {
  constructor() { super(); window.testMicrophone = this; }
};
"""


def fixture():
    return {'analysis': '', 'has_sources': True, 'sources': [], 'checks': [{
        'claim': 'Une affirmation de test sur un budget.', 'verdict': 'À nuancer',
        'summary': 'Le périmètre et la date doivent être précisés.',
        'reasoning': 'Comparer les mêmes périodes et les mêmes périmètres.',
        'evidence': ['Vérifier la période de référence.'],
        'sources': [{'url': 'https://www.insee.fr/fr/statistiques', 'title': 'Document de test INSEE'}],
        'follow_up': 'De quelle période et de quel périmètre parlez-vous ?',
        'limitations': ['Un seul site cité : recoupement à compléter.'],
        'connections': []
    }]}


class BrowserChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox', '--window-size=1440,960'])
        cls.artifacts = tempfile.TemporaryDirectory(prefix='interprete-browser-')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.artifacts.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
        self.context.add_init_script(FAKE_MIC)
        self.page = self.context.new_page()
        self.errors, self.requests = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.route('**/api/status', lambda route: route.fulfill(json={'configured': True}))
        self.page.route('**/api/verify', self.respond)
        self.page.goto(self.base)
        expect(self.page.locator('#configuration')).to_be_hidden()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def respond(self, route):
        self.requests.append(route.request.post_data_json)
        response = fixture()
        context = self.requests[-1].get('context', [])
        if context:
            response['checks'][0]['connections'] = [{'target_id': context[-1]['id'], 'relation': 'contradiction_potentielle', 'explanation': 'Dates et périmètres à contrôler avant de conclure à une contradiction.'}]
        route.fulfill(json=response)

    def submit(self, text):
        self.page.locator('#transcript').fill(text)
        self.page.locator('#verify').click()
        expect(self.page.locator('.result-card').last).to_be_visible()
        expect(self.page.locator('.searching')).to_have_count(0)

    def test_sidebar_is_a_quarter_and_mobile_composer_is_visible(self):
        box = self.page.locator('#assistant-panel').bounding_box()
        self.assertEqual(box['width'], 360)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.set_viewport_size({'width': 390, 'height': 844})
        expect(self.page.locator('#transcript')).to_be_in_viewport()
        expect(self.page.locator('#bubble')).to_be_in_viewport()
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))

    def test_text_article_and_link_keep_sources_and_follow_up(self):
        article = 'Article de test sur un budget. ' * 250
        self.submit(article)
        self.assertEqual(self.requests[0]['transcript'], article.strip())
        expect(self.page.locator('.follow-up')).to_contain_text('De quelle période')
        expect(self.page.locator('.source-link').first).to_have_attribute('href', 'https://www.insee.fr/fr/statistiques')
        self.assertEqual(self.page.locator('#transcript').input_value(), '')
        self.submit('https://example.com/article')
        self.assertEqual(self.requests[1]['transcript'], 'https://example.com/article')
        expect(self.page.locator('.entry-meta').first).to_contain_text('Lien partagé')
        expect(self.page.locator('.connection-note')).to_contain_text('Incohérence à examiner')
        self.assertEqual(len(self.requests[1]['context']), 1)

    def test_bubble_starts_microphone_and_only_new_speech_is_verified(self):
        self.page.clock.install()
        self.page.locator('#collapse').click()
        expect(self.page.locator('#assistant-panel')).to_be_hidden()
        self.page.locator('#bubble').click()
        expect(self.page.locator('#microphone')).to_have_attribute('aria-pressed', 'true')
        self.page.evaluate("testMicrophone.emit('Le budget annoncé a augmenté pendant cette période.')")
        self.page.clock.fast_forward(3000)
        expect(self.page.locator('.result-card')).to_have_count(1)
        self.page.evaluate("testMicrophone.emit('Le périmètre du budget est pourtant resté le même.')")
        self.page.clock.fast_forward(21000)
        expect(self.page.locator('.result-card')).to_have_count(2)
        self.assertEqual(self.requests[1]['transcript'], 'Le périmètre du budget est pourtant resté le même.')
        snapshot = self.page.evaluate('InterpreteArchive.snapshot()')
        self.assertEqual(len(snapshot['transcript']), 2)
        self.assertEqual(snapshot['submissions'][0]['transcript_ids'], [snapshot['transcript'][0]['id']])
        self.page.locator('#collapse').click()
        expect(self.page.locator('#microphone')).to_have_attribute('aria-pressed', 'false')

    def test_html_archive_offline_map_and_json_import(self):
        self.submit('Un premier propos de test sur le budget annoncé.')
        self.submit('Un second propos de test sur le budget annoncé.')
        self.page.locator('#archive-button').click()
        with self.page.expect_download() as download:
            self.page.locator('#export-json').click()
        json_path = Path(self.artifacts.name) / 'session.json'
        download.value.save_as(json_path)
        saved = json.loads(json_path.read_text())
        self.assertEqual(len(saved['submissions']), 2)
        self.assertEqual(saved['submissions'][1]['checks'][0]['connections'][0]['target_id'], saved['submissions'][0]['checks'][0]['id'])
        with self.page.expect_download() as download:
            self.page.locator('#export-html').click()
        html_path = Path(self.artifacts.name) / 'session.html'
        download.value.save_as(html_path)
        viewer = self.context.new_page()
        viewer.on('pageerror', lambda error: self.errors.append(str(error)))
        # Managed Chromium blocks file:// navigation. Render the downloaded,
        # self-contained document directly, without changing browser policy.
        viewer.set_content(html_path.read_text())
        expect(viewer.locator('#verification-list .claim')).to_have_count(2)
        expect(viewer.locator('#graph .map-node')).to_have_count(5)
        viewer.locator('#map-conflicts').click()
        expect(viewer.locator('#map-conflicts')).to_have_attribute('aria-pressed', 'true')
        viewer.locator('#graph .map-node').nth(1).click()
        expect(viewer.locator('#map-selection')).not_to_be_empty()
        viewer.locator('#map-theme').select_option('investigation')
        expect(viewer.locator('html')).to_have_attribute('data-board', 'investigation')
        viewer.locator('#map-all').click()
        viewer.locator('#map-search').fill('aucun resultat totalement absent')
        expect(viewer.locator('#map-search-status')).to_contain_text('0 élément')
        viewer.locator('#map-search').fill('')
        viewer.locator('#map-import').set_input_files({'name':'note-externe.txt','mimeType':'text/plain','buffer':'Énergie : élément externe'.encode()})
        expect(viewer.locator('#graph .map-node')).to_have_count(6)
        viewer.locator('#map-search').fill('energie')
        expect(viewer.locator('#map-search-status')).to_contain_text('1 élément')
        viewer.locator('#map-search').fill('')
        import base64
        pixel = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=')
        viewer.locator('#graph .node-claim').first.click()
        viewer.locator('#map-import').set_input_files({'name':'photo.png','mimeType':'image/png','buffer':pixel})
        expect(viewer.locator('#graph .has-photo image')).to_have_count(1)
        expect(viewer.locator('#graph > path > title').filter(has_text='Pièce associée par l’utilisateur')).to_have_count(1)
        viewer.locator('#map-music').click()
        expect(viewer.locator('#map-music')).to_have_attribute('aria-pressed', 'true')
        viewer.locator('#map-theme').select_option('classic')
        expect(viewer.locator('#map-music')).to_have_attribute('aria-pressed', 'false')
        viewer.locator('#map-theme').select_option('investigation')
        viewer.locator('#mindmap').screenshot(path='/tmp/interprete-investigation-board.png')
        viewer.close()
        # Import into a new session, then ensure context reaches the next search.
        self.page.reload()
        self.page.locator('#archive-button').click()
        self.page.locator('#import-archive').set_input_files(json_path)
        expect(self.page.locator('#archive-status')).to_contain_text('2 propos importés')
        self.page.keyboard.press('Escape')
        self.submit('Un nouveau propos à comparer au budget de la session passée.')
        self.assertEqual(len(self.requests[-1]['context']), 2)
        expect(self.page.locator('.connection-note')).to_contain_text('Incohérence à examiner')

    def test_transcript_export_is_complete_and_html_is_not_executed(self):
        unsafe = 'Un propos de test </script><script>window.INJECTED=true</script>.'
        self.page.locator('#bubble').click()
        self.page.evaluate('(text) => testMicrophone.emit(text)', unsafe)
        self.page.locator('#microphone').click()
        self.page.locator('#archive-button').click()
        with self.page.expect_download() as download:
            self.page.locator('#export-html').click()
        path = Path(self.artifacts.name) / 'safe.html'
        download.value.save_as(path)
        viewer = self.context.new_page()
        viewer.on('pageerror', lambda error: self.errors.append(str(error)))
        viewer.set_content(path.read_text())
        self.assertIsNone(viewer.evaluate('window.INJECTED'))
        expect(viewer.locator('#transcript-list')).to_contain_text(unsafe)
        viewer.close()

    def test_service_failure_can_be_retried_and_keeps_original_text(self):
        self.page.unroute('**/api/verify')
        self.page.route('**/api/verify', lambda route: route.fulfill(status=502, json={'error': 'Service indisponible.'}))
        self.page.locator('#transcript').fill('Une phrase à vérifier pendant une panne du service.')
        self.page.locator('#verify').click()
        expect(self.page.locator('.failed-search')).to_contain_text('Service indisponible.')
        self.assertIn('Une phrase', self.page.locator('#transcript').input_value())
        self.page.unroute('**/api/verify')
        self.page.route('**/api/verify', self.respond)
        self.page.locator('.retry-button').click()
        expect(self.page.locator('.failed-search')).to_have_count(0)
        expect(self.page.locator('.follow-up')).to_be_visible()

    def test_missing_key_keeps_text_and_does_not_invent_results(self):
        self.page.unroute('**/api/status')
        self.page.route('**/api/status', lambda route: route.fulfill(json={'configured': False}))
        self.page.reload()
        expect(self.page.locator('#configuration')).to_be_visible()
        self.page.locator('#transcript').fill('Une affirmation qui attend une configuration du service.')
        self.page.locator('#verify').click()
        expect(self.page.locator('#error')).to_contain_text('clé API')
        expect(self.page.locator('.result-card')).to_have_count(0)
        self.assertEqual(self.requests, [])

    def test_microphone_permission_failure_is_visible_and_stops_listening(self):
        self.page.locator('#bubble').click()
        self.page.evaluate("testMicrophone.onerror({error: 'not-allowed'})")
        expect(self.page.locator('#error')).to_contain_text('micro n’a pas été autorisé')
        expect(self.page.locator('#microphone')).to_have_attribute('aria-pressed', 'false')

    def test_floating_window_keeps_state_and_returns_to_tab(self):
        if not self.page.evaluate('Boolean(window.documentPictureInPicture)'):
            self.skipTest('Document Picture-in-Picture absent dans ce Chromium')
        self.page.locator('#transcript').fill('Un brouillon conservé pendant le détachement du volet.')
        self.page.locator('#detach').click()
        expect(self.page.locator('#companion')).to_have_count(0)
        self.assertTrue(self.page.evaluate('documentPictureInPicture.window.document.querySelector("#companion") !== null'))
        self.assertEqual(self.page.evaluate('documentPictureInPicture.window.document.querySelector("#transcript").value'), 'Un brouillon conservé pendant le détachement du volet.')
        self.page.evaluate('documentPictureInPicture.window.close()')
        expect(self.page.locator('#companion')).to_have_count(1)
        self.assertIn('Un brouillon conservé', self.page.locator('#transcript').input_value())

    def test_http_accepts_article_and_rejects_invalid_input(self):
        def request(payload):
            return urllib.request.Request(self.base + '/api/verify', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
        with patch('server.verify', return_value=fixture()) as verify:
            with urllib.request.urlopen(request({'transcript': 'Un article. ' * 1000, 'kind': 'live', 'context': []})) as response:
                self.assertEqual(response.status, 200)
                self.assertTrue(json.load(response)['has_sources'])
            self.assertEqual(verify.call_args.kwargs['kind'], 'live')
        for value in ['court', 'a' * 20001, 12]:
            with self.subTest(value_type=type(value).__name__):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(request({'transcript': value}))
                self.assertEqual(error.exception.code, 400)


    def test_local_evidence_is_searchable_deduplicated_and_exported_without_binary(self):
        import hashlib
        self.page.locator('.workspace-open').click()
        expect(self.page.locator('#evidence-files')).to_be_enabled()
        payload = b'Le budget de reference est de 120 millions.'
        self.page.locator('#evidence-files').set_input_files({'name': 'budget.txt', 'mimeType': 'text/plain', 'buffer': payload})
        expect(self.page.locator('.evidence-list article')).to_have_count(1)
        expect(self.page.locator('.evidence-list article')).to_contain_text(hashlib.sha256(payload).hexdigest())
        self.page.locator('#evidence-files').set_input_files({'name': 'copie.txt', 'mimeType': 'text/plain', 'buffer': payload})
        expect(self.page.locator('.investigation [role=status]')).to_contain_text('déjà présent')
        self.assertEqual(self.page.locator('.evidence-list article').count(), 1)
        self.page.locator('.evidence-list textarea').fill('Passage à vérifier : 120 millions.')
        self.page.get_by_role('button', name='Conserver les annotations').click()
        expect(self.page.locator('.investigation [role=status]')).to_contain_text('Annotations conservées')
        snapshot = self.page.evaluate('InterpreteArchive.snapshot()')
        self.assertNotIn('blob', snapshot['evidence'][0])
        self.assertEqual(snapshot['evidence'][0]['notes'], 'Passage à vérifier : 120 millions.')
        self.assertEqual(self.requests, [])
        with self.page.expect_download() as download:
            self.page.get_by_role('button', name='Exporter la pièce et ses annotations (JSON)').click()
        packed = json.loads(Path(download.value.path()).read_text())
        import base64
        self.assertEqual(base64.b64decode(packed['original_base64']), payload)
        self.assertEqual(packed['metadata']['notes'], 'Passage à vérifier : 120 millions.')
        packed['metadata']['sha256'] = '0' * 64
        self.page.locator('#evidence-files').set_input_files({'name':'falsifie.json','mimeType':'application/json','buffer':json.dumps(packed).encode()})
        expect(self.page.locator('.investigation [role=status]')).to_contain_text('empreinte')
        self.assertEqual(self.page.locator('.evidence-list article').count(), 1)
        self.page.get_by_role('button', name='Préparer une vérification').click()
        expect(self.page.locator('#transcript')).to_have_value('Passage à vérifier : 120 millions.')
        self.assertEqual(self.requests, [])
        self.page.reload()
        self.page.locator('.workspace-open').click()
        expect(self.page.locator('.evidence-list article')).to_have_count(1)
        expect(self.page.locator('.evidence-list textarea')).to_have_value('Passage à vérifier : 120 millions.')


if __name__ == '__main__':
    unittest.main()
