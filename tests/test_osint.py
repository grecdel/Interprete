import io
import json
import unittest
from unittest.mock import Mock
import osint


class SearchTests(unittest.TestCase):
    def setUp(self):
        osint._CACHE.clear()

    def opener(self,payload):
        return Mock(return_value=io.BytesIO(json.dumps(payload).encode()))

    def test_crossref_is_fixed_endpoint_bounded_and_cached(self):
        opener=self.opener({'message':{'items':[{'title':['Étude'], 'URL':'https://doi.org/10.1/test','DOI':'10.1/test','publisher':'Institut'}]}})
        first=osint.search('crossref','climat & budget',opener)
        self.assertEqual(first['results'][0]['title'],'Étude')
        request=opener.call_args.args[0]
        self.assertTrue(request.full_url.startswith('https://api.crossref.org/works?rows=5&query='))
        self.assertNotIn('Authorization',request.headers)
        self.assertTrue(osint.search('crossref','climat & budget',opener)['cached'])
        self.assertEqual(opener.call_count,1)

    def test_dataset_and_company_results_are_not_verdicts(self):
        result=osint.search('data_gouv','budget',self.opener({'data':[{'title':'Budget','page':'https://www.data.gouv.fr/datasets/test','description':'<b>Document</b>'}]}))
        self.assertEqual(result['results'][0]['description'],' Document ')
        result=osint.search('entreprises','société',self.opener({'results':[{'siren':'123456789','nom_complet':'Test'},{'siren':'not-an-id'}]}))
        self.assertEqual(len(result['results']),1)
        self.assertNotIn('verdict',result['results'][0])

    def test_rejects_arbitrary_destination_and_unusable_urls(self):
        opener=self.opener({})
        for provider,query in [('http://localhost','test'),('crossref','a'),('crossref',None)]:
            with self.assertRaises(ValueError):osint.search(provider,query,opener)
        opener.assert_not_called()
        result=osint.search('crossref','query',self.opener({'message':{'items':[{'URL':'javascript:alert(1)'},{'URL':'https://user:secret@example.org'}]}}))
        self.assertEqual(result['results'],[])

    def test_additional_connectors_normalize_documentary_records(self):
        fixtures={
            'europe_pmc':({'resultList':{'result':[{'id':'123','source':'MED','title':'Study'}]}},'cancer'),
            'wikidata':({'search':[{'id':'Q42','label':'Example','description':'Entity'}]},'example'),
            'wayback':({'archived_snapshots':{'closest':{'available':True,'url':'http://web.archive.org/web/20200101000000/https://example.org','timestamp':'20200101000000'}}},'https://example.org'),
            'gdelt':({'articles':[{'title':'News','url':'https://example.org/news','seendate':'20260101'}]},'climat'),
            'openlibrary':({'docs':[{'key':'/works/OL123W','title':'Book','author_name':['Author']}]},'history'),
        }
        for provider,(payload,query) in fixtures.items():
            with self.subTest(provider=provider):
                opener=self.opener(payload);result=osint.search(provider,query,opener)
                self.assertEqual(len(result['results']),1)
                self.assertTrue(result['results'][0]['url'].startswith('https://'))
                self.assertNotIn('Authorization',opener.call_args.args[0].headers)

    def test_private_urls_and_redirects_are_rejected(self):
        for url in ['https://localhost','https://127.0.0.1','https://192.168.1.1','https://user:secret@example.org','https://example.org:8443']:
            self.assertFalse(osint.public_url(url))
            with self.assertRaises(ValueError):osint.search('wayback',url,self.opener({}))
        with self.assertRaises(ValueError):osint.NoRedirect().redirect_request(None,None,302,'Found',{},'http://127.0.0.1')

    def test_ambiguous_numeric_hosts_are_not_public(self):
        for url in ['https://127.1','https://0177.0.0.1','https://0.0.0.0','https://10.0.0.1']:
            self.assertFalse(osint.public_url(url))

    def test_malformed_provider_data_fails_closed(self):
        for payload in [[],{'message':{'items':{}}}]:
            with self.assertRaises(ValueError):osint.search('crossref','query',self.opener(payload))
