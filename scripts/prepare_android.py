"""Copy public web resources and literal prompts; never copy environment values."""
import ast
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / 'android/app/src/main/assets/web'
target.mkdir(parents=True, exist_ok=True)
for source in (root / 'static').iterdir():
    if source.is_file(): shutil.copyfile(source, target / source.name)
    elif source.name == 'vendor': shutil.copytree(source, target / source.name, dirs_exist_ok=True)
for source in (root / 'android/app/src/main/assets/bridge').iterdir():
    if source.is_file(): shutil.copyfile(source, target / source.name)
import sys
sys.path.insert(0, str(root / 'scripts'))
import orb_agsl  # noqa: E402  The native overlay bubble uses the same shader as the web bubble.
orb_agsl.write(target / 'orb.agsl')
index = (target / 'index.html').read_text()
index = index.replace('<script src="/capture.js" defer></script>', '<script src="/capture.js" defer></script>\n  <script src="/android.js" defer></script>\n  <link rel="stylesheet" href="/android.css">')
(target / 'index.html').write_text(index)
prompts = {}
for statement in ast.parse((root / 'server.py').read_text()).body:
    if isinstance(statement, ast.Assign):
        for name in statement.targets:
            if isinstance(name, ast.Name) and name.id in ('INSTRUCTIONS', 'QUICK_INSTRUCTIONS'):
                prompts[name.id.lower()] = ast.literal_eval(statement.value)
if set(prompts) != {'instructions', 'quick_instructions'}: raise RuntimeError('Instructions de vérification introuvables.')
(target / 'prompts.json').write_text(json.dumps(prompts, ensure_ascii=False))
print('Ressources Android préparées sans aucune valeur de clé API.')
