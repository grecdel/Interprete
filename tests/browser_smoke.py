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


    def test_direct_osint_notice_can_be_kept_without_verifying_it(self):
        self.page.route('**/api/osint',lambda route:route.fulfill(json={'provider':'crossref','query':'budget','retrieved_at':'2026-01-01T12:00:00Z','results':[{'title':'Publication de test','url':'https://doi.org/10.1/test','description':'Métadonnées de démonstration','provider':'crossref'}]}))
        self.page.locator('.workspace-open').click()
        expect(self.page.locator('#evidence-files')).to_be_enabled()
        self.page.get_by_role('searchbox',name='Recherche OSINT directe').fill('budget')
        self.page.get_by_role('button',name='Interroger cette source').click()
        expect(self.page.get_by_role('link',name='Publication de test')).to_be_visible()
        self.page.get_by_role('button',name='Conserver cette notice dans le dossier').click()
        expect(self.page.locator('.evidence-list article')).to_have_count(1)
        self.assertEqual(self.requests,[])
        snapshot=self.page.evaluate('InterpreteArchive.snapshot()')
        self.assertEqual(snapshot['evidence'][0]['source'],'https://doi.org/10.1/test')
        self.assertIn('non_verifiee',snapshot['evidence'][0]['text'])

    def test_pdf_and_image_ocr_are_processed_locally(self):
        import base64
        objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
        stream=b'BT /F1 24 Tf 30 100 Td (Budget 120 millions) Tj ET'
        objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
        pdf=b'%PDF-1.4\n'; offsets=[0]
        for index,obj in enumerate(objects,1):
            offsets.append(len(pdf));pdf+=str(index).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
        xref=len(pdf);pdf+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])+b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+str(xref).encode()+b'\n%%EOF'
        self.page.locator('.workspace-open').click()
        expect(self.page.locator('#evidence-files')).to_be_enabled()
        self.page.locator('#evidence-files').set_input_files({'name':'document.pdf','mimeType':'application/pdf','buffer':pdf})
        card=self.page.locator('.evidence-list article').filter(has=self.page.get_by_role('heading',name='document.pdf',exact=True))
        card.get_by_role('button',name='Extraire le texte · PDF / OCR local').click()
        expect(card.locator('pre')).to_contain_text('Budget 120 millions',timeout=30000)
        png=self.page.evaluate("""() => {const c=document.createElement('canvas');c.width=900;c.height=160;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,900,160);x.fillStyle='black';x.font='bold 48px Arial';x.fillText('BUDGET 120 MILLIONS',30,95);return c.toDataURL('image/png').split(',')[1];}""")
        self.page.locator('#evidence-files').set_input_files({'name':'ocr.png','mimeType':'image/png','buffer':base64.b64decode(png)})
        card=self.page.locator('.evidence-list article').filter(has=self.page.get_by_role('heading',name='ocr.png',exact=True))
        card.get_by_role('button',name='Extraire le texte · PDF / OCR local').click()
        expect(card.locator('pre')).to_contain_text('120',timeout=60000)
        self.assertEqual(self.requests,[])


    def test_local_reading_tools_do_not_send_interview_content(self):
        self.page.locator('.analysis-tools summary').click()
        self.page.get_by_role('textbox',name='Texte à décrypter').fill('Un effet de base explique la désinflation.')
        self.page.get_by_role('button',name='Expliquer le jargon présent').click()
        expect(self.page.locator('.analysis-tools')).to_contain_text('Ralentissement de la hausse des prix')
        self.page.get_by_role('textbox',name='Valeur initiale',exact=True).fill('100')
        self.page.get_by_role('textbox',name='Valeur finale',exact=True).fill('120')
        self.page.get_by_role('button',name='Calculer la variation').click()
        expect(self.page.locator('.analysis-tools')).to_contain_text('20 %')
        self.page.get_by_role('textbox',name='Citation à retrouver').fill('Le budget augmente.')
        self.page.get_by_role('textbox',name='Document de comparaison').fill('Introduction. Le budget augmente. Conclusion.')
        self.page.get_by_role('button',name='Comparer les textes').click()
        expect(self.page.locator('.analysis-tools')).to_contain_text('Correspondance textuelle trouvée')
        self.assertEqual(self.requests,[])


    def test_audio_archive_links_all_segments_and_rejects_unsafe_paths(self):
        html=self.page.evaluate("""() => {
          const a=InterpreteArchive;
          const first={id:'clip_11111111-1111-1111-1111-111111111111',duration_ms:12000,captured_at:'2026-01-01T12:00:00Z',sha256:'test'};
          const second={...first,id:'clip_22222222-2222-2222-2222-222222222222'};
          a.session.audio.push(first,second,{...first,id:'../../private'});
          const identities=[a.recordTranscript('Premier fragment de la déclaration.',first),a.recordTranscript('Second fragment de la déclaration.',second)];
          const entry=a.createSubmission('Une déclaration répartie sur deux segments.','live',identities);
          a.completeSubmission(entry,{checks:[{claim:'Affirmation fictive',verdict:'Informations insuffisantes',summary:'Test',sources:[]}]});
          const snapshot=a.snapshot();snapshot.audio_directory='audio/';return a.htmlDocument(snapshot);
        }""")
        viewer=self.context.new_page();viewer.on('pageerror',lambda error:self.errors.append(str(error)))
        viewer.set_content(html)
        expect(viewer.locator('#transcript-list audio')).to_have_count(2)
        viewer.locator('#graph .node-quote').click()
        expect(viewer.locator('#map-selection audio')).to_have_count(2)
        sources=viewer.locator('audio').evaluate_all('(nodes)=>nodes.map(node=>node.getAttribute("src"))')
        self.assertTrue(all(source.startswith('audio/clip_') and '..' not in source for source in sources))
        viewer.close()


if __name__ == '__main__':
    unittest.main()
