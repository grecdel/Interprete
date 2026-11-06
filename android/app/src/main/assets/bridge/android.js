'use strict';
(() => {
  const pending = new Map(), opened = [];
  let nextId = 0, microphone, preview;
  // A page-specific prefix: replies queued natively for a previous page must not resolve this page's calls.
  const pageId = Array.from(crypto.getRandomValues(new Uint32Array(2)), value => value.toString(36)).join('');
  function call(action, data = {}, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const id = 'rpc_' + pageId + '_' + (++nextId);
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Cette opération prend trop de temps. Réessayez.')); }, timeout);
      const raw=JSON.stringify({id,action,data});
      if(raw.length>15*1024*1024){clearTimeout(timer);reject(new Error('Dossier trop volumineux pour cet export. Exportez les pièces séparément.'));return;}
      pending.set(id, {resolve, reject, timer});
      window.InterpreteNative.postMessage(raw);
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
      if (microphone) microphone.onText(event.text,event.audio_ref);
      else if (window.acceptSpeech) window.acceptSpeech(event.text,event.audio_ref);
    } else if(event.event === 'storageWarning') { document.getElementById('archive-status').textContent=event.message;
    } else if (event.event === 'audio') {
      const clips=window.InterpreteArchive.session.audio; if(!clips.some(clip=>clip.id===event.clip.id))clips.push(event.clip);
    } else if (event.event === 'microphoneError') {
      microphone?.onError(event.message);
    } else if(event.event === 'stopped') {
      window.stopListening?.();
    } else if (event.event === 'overlay') overlayState(event.enabled, false);
    else if (event.event === 'open') {
      if(!event.activation&&!event.listen)return;
      opened.forEach(callback => callback());
      if (event.listen) window.InterpreteLauncher?.show();
    }
  };
  window.interpreteDesktop = {
    request: (path, body) => call('request', {path, body}),
    transcribe: () => Promise.reject(new Error('Utilisez la capture Android native.')),
    settings: () => call('settings'),
    setLauncherOpen: open => {call('launcher',{open}).catch(()=>{});},
    completeOnboarding: theme => call('onboard',{theme}),
    setTheme: theme => call('theme',{theme}),
    extractImage: async file => {const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});return call('extractImage',{base64:encoded},120000);},
    saveKey: (key, remember) => call('saveKey', {key, remember}),
    setPanelOpen: open => { call('panel', {open}).catch(() => {}); },
    setUnsaved: value => { call('unsaved', {value}).catch(() => {}); },
    saveArchive: (content, extension, name) => call('archive', {content, extension, name}, 300000).then(result => { if (result.saved && extension === 'html' && preview) preview.hidden = false; return result.saved; }),
    copyText: text => call('copy', {text}),
    quit: () => { call('quit').catch(() => {}); },
    onOpen: callback => opened.push(callback)
  };
  window.InterpreteMicrophone = class {
    constructor({onText, onError}) { this.onText = onText; this.onError = onError; }
    async start() {
      const previous = microphone; microphone = this;
      try { await call('startMic',{retain_audio:document.getElementById('retain-audio')?.checked!==false,record_only:Boolean(window.interpreteRecordOnly),duration_ms:Number(document.getElementById('audio-duration')?.value||180)*60000}); } catch (error) { microphone = previous; throw error; }
    }
    stop() { return call('stopMic', {}, 300000); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('android-mode');
    preview = document.createElement('button'); preview.id = 'android-archive-preview'; preview.type = 'button'; preview.hidden = true; preview.textContent = 'Voir le dernier compte rendu';
    preview.onclick = () => call('viewArchive').catch(() => {}); document.getElementById('archive-tray').append(preview);
    const audioOptions=document.createElement('div');audioOptions.className='audio-options';
    const retainLabel=document.createElement('label'),retain=document.createElement('input');retain.type='checkbox';retain.id='retain-audio';retain.checked=true;retainLabel.append(retain,' Conserver l’audio sur ce téléphone');
    const offlineLabel=document.createElement('label'),offline=document.createElement('input');offline.type='checkbox';offline.id='record-only';offline.onchange=()=>{window.interpreteRecordOnly=offline.checked;};offlineLabel.append(offline,' Enregistrer hors ligne, sans transcription');
    const durationLabel=document.createElement('label');durationLabel.textContent='Durée maximale ';const duration=document.createElement('select');duration.id='audio-duration';for(const minutes of [30,60,180]){const option=document.createElement('option');option.value=minutes;option.textContent=minutes+' min';duration.append(option);}duration.value='180';durationLabel.append(duration);
    audioOptions.append(retainLabel,offlineLabel,durationLabel);document.querySelector('.live-section').append(audioOptions);
    const bundle=document.createElement('button');bundle.type='button';bundle.id='export-audio-bundle';bundle.textContent='Terminer et exporter le dossier avec audio (ZIP)';
    bundle.onclick=async()=>{
      bundle.disabled=true;const status=document.getElementById('archive-status');
      try {
        const snapshot=await window.prepareInterpreteArchive();snapshot.audio_directory='audio/';
        if(!snapshot.audio.length)throw new Error('Aucun audio conservé dans cette session.');
        const html=window.InterpreteArchive.htmlDocument(snapshot);
        const result=await call('audioBundle',{content:html,session:JSON.stringify(snapshot,null,2),clips:snapshot.audio.map(clip=>clip.id)},300000);
        status.textContent=result.saved?'Dossier ZIP exporté : compte rendu, transcription et extraits audio.':'Export annulé.';
        if(result.saved){preview.hidden=false;window.interpreteDesktop.setUnsaved(false);}
      }catch(error){status.textContent=error.message||'Export audio impossible.';}
      finally{bundle.disabled=false;}
    };document.getElementById('archive-tray').append(bundle);
    const settings = document.getElementById('settings-tray');
    const recover=document.createElement('button');recover.type='button';recover.textContent='Récupérer les audios conservés sur ce téléphone';
    recover.onclick=async()=>{try{const result=await call('audioInventory');const clips=window.InterpreteArchive.session.audio;for(const clip of (result.clips||[]).sort((a,b)=>a.captured_at.localeCompare(b.captured_at))){if(!clips.some(value=>value.id===clip.id))clips.push(clip);if(clip.transcript&&!window.InterpreteArchive.session.transcript.some(fragment=>fragment.audio_ref?.id===clip.id))window.InterpreteArchive.recordTranscript(clip.transcript,clip);}document.getElementById('settings-status').textContent=clips.length+' extraits disponibles pour export ZIP. Les transcriptions conservées sont récupérées ; les anciennes analyses ne sont pas restaurées.';}catch(error){document.getElementById('settings-status').textContent=error.message;}};
    const clear=document.createElement('button');clear.type='button';clear.textContent='Supprimer les audios conservés';clear.onclick=async()=>{if(!confirm('Supprimer définitivement tous les audios de ce téléphone ? Exportez d’abord le dossier ZIP.'))return;try{await call('clearAudio');window.InterpreteArchive.session.audio=[];document.getElementById('settings-status').textContent='Audios locaux supprimés. Les exports existants restent inchangés.';}catch(error){document.getElementById('settings-status').textContent=error.message;}};
    settings.append(recover,clear);

    const button = document.createElement('button'); button.id = 'android-overlay'; button.type = 'button'; button.dataset.enabled = 'false';
    const status = document.createElement('p'); status.id = 'android-overlay-status';
    settings.append(button, status);
    button.onclick = async () => {
      try { const state = await call('overlay', {enable: button.dataset.enabled !== 'true'}); overlayState(state.enabled, state.pending); }
      catch { status.textContent = 'L’autorisation d’affichage n’est pas disponible sur ce téléphone.'; }
    };
    const help = document.querySelector('.help>div'); help.replaceChildren();
    for (const text of [
      'L’audio peut être conservé localement sur ce téléphone (512 Mio maximum). Les extraits sont aussi envoyés à OpenAI pour la transcription, sauf en mode hors ligne. Exportez le ZIP avant de supprimer les enregistrements.',
      'La touche Accueil peut laisser l’écoute continuer en arrière-plan. La croix du volet arrête l’écoute. Activez la bulle dans les réglages pour retrouver Interprete au-dessus des autres applications.',
      'Le son interne des applications et les appels ne sont pas capturés directement. Utilisez un reportage sur haut-parleur ou un micro externe.',
      'Exportez la session avant de quitter : la transcription est automatique et peut être erronée. Les sources, relances et connexions restent à contrôler.'
    ]) { const paragraph = document.createElement('p'); paragraph.textContent = text; help.append(paragraph); }
    call('settings').then(state => overlayState(state.overlayEnabled, false));
    call('ready').catch(() => {});
  }, {once: true});
})();
