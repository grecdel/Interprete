"""Private, bundled Python service started and stopped by the desktop launcher."""
import json
import os
import sys
import threading
from http.server import ThreadingHTTPServer

from server import Handler, ROOT, structured_checks


def main():
    if '--self-test' in sys.argv:
        for name in ('index.html', 'app.js', 'archive.js', 'capture.js', 'style.css'):
            if not (ROOT / 'static' / name).is_file():
                raise RuntimeError('Ressource absente : ' + name)
        checks, _ = structured_checks('{"checks":[{"claim":"Test","verdict":"Confirmé"}]}', [], 'text')
        assert checks[0]['verdict'] == 'Informations insuffisantes'
        print(json.dumps({'ok': True, 'bundled_resources': True}))
        return
    if not os.environ.get('INTERPRETE_DESKTOP_TOKEN'):
        raise RuntimeError('Ce service doit être lancé par l’application Interprete.')
    service = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    # A closing parent pipe also shuts the service down if the launcher exits.
    def watch_parent():
        try:
            sys.stdin.buffer.read()
        finally:
            service.shutdown()
    threading.Thread(target=watch_parent, daemon=True).start()
    print(json.dumps({'ready': True, 'port': service.server_port}), flush=True)
    service.serve_forever()
    service.server_close()


if __name__ == '__main__':
    main()
