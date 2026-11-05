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
