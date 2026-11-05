'use strict';
const {_electron: electron} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const root = path.join(__dirname, '..');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'interprete-desktop-'));
  const packaged = process.env.INTERPRETE_DESKTOP_EXECUTABLE;
  const instance = await electron.launch({
    executablePath: packaged || require('electron'),
    args: ['--no-sandbox', '--disable-gpu', '--use-fake-device-for-media-stream', ...(packaged ? [] : [root])],
    env: {...process.env, INTERPRETE_USER_DATA: profile, INTERPRETE_API_KEY: '', OPENAI_API_KEY: ''},
    timeout: 45000
  });
  let passed = 0;
  const errors = [];
  try {
    const page = await instance.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('#launcher-complete').click();
    await page.locator('#bubble').click();
    await page.locator('[data-action=panel]').click();
    await page.locator('#settings-tray').waitFor({state: 'visible'});
    const info = await instance.evaluate(({BrowserWindow}) => ({alwaysOnTop: BrowserWindow.getAllWindows()[0].isAlwaysOnTop(), url: BrowserWindow.getAllWindows()[0].webContents.getURL()}));
    assert.equal(info.alwaysOnTop, true);
    assert.equal((await fetch(info.url + 'api/status')).status, 403); passed++;
    console.log('PASS 1: native window is always on top; local API rejects unauthenticated callers');

    await page.locator('#api-key').fill('fake-project-key-used-only-in-tests');
    await page.locator('#save-key').click();
    await page.waitForFunction(() => document.getElementById('settings-status').textContent.includes('Clé configurée'));
    assert.equal(await page.locator('#api-key').inputValue(), '');
    if (process.env.INTERPRETE_SCREENSHOTS) {
      await page.locator('#settings-tray').screenshot({path: path.join(root, 'docs/assets/settings.png'), omitBackground: true});
    }
    await page.locator('#settings-button').click(); passed++;
    console.log('PASS 2: API key can be entered inside the application and is cleared from the form');

    await instance.evaluate(({dialog}) => {
      dialog.showMessageBox = async () => ({response: 0});
      const original = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (String(url).endsWith('/api/transcribe')) return new Response(JSON.stringify({text: 'Un propos enregistré pour le test de transcription.'}), {headers: {'Content-Type': 'application/json'}});
        if (String(url).endsWith('/api/verify')) {
          const context = JSON.parse(options.body).context || [];
          return new Response(JSON.stringify({has_sources: true, sources: [], checks: [{
            claim: 'Le budget annoncé a-t-il le même périmètre ?', verdict: 'À nuancer',
            summary: 'Exemple fictif : préciser la période et le périmètre avant de comparer ces montants.',
            reasoning: 'Données fictives pour illustrer la lecture d’une carte. Ce résultat ne provient pas d’une recherche réelle.',
            evidence: ['Identifier la période de référence.', 'Comparer des montants portant sur le même périmètre.'],
            follow_up: 'Parlez-vous du budget voté ou des dépenses réellement exécutées ?',
            sources: [{url: 'https://www.vie-publique.fr/', title: 'Exemple de source · Vie publique'}],
            limitations: ['Capture de démonstration : source illustrative.'],
            connections: context.length ? [{target_id: context[context.length - 1].id, relation: 'nuance', explanation: 'Exemple de connexion entre deux propos. Les dates et les périmètres doivent être contrôlés.'}] : []
          }]}), {headers: {'Content-Type': 'application/json'}});
        }
        return original(url, options);
      };
    });
    await page.locator('#microphone').click();
    await page.waitForFunction(() => document.getElementById('companion').classList.contains('is-listening'));
    await page.waitForTimeout(900);
    await page.locator('#microphone').click();
    await page.waitForFunction(() => window.InterpreteArchive.snapshot().transcript.length === 1);
    assert.match((await page.evaluate(() => window.InterpreteArchive.snapshot())).transcript[0].text, /test de transcription/);
    passed++;
    console.log('PASS 3: native microphone capture reaches the transcription bridge (fake device and service)');

    for (const text of ['« Le budget serait passé de 10 à 12 millions. » — exemple fictif.', '« Les dépenses seraient restées stables. » — exemple fictif.']) {
      await page.locator('#transcript').fill(text);
      await page.locator('#verify').click();
      await page.locator('.searching').waitFor({state: 'detached'});
    }
    assert.equal(await page.locator('.result-card').count(), 2);
    assert.equal(await page.locator('.connection-note').count(), 1);
    await page.locator('#collapse').click();
    await page.waitForFunction(() => !document.getElementById('companion').classList.contains('is-open'));
    const collapsed = await instance.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.equal(collapsed.width, 90);
    assert.equal(collapsed.height, 90);
    if (process.env.INTERPRETE_SCREENSHOTS) await page.screenshot({path: path.join(root, 'docs/assets/bubble.png'), omitBackground: true});
    await instance.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.send('interprete:open'));
    await page.locator('[data-action=panel]').click();
    await page.locator('#assistant-panel').waitFor({state: 'visible'});
    if (process.env.INTERPRETE_SCREENSHOTS) {
      await page.evaluate(() => { document.getElementById('status').textContent = 'Démonstration · données fictives'; document.getElementById('feed').scrollTop = 0; });
      await page.screenshot({path: path.join(root, 'docs/assets/desktop.png'), omitBackground: true});
    }
    passed++;
    console.log('PASS 4: feed, sources, connections and compact 90 px bubble work in the native window');

    const archivePath = path.join(profile, 'interview.html');
    await instance.evaluate(({dialog}, filePath) => { dialog.showSaveDialog = async () => ({canceled: false, filePath}); }, archivePath);
    await page.locator('#archive-button').click();
    await page.locator('#export-html').click();
    await page.waitForFunction(() => document.getElementById('archive-status').textContent.includes('Compte rendu HTML exporté'));
    const html = fs.readFileSync(archivePath, 'utf8');
    assert.match(html, /Carte des connexions/);
    assert.match(html, /Un propos enregistré pour le test de transcription/);
    assert.match(html, /données|Données/);
    if (process.env.INTERPRETE_SCREENSHOTS) fs.writeFileSync(path.join(root, 'docs/assets/archive-demo.html'), html);
    passed++;
    console.log('PASS 5: native save dialog exports the complete transcription and standalone mind map');
    assert.deepEqual(errors, []);
    console.log(`${passed} native desktop scenarios passed; no real API request was made.`);
  } finally {
    await instance.evaluate(({app}) => app.exit(0)).catch(() => {});
    await instance.close().catch(() => {});
    fs.rmSync(profile, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
