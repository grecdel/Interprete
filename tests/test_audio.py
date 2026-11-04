import io
import json
import os
import unittest
from unittest.mock import patch

from server import transcribe


class AudioTests(unittest.TestCase):
    def test_audio_is_sent_in_memory_with_format_and_language(self):
        def opener(request, timeout):
            self.assertEqual(request.full_url, 'https://api.openai.com/v1/audio/transcriptions')
            self.assertEqual(request.get_header('Authorization'), 'Bearer not-a-real-api-key')
            self.assertIn(b'filename="extrait.webm"', request.data)
            self.assertIn(b'name="language"\r\n\r\nfr', request.data)
            self.assertIn(b'test-audio-bytes', request.data)
            self.assertEqual(timeout, 60)
            return io.BytesIO(json.dumps({'text': 'Les propos transcrits.'}).encode())
        with patch.dict(os.environ, {'INTERPRETE_API_KEY': 'not-a-real-api-key'}, clear=True):
            result = transcribe(b'test-audio-bytes', 'audio/webm;codecs=opus', opener)
        self.assertEqual(result, {'text': 'Les propos transcrits.'})

    def test_unconfigured_or_invalid_audio_is_rejected(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'réglages'):
                transcribe(b'audio', 'audio/webm')
        with patch.dict(os.environ, {'INTERPRETE_API_KEY': 'not-a-real-api-key'}, clear=True):
            for audio, kind in [(b'', 'audio/webm'), (b'audio', 'text/html'), (b'a' * (8 * 1024 * 1024 + 1), 'audio/webm')]:
                with self.subTest(kind=kind, length=len(audio)), self.assertRaises(ValueError):
                    transcribe(audio, kind)

    def test_unusable_transcription_is_reported(self):
        with patch.dict(os.environ, {'INTERPRETE_API_KEY': 'not-a-real-api-key'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'exploitable'):
                transcribe(b'audio', 'audio/ogg', lambda *args, **kwargs: io.BytesIO(b'{"text":null}'))
