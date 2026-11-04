"""Build on the target OS: PyInstaller does not cross-compile Python."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
subprocess.run([
    sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile',
    '--name', 'interprete-backend', '--distpath', str(root / 'build' / 'backend'),
    '--workpath', str(root / 'build' / 'pyinstaller'), '--specpath', str(root / 'build'),
    '--add-data', str(root / 'static') + ':static', str(root / 'desktop_backend.py'),
], cwd=root, check=True)
binary = root / 'build' / 'backend' / ('interprete-backend.exe' if sys.platform == 'win32' else 'interprete-backend')
subprocess.run([str(binary), '--self-test'], check=True)
