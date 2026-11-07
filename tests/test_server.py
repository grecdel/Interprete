import io
import json
import os
import unittest
from unittest.mock import patch

from server import input_kind, normalize_context, public_url, structured_checks, verify


class VerificationTests(unittest.TestCase):
    def test_missing_key(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'INTERPRETE_API_KEY'):
                verify('Une affirmation à vérifier.')

    def test_cloud_secret_name_is_supported(self):
        def opener(request, timeout):
            self.assertEqual(request.get_header('Authorization'), 'Bearer test-cloud-only')
            response = {'status': 'completed', 'output': [{'type': 'message', 'content': [
                {'type': 'output_text', 'text': '{"checks":[],"message":"Aucune affirmation."}', 'annotations': []}]}]}
            return io.BytesIO(json.dumps(response).encode())
        with patch.dict(os.environ, {'INTERPRETE_API_KEY': 'test-cloud-only'}, clear=True):
            self.assertEqual(verify('Une phrase à analyser.', opener)['analysis'], 'Aucune affirmation.')

    def test_search_required_and_citations_deduplicated(self):
        citation = {'type': 'url_citation', 'url': 'https://www.insee.fr/fr/statistiques', 'title': 'INSEE'}
        response = {'status': 'completed', 'output': [{'type': 'message', 'content': [
            {'type': 'output_text', 'text': json.dumps({'checks': [{'claim': 'Données datées.', 'verdict': 'À nuancer', 'source_urls': [citation['url']]}]}), 'annotations': [citation, citation,
                {'type': 'url_citation', 'url': 'javascript:alert(1)'}]}]}]}
        def opener(request, timeout):
            payload = json.loads(request.data)
            self.assertEqual(payload['tool_choice'], 'required')
            self.assertFalse(payload['store'])
            self.assertEqual(json.loads(payload['input'])['type_contenu'], 'text')
            self.assertEqual(timeout, 90)
            return io.BytesIO(json.dumps(response).encode())
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            result = verify('La population a augmenté.', opener)
        self.assertEqual(len(result['sources']), 1)
        self.assertTrue(result['has_sources'])

    def test_retrieved_pages_count_without_citation_annotations(self):
        url = 'https://www.insee.fr/fr/statistiques'
        response = {'status': 'completed', 'output': [
            {'type': 'web_search_call', 'status': 'completed', 'action': {'sources': [
                {'type': 'url', 'url': url, 'title': 'INSEE'}, {'type': 'url', 'url': 'http://127.0.0.1/'}]}},
            {'type': 'message', 'content': [{'type': 'output_text', 'annotations': [], 'text': json.dumps(
                {'checks': [{'claim': 'Une affirmation', 'verdict': 'À nuancer', 'source_urls': [url, 'https://inventee.example/']}]})}]}]}
        def opener(request, timeout):
            payload = json.loads(request.data)
            self.assertEqual(payload['tools'], [{'type': 'web_search'}])
            self.assertIn('web_search_call.action.sources', payload['include'])
            return io.BytesIO(json.dumps(response).encode())
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            result = verify('Une affirmation à vérifier.', opener)
        self.assertEqual([source['url'] for source in result['sources']], [url])
        check = result['checks'][0]
        self.assertEqual(check['verdict'], 'À nuancer')
        self.assertEqual(check['limitations'][0], 'Un seul site cité : le recoupement reste à compléter.')

    def test_no_citations_is_explicit(self):
        response = {'status': 'completed', 'output': [{'type': 'message', 'content': [
            {'type': 'output_text', 'text': json.dumps({'checks': [{'claim': 'Une affirmation.', 'verdict': 'Informations insuffisantes', 'source_urls': []}]}), 'annotations': []}]}]}
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            result = verify('Une affirmation à vérifier.', lambda *a, **k: io.BytesIO(json.dumps(response).encode()))
        self.assertFalse(result['has_sources'])

    def test_incomplete_response_rejected(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            with self.assertRaisesRegex(ValueError, 'incomplète'):
                verify('Une affirmation à vérifier.', lambda *a, **k: io.BytesIO(b'{"status":"incomplete"}'))

    def test_checks_associate_only_annotated_sources(self):
        sources = [{'url': 'https://www.insee.fr/fr/statistiques?utm_source=web', 'title': 'INSEE'}]
        text = json.dumps({'checks': [{'claim': 'Une affirmation', 'verdict': 'À nuancer',
            'summary': 'Le périmètre est différent.', 'reasoning': 'La date compte.',
            'evidence': ['La série porte sur 2024.'],
            'source_urls': ['https://www.insee.fr/fr/statistiques', 'https://source-inventee.fr']}],
            'input_accessible': True})
        checks, _ = structured_checks(text, sources, 'text')
        self.assertEqual(checks[0]['sources'], sources)
        self.assertEqual(checks[0]['verdict'], 'À nuancer')
        self.assertEqual(checks[0]['evidence'], ['La série porte sur 2024.'])

    def test_unsourced_confirmation_is_downgraded(self):
        text = json.dumps({'checks': [{'claim': 'Une affirmation', 'verdict': 'Confirmé',
            'summary': 'Vrai.', 'source_urls': ['https://source-inventee.fr'], 'evidence': ['Un chiffre sans source.']}]})
        checks, _ = structured_checks(text, [], 'text')
        self.assertEqual(checks[0]['verdict'], 'Informations insuffisantes')
        self.assertIn('sans vérification', checks[0]['summary'])
        self.assertEqual(checks[0]['evidence'], [])

    def test_unreadable_article_does_not_produce_a_verdict(self):
        text = json.dumps({'input_accessible': False, 'checks': [{'claim': 'Un titre sans article', 'verdict': 'Confirmé'}]})
        checks, _ = structured_checks(text, [], 'url')
        self.assertEqual(checks[0]['verdict'], 'Informations insuffisantes')
        self.assertIn('Collez son texte', checks[0]['summary'])

    def test_public_links_and_article_detection(self):
        self.assertEqual(input_kind('https://www.insee.fr/fr/statistiques'), 'url')
        self.assertEqual(input_kind('Un article qui contient https://example.com et des explications.'), 'text')
        self.assertEqual(input_kind('https://example.com', 'live'), 'live')
        for url in ['http://127.0.0.1/test', 'http://[::1]/test', 'http://localhost/x',
                    'https://user:secret@example.com', 'https://192.168.1.1',
                    'javascript:alert(1)', 'https://example.com:8080/x']:
            with self.subTest(url=url):
                self.assertIsNone(public_url(url))
        with self.assertRaises(ValueError):
            input_kind('http://localhost/secrets')

    def test_url_is_given_to_search_without_local_page_fetch(self):
        def opener(request, timeout):
            self.assertEqual(request.full_url, 'https://api.openai.com/v1/responses')
            self.assertEqual(json.loads(json.loads(request.data)['input']), {
                'type_contenu': 'url', 'contenu_a_verifier': 'https://example.com/article', 'propos_anterieurs': []})
            response = {'status': 'completed', 'output': [{'type': 'message', 'content': [
                {'type': 'output_text', 'text': json.dumps({'input_accessible': False, 'checks': []}), 'annotations': []}]}]}
            return io.BytesIO(json.dumps(response).encode())
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            self.assertEqual(verify('https://example.com/article', opener)['input_type'], 'url')

    def test_malformed_model_structure_does_not_crash(self):
        checks, message = structured_checks('{"checks":42,"message":"Aucune affirmation."}', [], 'text')
        self.assertEqual(checks, [])
        self.assertEqual(message, 'Aucune affirmation.')

    def test_connections_cannot_invent_past_statements(self):
        context = normalize_context([{'id': 'past_1', 'claim': 'Le budget a baissé.'}])
        text = json.dumps({'checks': [{'claim': 'Le budget a augmenté.', 'verdict': 'Informations insuffisantes',
            'connections': [
                {'target_id': 'past_1', 'relation': 'contradiction_potentielle', 'explanation': 'Le périmètre est à préciser.'},
                {'target_id': 'invented', 'relation': 'contradiction_potentielle', 'explanation': 'Un propos inventé.'}]}]})
        checks, _ = structured_checks(text, [], 'live', context)
        self.assertEqual(len(checks[0]['connections']), 1)
        self.assertEqual(checks[0]['connections'][0]['target_id'], 'past_1')
        self.assertTrue(checks[0]['review_required'])
        self.assertIn('préciser la source', checks[0]['follow_up'])

    def test_context_is_bounded_and_duplicate_ids_removed(self):
        context = normalize_context([{'id': 'past_1', 'claim': 'a' * 5000}, {'id': 'past_1', 'claim': 'doublon'},
                                     {'id': '<script>', 'claim': 'non valide'}, {'id': 'past_2', 'claim': 12}])
        self.assertEqual(len(context), 1)
        self.assertEqual(len(context[0]['claim']), 600)

    def test_proposed_excerpt_is_never_marked_as_verified(self):
        sources = [{'url': 'https://www.insee.fr/fr/statistiques', 'title': 'INSEE'}]
        text = json.dumps({'checks': [{'claim': 'Une affirmation', 'verdict': 'À nuancer',
            'source_urls': [sources[0]['url']], 'follow_up': 'Pouvez-vous préciser le périmètre ?',
            'source_excerpts': [{'url': sources[0]['url'], 'quote': 'Extrait proposé par le modèle.', 'published_at': 'date inconnue'},
                {'url': 'https://source-inventee.fr', 'quote': 'Un faux extrait.'}]}]})
        checks, _ = structured_checks(text, sources, 'text')
        self.assertEqual(len(checks[0]['source_excerpts']), 1)
        self.assertFalse(checks[0]['source_excerpts'][0]['verified_against_document'])
        self.assertEqual(checks[0]['source_excerpts'][0]['published_at'], '')
        self.assertIn('recoupement', checks[0]['limitations'][0])

    def test_unstructured_response_cannot_become_an_authoritative_card(self):
        with self.assertRaisesRegex(ValueError, 'format inexploitable'):
            structured_checks('Une réponse libre qui prétend être certaine.', [], 'live')


if __name__ == '__main__':
    unittest.main()


class Version07Tests(unittest.TestCase):
    """F3 preparation context, F4 quick follow-up, F6 common origin."""

    def test_common_origin_is_reported_only_with_several_sources(self):
        sources = [{'url': 'https://www.lemonde.fr/a', 'title': 'Le Monde'}, {'url': 'https://www.lefigaro.fr/b', 'title': 'Le Figaro'}]
        origin = {'detected': True, 'explanation': 'Les deux articles reprennent la même dépêche AFP.'}
        text = json.dumps({'checks': [{'claim': 'Une affirmation', 'verdict': 'À nuancer', 'common_origin': origin,
                                       'source_urls': [s['url'] for s in sources]}]})
        check = structured_checks(text, sources, 'text')[0][0]
        self.assertEqual(check['common_origin'], 'Les deux articles reprennent la même dépêche AFP.')
        self.assertTrue(check['limitations'][0].startswith('Origine commune probable'))
        single = json.dumps({'checks': [{'claim': 'Une affirmation', 'verdict': 'À nuancer', 'common_origin': origin,
                                         'source_urls': [sources[0]['url']]}]})
        self.assertNotIn('common_origin', structured_checks(single, sources, 'text')[0][0])

    def test_preparation_is_bounded_and_sent_as_context(self):
        from server import normalize_preparation
        value = normalize_preparation({'interlocuteur': 'A' * 500, 'sujet': 'Budget 2026', 'ignored': 'x',
                                       'pieces': [{'nom': 'Budget.pdf', 'extrait': 'B' * 5000}] * 5})
        self.assertEqual(len(value['interlocuteur']), 200)
        self.assertEqual(len(value['pieces']), 3)
        self.assertEqual(len(value['pieces'][0]['extrait']), 1500)
        self.assertNotIn('ignored', value)
        self.assertEqual(normalize_preparation('pas un objet'), {})
        response = {'status': 'completed', 'output': [{'type': 'message', 'content': [
            {'type': 'output_text', 'annotations': [], 'text': json.dumps({'checks': []})}]}]}
        def opener(request, timeout):
            payload = json.loads(json.loads(request.data)['input'])
            self.assertEqual(payload['dossier_preparatoire']['sujet'], 'Budget 2026')
            return io.BytesIO(json.dumps(response).encode())
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            verify('Le budget a augmenté de 20 %.', opener, preparation={'sujet': 'Budget 2026'})

    def test_quick_follow_up_has_no_search_and_no_verdict(self):
        from server import verify_quick
        answer = {'checks': [{'claim': 'Le budget a augmenté de 20 %', 'follow_up': 'Sur quelle période ?', 'why': 'La période.'},
                             {'claim': 'Sans relance'}, {'claim': 'Trois', 'follow_up': 'Q ?'}, {'claim': 'Quatre', 'follow_up': 'Q ?'}]}
        response = {'status': 'completed', 'output': [{'type': 'message', 'content': [
            {'type': 'output_text', 'text': json.dumps(answer)}]}]}
        def opener(request, timeout):
            payload = json.loads(request.data)
            self.assertNotIn('tools', payload)
            self.assertLessEqual(payload['max_output_tokens'], 700)
            self.assertEqual(timeout, 30)
            return io.BytesIO(json.dumps(response).encode())
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            result = verify_quick('Le budget a augmenté de 20 % depuis 2020.', opener)
        self.assertTrue(result['provisional'])
        self.assertEqual(len(result['checks']), 2)
        self.assertEqual(result['checks'][0]['verdict'], 'Piste provisoire')
        self.assertEqual(result['checks'][0]['sources'], [])
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
            self.assertEqual(verify_quick('https://www.example.org/article', lambda *a, **k: self.fail('no call'))['checks'], [])
