"""Check public release files against the tested APK, without a private key."""
import argparse
import hashlib
import re
import subprocess
import zipfile
from pathlib import Path


def payload(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Entrées ZIP dupliquées.')
        # apksigner adds v1 signatures inside META-INF; v2/v3 live outside ZIP entries.
        signature = re.compile(r'^META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC))$', re.I)
        return {name: archive.read(name) for name in names if not signature.fullmatch(name)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--unsigned-dir', required=True, type=Path)
    parser.add_argument('--signed-dir', required=True, type=Path)
    args = parser.parse_args()
    version = '0.7.0'
    signed = args.signed_dir / f'Interprete-{version}-android.apk'
    unsigned = args.unsigned_dir / f'Interprete-{version}-unsigned.apk'
    if payload(signed) != payload(unsigned):
        raise SystemExit('Le contenu de l’APK signé diffère du build testé.')
    certificate = Path(__file__).resolve().parents[1] / 'android/signing-certificate.der'
    digest = hashlib.sha256(certificate.read_bytes()).hexdigest()
    verification = subprocess.run([
        'java', '-jar', str(args.unsigned_dir / 'apksigner.jar'), 'verify',
        '--verbose', '--print-certs', str(signed)
    ], check=True, capture_output=True, text=True).stdout
    if not re.search(r'certificate SHA-256 digest:\s*' + digest, verification, re.I):
        raise SystemExit('Certificat de signature inattendu.')
    expected = f'{hashlib.sha256(signed.read_bytes()).hexdigest()}  {signed.name}\n'
    if (args.signed_dir / 'SHA256SUMS').read_text() != expected:
        raise SystemExit('Empreinte SHA-256 incorrecte.')
    if (args.signed_dir / 'SIGNATURE.txt').read_text() != verification:
        raise SystemExit('Rapport de signature incorrect.')
    print('Signature, empreinte et contenu du build testé vérifiés.')


if __name__ == '__main__':
    main()
