"""Render a dark presentation from the actual UI; all interview content is fictional."""
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from server import Handler

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        page.route('**/api/status', lambda route: route.fulfill(json={'configured': True}))
        page.goto(f'http://127.0.0.1:{server.server_port}')
        page.get_by_label('Thème au premier lancement').select_option('dark')
        page.locator('#launcher-complete').click()
        page.locator('#bubble').click()
        page.locator('[data-action=panel]').click()
        page.add_style_tag(content='''
html,body{background:#090911}.assistant-panel{top:40px;bottom:40px;right:64px;width:386px;border-color:#ffffff18;box-shadow:0 24px 100px #0009}
.companion.is-open .bubble-dock{top:58px;right:257px}.presentation{position:fixed;inset:0 500px 0 0;padding:65px 80px;color:#f0eafb;font-family:Inter,Arial,sans-serif;background:radial-gradient(ellipse at 50% 36%,#56287726,transparent 60%),#090911}
.presentation small{font-size:12px;letter-spacing:3px;color:#c2a9ef}.presentation h1{font-size:60px;line-height:1.08;font-weight:500;letter-spacing:-3px;margin:28px 0 20px}.presentation p{font-size:18px;line-height:1.7;color:#a29aaf;max-width:580px}.presentation .bubble{width:245px;height:245px;margin:55px 0 45px 110px;pointer-events:none}.presentation footer{font-size:12px;color:#82778f;margin-top:26px}.presentation .features{display:flex;gap:12px;font-size:12px;color:#d9c9ed}.features span{border:1px solid #b59bd42b;padding:10px 14px;border-radius:24px}
''')
        page.evaluate('''() => {
const hero=document.createElement('section');hero.className='presentation';
hero.innerHTML='<small>INTERPRÈTE · ASSISTANT D’ENQUÊTE</small><h1>À l’écoute.<br>Gardez le fil.</h1><p>Une présence discrète. Vos recherches, vos sources et vos connexions dans un même volet.</p><div class="bubble" aria-hidden="true"></div><div class="features"><span>Écouter</span><span>Vérifier</span><span>Relier</span><span>Archiver</span></div><footer>Aperçu du thème sombre · interface réelle · prototype</footer>';
hero.querySelector('.bubble').append(document.querySelector('.bubble-face').cloneNode(true));document.body.prepend(hero);
}''')
        page.wait_for_timeout(800)
        page.screenshot(path=str(root / 'docs/assets/hero.png'))
        # Actual material previews, using the same orb and theme rules as the app.
        page.evaluate('''() => { document.querySelector('.presentation').remove();document.getElementById('companion').hidden=true;
const grid=document.createElement('div');grid.id='materials';grid.style='display:flex;gap:40px;padding:70px 60px;color:#eee;font:14px Arial;background:#090911';
for(const [theme,label] of [['dark','Électricité violette'],['pastel','Eau'],['matrix','Données numériques'],['investigation','Fumée']]){
const cell=document.createElement('div');cell.dataset.theme=theme;cell.style='width:240px;text-align:center';cell.innerHTML='<div class="bubble" style="width:200px;height:200px;margin:0 auto 35px"></div><p>'+label+'</p>';
cell.querySelector('.bubble').append(document.querySelector('#bubble .bubble-face').cloneNode(true));grid.append(cell);}document.body.append(grid); }''')
        # Palette variables are scoped to roots in production; set each preview explicitly.
        for theme in ['dark', 'pastel', 'matrix', 'investigation']:
            page.evaluate('(theme) => document.documentElement.dataset.theme=theme', theme)
            values=page.evaluate('''() => Object.fromEntries(['--orb-light','--orb-mid','--orb-hot','--orb-base','--orb-speed'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k)]))''')
            page.locator(f'#materials [data-theme={theme}]').evaluate('(el, values) => { for(const [key,value] of Object.entries(values))el.style.setProperty(key,value); }', values)
        page.evaluate('document.documentElement.dataset.theme="dark"')
        page.locator('#materials').screenshot(path=str(root / 'docs/assets/orb-materials.png'))
        browser.close()
finally:
    server.shutdown()
    server.server_close()
