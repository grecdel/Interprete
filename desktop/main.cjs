'use strict';
const {app, BrowserWindow, ipcMain, session, screen, dialog, shell, safeStorage, Menu, Tray, nativeImage, clipboard} = require('electron');
const {spawn} = require('node:child_process');
const {randomBytes} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {API_PATHS, validKey, externalUrl, panelBounds, bubbleBounds} = require('./security.cjs');

// XWayland permits free placement and always-on-top behavior on Wayland desktops.
if (process.platform === 'linux' && process.env.DISPLAY) app.commandLine.appendSwitch('ozone-platform', 'x11');

if (process.env.INTERPRETE_USER_DATA) app.setPath('userData', process.env.INTERPRETE_USER_DATA);
let window, backend, origin, tray;
let unsaved = false, quitting = false, askingToQuit = false, microphoneAllowed = false;
const token = randomBytes(32).toString('hex');
const credentialsPath = () => path.join(app.getPath('userData'), 'credentials.bin');
const workArea = () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
function secureStorageAvailable() {
  return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
}
function loadSavedKey() {
  if (!secureStorageAvailable()) return '';
  try { return safeStorage.decryptString(fs.readFileSync(credentialsPath())); } catch { return ''; }
}
function checkSender(event) {
  if (!window || event.sender.id !== window.webContents.id || event.senderFrame !== window.webContents.mainFrame || !event.senderFrame.url.startsWith(origin + '/')) {
    throw new Error('Accès refusé.');
  }
}
async function serviceRequest(apiPath, data, mimeType) {
  const headers = {'X-Interprete-Token': token};
  let body;
  if (data !== undefined) {
    headers['Content-Type'] = mimeType || 'application/json';
    body = mimeType ? data : JSON.stringify(data);
  }
  const response = await fetch(origin + apiPath, {method: body === undefined ? 'GET' : 'POST', headers, body, signal: AbortSignal.timeout(95000)});
  return {ok: response.ok, status: response.status, body: await response.json()};
}
function setOpen(open) {
  if (!window) return;
  const area = screen.getDisplayMatching(window.getBounds()).workArea;
  window.setMinimumSize(open ? 350 : 90, open ? 460 : 90);
  window.setBounds(open ? panelBounds(area) : bubbleBounds(area));
  window.setSkipTaskbar(!open);
}
function installIpc() {
  ipcMain.handle('interprete:request', async (event, {path: apiPath, data}) => {
    checkSender(event);
    if (!API_PATHS.has(apiPath) || (apiPath === '/api/status' && data !== undefined) || JSON.stringify(data || '').length > 260000) throw new Error('Requête refusée.');
    return serviceRequest(apiPath, data);
  });
  ipcMain.handle('interprete:audio', async (event, {audio, mimeType}) => {
    checkSender(event);
    if (!(audio instanceof Uint8Array) || audio.length > 8 * 1024 * 1024 || !['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'].includes(String(mimeType).split(';')[0])) throw new Error('Extrait audio refusé.');
    const result = await serviceRequest('/api/transcribe', Buffer.from(audio), mimeType);
    if (!result.ok) throw new Error(result.body.error || 'La transcription a échoué.');
    return result.body;
  });
  ipcMain.handle('interprete:settings', event => {
    checkSender(event);
    return {canRemember: secureStorageAvailable(), hasSavedKey: fs.existsSync(credentialsPath()) && secureStorageAvailable()};
  });
  ipcMain.handle('interprete:key', async (event, {key, remember}) => {
    checkSender(event);
    if (!validKey(key)) throw new Error('Collez votre clé API seule, sans espaces.');
    if (remember && !secureStorageAvailable()) throw new Error('Le coffre de votre système est indisponible. Utilisez la clé pour cette session seulement.');
    const result = await serviceRequest('/api/desktop/key', {key: key.trim()});
    if (!result.ok) throw new Error(result.body.error || 'Impossible de configurer la clé.');
    if (remember) {
      fs.mkdirSync(app.getPath('userData'), {recursive: true, mode: 0o700});
      fs.writeFileSync(credentialsPath(), safeStorage.encryptString(key.trim()), {mode: 0o600});
    } else {
      try { fs.unlinkSync(credentialsPath()); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return {configured: true, remembered: Boolean(remember)};
  });
  ipcMain.handle('interprete:archive', async (event, {content, extension, name}) => {
    checkSender(event);
    if (!['html', 'json'].includes(extension) || typeof content !== 'string' || content.length > 30 * 1024 * 1024) throw new Error('Archive refusée.');
    const chosen = await dialog.showSaveDialog(window, {title: 'Enregistrer le compte rendu', defaultPath: path.join(app.getPath('documents'), path.basename(name)), filters: [{name: extension === 'html' ? 'Compte rendu HTML' : 'Archive JSON', extensions: [extension]}]});
    if (chosen.canceled) return false;
    await fs.promises.writeFile(chosen.filePath, content, {encoding: 'utf8', mode: 0o600});
    return true;
  });
  ipcMain.handle('interprete:copy', (event, value) => { checkSender(event); if (typeof value !== 'string' || value.length > 10000) throw new Error('Texte refusé.'); clipboard.writeText(value); });
  ipcMain.on('interprete:panel', (event, open) => { checkSender(event); setOpen(Boolean(open)); });
  ipcMain.on('interprete:unsaved', (event, value) => { checkSender(event); unsaved = Boolean(value); });
  ipcMain.on('interprete:quit', event => { checkSender(event); app.quit(); });
}
async function startBackend() {
  const executable = path.join(process.resourcesPath, 'backend', process.platform === 'win32' ? 'interprete-backend.exe' : 'interprete-backend');
  const isDevelopment = !app.isPackaged;
  const command = isDevelopment ? (process.env.INTERPRETE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')) : executable;
  const args = isDevelopment ? [path.join(__dirname, '..', 'desktop_backend.py')] : [];
  const env = {...process.env, INTERPRETE_DESKTOP_TOKEN: token, PYTHONUNBUFFERED: '1'};
  if (!env.INTERPRETE_API_KEY && !env.OPENAI_API_KEY) {
    const key = loadSavedKey(); if (key) env.INTERPRETE_API_KEY = key;
  }
  backend = spawn(command, args, {env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
  // Do not forward process output: HTTP errors or future dependencies may contain secrets.
  backend.stderr.on('data', () => {});
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Le service local met trop de temps à démarrer.')), 30000);
    backend.once('error', () => { clearTimeout(timeout); reject(new Error('Le service local n’a pas pu démarrer.')); });
    backend.once('exit', () => { clearTimeout(timeout); reject(new Error('Le service local s’est arrêté avant son démarrage.')); });
    backend.stdout.on('data', chunk => {
      output += chunk.toString();
      for (const line of output.split('\n').slice(0, -1)) {
        try {
          const value = JSON.parse(line);
          if (value.ready && Number.isInteger(value.port) && value.port > 0 && value.port < 65536) {
            origin = `http://127.0.0.1:${value.port}`; clearTimeout(timeout); resolve();
          }
        } catch { /* Only readiness JSON is consumed. */ }
      }
      output = output.slice(output.lastIndexOf('\n') + 1).slice(-4096);
    });
  });
}
function openPanel() {
  window.show(); setOpen(true); window.webContents.send('interprete:open'); window.focus();
}
async function createWindow() {
  const area = workArea();
  window = new BrowserWindow({
    ...panelBounds(area), minWidth: 350, minHeight: 460, frame: false, transparent: true,
    backgroundColor: '#00000000', alwaysOnTop: true, resizable: false, show: false,
    title: 'Interprete', icon: path.join(app.getAppPath(), 'docs/assets/icon.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false}
  });
  window.webContents.setWindowOpenHandler(({url}) => { const safe = externalUrl(url); if (safe) shell.openExternal(safe); return {action: 'deny'}; });
  window.webContents.on('will-navigate', (event, url) => { if (url !== origin + '/' && !url.startsWith(origin + '/#')) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('context-menu', () => Menu.buildFromTemplate([
    {label: 'Ouvrir Interprete', click: openPanel}, {type: 'separator'}, {role: 'copy', label: 'Copier'}, {role: 'paste', label: 'Coller'}, {type: 'separator'}, {label: 'Quitter Interprete', click: () => app.quit()}
  ]).popup({window}));
  window.on('close', event => { if (!quitting) { event.preventDefault(); app.quit(); } });
  session.defaultSession.setPermissionCheckHandler((contents, permission) => contents === window.webContents && permission === 'media' && microphoneAllowed);
  session.defaultSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (contents !== window.webContents || permission !== 'media' || details.mediaTypes?.some(type => type !== 'audio')) return callback(false);
    if (!microphoneAllowed) {
      const answer = await dialog.showMessageBox(window, {type: 'question', title: 'Écouter le reportage', message: 'Autoriser le micro pour cette session ?', detail: 'L’audio est envoyé par extraits à OpenAI pour être transcrit. Les frais API s’appliquent. Aucun fichier audio n’est conservé.', buttons: ['Autoriser le micro', 'Annuler'], defaultId: 0, cancelId: 1});
      microphoneAllowed = answer.response === 0;
    }
    callback(microphoneAllowed);
  });
  installIpc();
  window.once('ready-to-show', () => window.show());
  await window.loadURL(origin + '/');
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(app.getAppPath(), 'docs/assets/icon.png')).resize({width: 24, height: 24}));
    tray.setToolTip('Interprete'); tray.setContextMenu(Menu.buildFromTemplate([{label: 'Ouvrir Interprete', click: openPanel}, {label: 'Quitter', click: () => app.quit()}])); tray.on('click', openPanel);
  } catch { /* The bubble's context menu remains available without a system tray. */ }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) openPanel(); });
  app.whenReady().then(async () => { await startBackend(); await createWindow(); }).catch(async () => {
    await dialog.showMessageBox({type: 'error', title: 'Interprete', message: 'Interprete n’a pas pu démarrer.', detail: 'Vérifiez que le téléchargement est complet et relancez l’application.'}); quitting = true; app.quit();
  });
}
app.on('before-quit', event => {
  if (!quitting && unsaved && window) {
    event.preventDefault();
    if (!askingToQuit) {
      askingToQuit = true;
      dialog.showMessageBox(window, {type: 'question', title: 'Conserver l’interview', message: 'Cette session n’a pas été exportée.', detail: 'Choisissez Continuer pour enregistrer le compte rendu depuis le bouton d’archive.', buttons: ['Continuer', 'Quitter sans exporter'], defaultId: 0, cancelId: 0}).then(answer => {
        askingToQuit = false; if (answer.response === 1) { quitting = true; app.quit(); }
      });
    }
    return;
  }
  quitting = true;
  if (backend) { backend.stdin.end(); backend.kill(); }
});
app.on('window-all-closed', () => { if (quitting) app.quit(); });
