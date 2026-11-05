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
for source in (root / 'android/app/src/main/assets/bridge').iterdir():
    if source.is_file(): shutil.copyfile(source, target / source.name)
index = (target / 'index.html').read_text()
index = index.replace('<script src="/capture.js" defer></script>', '<script src="/capture.js" defer></script>\n  <script src="/android.js" defer></script>\n  <link rel="stylesheet" href="/android.css">')
(target / 'index.html').write_text(index)
for statement in ast.parse((root / 'server.py').read_text()).body:
    if isinstance(statement, ast.Assign) and any(isinstance(name, ast.Name) and name.id == 'INSTRUCTIONS' for name in statement.targets):
        instructions = ast.literal_eval(statement.value)
        (target / 'prompts.json').write_text(json.dumps({'instructions': instructions}, ensure_ascii=False))
        break
else: raise RuntimeError('Instructions de vérification introuvables.')
print('Ressources Android préparées sans aucune valeur de clé API.')
