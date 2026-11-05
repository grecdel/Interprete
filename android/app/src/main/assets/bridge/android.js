'use strict';
(() => {
  const pending = new Map(), opened = [];
  let nextId = 0, microphone;
  function call(action, data = {}, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const id = 'rpc_' + (++nextId);
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Cette opération prend trop de temps. Réessayez.')); }, timeout);
      pending.set(id, {resolve, reject, timer});
      window.InterpreteNative.postMessage(JSON.stringify({id, action, data}));
    });
  }
  function overlayState(enabled, waiting) {
    const button = document.getElementById('android-overlay');
    if (!button) return;
    button.dataset.enabled = String(Boolean(enabled));
    button.textContent = enabled ? 'Désactiver la bulle au-dessus des applications' : 'Activer la bulle au-dessus des applications';
    document.getElementById('android-overlay-status').textContent = waiting ? 'Autorisez Interprete dans l’écran Android, puis revenez ici.' : enabled ? 'Bulle activée. Elle apparaît quand vous quittez le volet.' : 'La bulle nécessite une autorisation Android distincte du micro.';
  }
  window.InterpreteAndroidReceive = raw => {
    const event = JSON.parse(raw);
    if (event.id && pending.has(event.id)) {
      const request = pending.get(event.id); pending.delete(event.id); clearTimeout(request.timer);
      if (event.error) request.reject(new Error(event.error)); else request.resolve(event.result || {});
    } else if (event.event === 'text') {
      if (microphone) microphone.onText(event.text);
      else if (window.acceptSpeech) window.acceptSpeech(event.text);
    } else if (event.event === 'microphoneError' || event.event === 'stopped') {
      microphone?.onError(event.message);
    } else if (event.event === 'overlay') overlayState(event.enabled, false);
    else if (event.event === 'open') {
      opened.forEach(callback => callback());
      if (event.listen) document.getElementById('bubble').click();
    }
  };
  window.interpreteDesktop = {
    request: (path, body) => call('request', {path, body}),
    transcribe: () => Promise.reject(new Error('Utilisez la capture Android native.')),
    settings: () => call('settings'),
    saveKey: (key, remember) => call('saveKey', {key, remember}),
    setPanelOpen: open => { call('panel', {open}).catch(() => {}); },
    setUnsaved: value => { call('unsaved', {value}).catch(() => {}); },
    saveArchive: (content, extension, name) => call('archive', {content, extension, name}, 300000).then(result => result.saved),
    copyText: text => call('copy', {text}),
    quit: () => { call('quit').catch(() => {}); },
    onOpen: callback => opened.push(callback)
  };
  window.InterpreteMicrophone = class {
    constructor({onText, onError}) { this.onText = onText; this.onError = onError; }
    async start() {
      const previous = microphone; microphone = this;
      try { await call('startMic'); } catch (error) { microphone = previous; throw error; }
    }
    stop() { return call('stopMic', {}, 300000); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('android-mode');
    const settings = document.getElementById('settings-tray');
    const button = document.createElement('button'); button.id = 'android-overlay'; button.type = 'button'; button.dataset.enabled = 'false';
    const status = document.createElement('p'); status.id = 'android-overlay-status';
    settings.append(button, status);
    button.onclick = async () => {
      try { const state = await call('overlay', {enable: button.dataset.enabled !== 'true'}); overlayState(state.enabled, state.pending); }
      catch { status.textContent = 'L’autorisation d’affichage n’est pas disponible sur ce téléphone.'; }
    };
    const help = document.querySelector('.help>div'); help.replaceChildren();
    for (const text of [
      'Le micro envoie l’audio à OpenAI par extraits d’environ 12 secondes. Une notification indique l’écoute et permet de l’arrêter.',
      'La touche Accueil peut laisser l’écoute continuer en arrière-plan. La croix du volet arrête l’écoute. Activez la bulle dans les réglages pour retrouver Interprete au-dessus des autres applications.',
      'Le son interne des applications et les appels ne sont pas capturés directement. Utilisez un reportage sur haut-parleur ou un micro externe.',
      'Exportez la session avant de quitter : la transcription est automatique et peut être erronée. Les sources, relances et connexions restent à contrôler.'
    ]) { const paragraph = document.createElement('p'); paragraph.textContent = text; help.append(paragraph); }
    call('settings').then(state => overlayState(state.overlayEnabled, false));
    call('ready').catch(() => {});
  }, {once: true});
})();
