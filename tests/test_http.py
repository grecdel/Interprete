import http.client
import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest import mock

from server import Handler


class HttpLayerTests(unittest.TestCase):
    """The local service must refuse requests that do not come from this machine's own page."""

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.port = cls.server.server_port
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        connection.close()
        return response.status, data

    def test_page_served_on_loopback_host(self):
        status, data = self.request('GET', '/', headers={'Host': f'127.0.0.1:{self.port}'})
        self.assertEqual(status, 200)
        self.assertIn(b'<html', data.lower())

    def test_dns_rebinding_host_is_refused(self):
        host = f'evil.example:{self.port}'
        body = json.dumps({'text': 'Le budget a augmenté de 20 % depuis 2020.'})
        with mock.patch.dict(os.environ, {'INTERPRETE_API_KEY': 'fake-key-for-tests'}):
            status, _ = self.request('POST', '/api/verify', body=body,
                                     headers={'Host': host, 'Origin': 'http://' + host,
                                              'Content-Type': 'application/json'})
        self.assertEqual(status, 403)
        self.assertEqual(self.request('GET', '/api/status', headers={'Host': host})[0], 403)

    def test_cross_origin_post_is_refused(self):
        status, _ = self.request('POST', '/api/verify', body='{}',
                                 headers={'Host': f'127.0.0.1:{self.port}', 'Origin': 'https://evil.example',
                                          'Content-Type': 'application/json'})
        self.assertEqual(status, 403)

    def test_vendor_path_traversal_is_refused(self):
        status, _ = self.request('GET', '/vendor/../../server.py', headers={'Host': f'localhost:{self.port}'})
        self.assertEqual(status, 404)


if __name__ == '__main__':
    unittest.main()
