"""Sign a tested Android APK locally. Private signing files never enter Git or CI."""
import argparse
import hashlib
import re
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--input-dir', required=True, type=Path)
parser.add_argument('--output-dir', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
private = root / '.android-signing'
store, password = private / 'release.p12', private / 'password.txt'
if not store.is_file() or not password.is_file():
    raise SystemExit('L’identité privée de signature est absente. Ne générez pas une autre identité pour une mise à jour existante.')
with tempfile.TemporaryDirectory(prefix='interprete-certificate-') as folder:
    certificate = Path(folder) / 'certificate.der'
    subprocess.run(['keytool', '-exportcert', '-alias', 'interprete-release', '-keystore', str(store), '-storepass:file', str(password), '-file', str(certificate)], check=True, capture_output=True)
    if certificate.read_bytes() != (root / 'android/signing-certificate.der').read_bytes():
        raise SystemExit('L’identité privée ne correspond pas au certificat public du projet.')
version = '0.3.0'
args.output_dir.mkdir(parents=True, exist_ok=True)
output = args.output_dir / f'Interprete-{version}-android.apk'
jar = args.input_dir / 'apksigner.jar'
source = args.input_dir / f'Interprete-{version}-unsigned.apk'
subprocess.run(['java', '-jar', str(jar), 'sign', '--ks', str(store), '--ks-key-alias', 'interprete-release', '--ks-pass', 'file:' + str(password), '--key-pass', 'file:' + str(password), '--min-sdk-version', '26', '--v4-signing-enabled', 'false', '--out', str(output), str(source)], check=True)
verification = subprocess.run(['java', '-jar', str(jar), 'verify', '--verbose', '--print-certs', str(output)], check=True, capture_output=True, text=True).stdout
fingerprint = hashlib.sha256((root / 'android/signing-certificate.der').read_bytes()).hexdigest()
if not re.search(r'certificate SHA-256 digest:\s*' + fingerprint, verification, re.I):
    raise SystemExit('Le certificat de l’APK ne correspond pas à celui attendu.')
(args.output_dir / 'SIGNATURE.txt').write_text(verification)
(args.output_dir / 'SHA256SUMS').write_text(f'{hashlib.sha256(output.read_bytes()).hexdigest()}  {output.name}\n')
print('APK signé et vérifié :', output)
print('Certificat SHA-256 :', fingerprint)
