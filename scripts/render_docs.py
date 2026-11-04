"""Render the GitHub illustrations from real UI screenshots (demo data only)."""
import base64
from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
assets = root / 'docs' / 'assets'
def data_image(name):
    return 'data:image/png;base64,' + base64.b64encode((assets / name).read_bytes()).decode()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    page.set_content(f'''<!doctype html><html lang="fr"><meta charset="utf-8"><style>
*{{box-sizing:border-box}}body{{margin:0;background:#f2f0f7;color:#343040;font-family:Arial,sans-serif}}.canvas{{height:900px;position:relative;overflow:hidden;padding:68px 80px;background:radial-gradient(ellipse at 78% 30%,#d9cee945,transparent 55%),#f3f1f8}}.brand{{display:flex;align-items:center;gap:14px;font-size:25px;font-weight:600;letter-spacing:-1px}}.brand img{{width:44px}}.pill{{display:inline-block;margin-top:110px;color:#9581ac;font-size:11px;letter-spacing:2px}}h1{{font-size:65px;font-weight:500;letter-spacing:-3px;line-height:1.1;margin:26px 0}}h1 span{{color:#9c8cae}}.description{{font-size:17px;color:#90829d;line-height:1.9;max-width:530px}}.tags{{display:flex;gap:9px;margin-top:30px}}.tags span{{font-size:12px;color:#95819e;border:1px solid #d9cde4;padding:9px 14px;border-radius:18px}}.screen{{position:absolute;top:33px;right:100px;height:830px;width:auto;filter:drop-shadow(0 14px 30px #69527b20)}}.note{{position:absolute;bottom:48px;color:#a695af;font-size:11px}}.version{{margin-left:8px;font-size:11px;font-weight:400;color:#aa9bb7;letter-spacing:0}}.rule{{width:55px;height:2px;background:#c7b7d9;margin:25px 0}}
</style><div class="canvas"><div class="brand"><img src="{data_image('icon.png')}">Interprete <span class="version">APPLICATION LINUX · PROTOTYPE</span></div><span class="pill">VOTRE ASSISTANT, À PORTÉE DE VOIX.</span><h1>Gardez le fil.<br><span>Les sources aussi.</span></h1><div class="rule"></div><p class="description">Une bulle discrète pendant l’interview.<br>Des pistes pour rebondir.<br>Une archive pour tout relire.</p><div class="tags"><span>Micro & texte</span><span>Sources & contexte</span><span>Carte des connexions</span></div><img class="screen" src="{data_image('desktop.png')}"><div class="note">Capture de l’application native · données fictives de démonstration · conclusions à contrôler</div></div>''')
    page.screenshot(path=str(assets / 'hero.png'))
    page.set_viewport_size({'width': 1400, 'height': 1050})
    page.set_content((assets / 'archive-demo.html').read_text())
    page.locator('#mindmap').scroll_into_view_if_needed()
    page.locator('#mindmap').screenshot(path=str(assets / 'mind-map.png'))
    browser.close()
print('Illustrations GitHub créées : hero.png, mind-map.png')
