'use strict';

const companion = document.getElementById('companion');
// Keep references when the companion moves into its floating window.
const ui = Object.fromEntries([...companion.querySelectorAll('[id]')].map(node => [node.id, node]));
const archive = window.InterpreteArchive;
const desktop = window.interpreteDesktop;
let configured = null;
let busy = false;
let wantedListening = false;
let listening = false;
let pendingSpeech = '';
let pendingTranscriptIds = [];
let pendingSince = 0;
let finalPreview = '';
let liveTimer;
let restartTimer;
let restartCount = 0;
let lastRequest = 0;
let priorityLive = false; // F3: set when a watched keyword is heard.
let entryCount = 0;
let unreadCount = 0;
let followUpPreview = ''; // F2: question shown on the closed bubble until the panel opens.
let floatingWindow = null;
let floatingSize = {width: 380, height: 720};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = !desktop && SpeechRecognition ? new SpeechRecognition() : null;
let microphoneCapture;
let captureCompletion = Promise.resolve();
let endingSession = false;
let microphoneEpoch = 0;
const verdictStyles = {'Confirmé': 'confirmed', 'Contredit': 'contradicted', 'À nuancer': 'nuanced', 'Informations insuffisantes': 'unsure'};

function node(tag, className, text) {
  const element = companion.ownerDocument.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function icon(name) {
  const svg = companion.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
  const use = companion.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`); svg.append(use);
  return svg;
}
function showError(message) {
  ui['error-text'].textContent = message; ui.error.hidden = false;
}
function updateStatus() {
  ui.status.textContent = busy ? 'Recherche des sources…' : wantedListening ? (listening ? 'À l’écoute du direct' : 'Connexion au micro…') : 'À votre écoute, à votre rythme';
  companion.classList.toggle('is-listening', listening);
  companion.classList.toggle('is-busy', busy);
  ui.microphone.setAttribute('aria-pressed', String(wantedListening));
  ui['listen-title'].textContent = wantedListening ? (listening ? 'Pause' : 'Ouverture du micro…') : 'Écouter';
  ui['listen-subtitle'].textContent = wantedListening ? 'Mettre l’écoute en pause. La bulle fait de même.' : 'Écouter un reportage. Touchez aussi la bulle.';
  ui.microphone.querySelector('use').setAttribute('href', wantedListening ? '#i-pause' : '#i-mic');
  // 0.7: when the panel is open, the bubble is the microphone button.
  const panelOpen = companion.classList.contains('is-open');
  ui.bubble.setAttribute('aria-label', panelOpen ? (wantedListening ? 'Mettre l’écoute en pause' : 'Écouter un reportage') : followUpPreview ? `Relance prête : ${followUpPreview}. Ouvrir Interprète` : 'Activer Interprète et choisir une action');
  ui['bubble-label'].textContent = followUpPreview && !panelOpen ? `Relance prête · ${followUpPreview}` : wantedListening ? 'Écoute active · ouvrir les actions' : busy ? 'Vérification en cours…' : 'Un clic pour m’activer';
  if (!recognition && !desktop) {
    ui['listen-title'].textContent = 'La saisie reste à votre écoute';
    ui['listen-subtitle'].textContent = 'Pour le micro, utilisez Chrome sur ordinateur.';
    if (!panelOpen && !followUpPreview) { ui.bubble.setAttribute('aria-label', 'Activer Interprète et choisir une action'); ui['bubble-label'].textContent = 'Un clic pour ouvrir'; }
  }
  ui.verify.disabled = busy || ui.transcript.value.trim().length < 10;
  ui['export-html'].disabled = busy || endingSession;
}
function updateArchiveCount() {
  const count = archive.session.transcript.length;
  ui['archive-count'].textContent = `${count} propos transcrit${count > 1 ? 's' : ''}`;
  if (count || archive.session.submissions.length) markUnsaved(true);
}
// In a browser tab the session only lives in memory: warn before closing it (desktop and Android ask natively).
let sessionUnsaved = false;
function markUnsaved(value) { sessionUnsaved = value; desktop?.setUnsaved(value); }
if (!desktop) window.addEventListener('beforeunload', event => { if (sessionUnsaved) { event.preventDefault(); event.returnValue = ''; } });
async function apiFetch(path, options = {}) {
  if (!desktop) return fetch(path, options);
  const result = await desktop.request(path, options.body ? JSON.parse(options.body) : undefined);
  return {ok: result.ok, status: result.status, json: async () => result.body};
}
async function refreshConfiguration() {
  try {
    const response = await apiFetch('/api/status', {cache: 'no-store'});
    if (!response.ok) throw new Error();
    configured = Boolean((await response.json()).configured);
    ui.configuration.hidden = configured;
    return configured;
  } catch {
    configured = null;
    showError('Interprete ne parvient pas à joindre le serveur. Vérifiez qu’il est démarré.');
    return false;
  }
}

function setPanelOpen(open) {
  companion.classList.toggle('is-open', open);
  queueMicrotask(updateStatus);
  ui['assistant-panel'].hidden = !open;
  ui.bubble.setAttribute('aria-expanded', String(open));
  desktop?.setPanelOpen(open);
  if (open) {
    unreadCount = 0; ui.unread.hidden = true;
    followUpPreview = ''; companion.classList.remove('has-followup');
    if (floatingWindow) {
      try { floatingWindow.resizeTo(floatingSize.width, floatingSize.height); } catch { /* Browser controls window dimensions. */ }
    }
  } else {
    stopListening();
    if (floatingWindow) {
      floatingSize = {width: floatingWindow.innerWidth, height: floatingWindow.innerHeight};
      try { floatingWindow.resizeTo(250, 150); } catch { /* Keep a usable window if resizing is denied. */ }
    }
    ui.bubble.focus();
  }
}
function updateComposer() {
  const value = ui.transcript.value.trim();
  const link = /^https?:\/\/\S+$/i.test(value);
  ui['input-kind'].replaceChildren(icon(link ? 'link' : 'text'), companion.ownerDocument.createTextNode(link ? 'Lien à explorer' : value.length > 600 ? 'Article à vérifier' : 'Texte ou lien'));
  ui['character-count'].hidden = value.length < 1000;
  ui['character-count'].textContent = `${value.length.toLocaleString('fr-FR')} / 20 000`;
  ui.transcript.style.height = 'auto';
  ui.transcript.style.height = `${Math.min(ui.transcript.scrollHeight, 180)}px`;
  updateStatus();
}
function cleanText(text) {
  return String(text || '').replace(/\u3010[^\u3011]*\u3011/g, '').replace(/\uE200[^\uE201]*\uE201/g, '').replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}
function sourceList(sources) {
  const list = node('div', 'sources');
  const validSources = [];
  for (const source of sources || []) {
    try {
      const url = new URL(source.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      validSources.push({url, title: cleanText(source.title) || url.hostname});
    } catch { /* Ignore an unusable citation, without losing the remaining results. */ }
  }
  if (!validSources.length) return null;
  list.append(node('p', 'sources-label', validSources.length > 1 ? 'SOURCES À CONSULTER' : 'SOURCE À CONSULTER'));
  for (const source of validSources) {
    const link = node('a', 'source-link');
    link.href = source.url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const domain = source.url.hostname.replace(/^www\./, '');
    link.append(node('span', 'source-monogram', domain[0].toUpperCase()));
    const copy = node('span', 'source-copy');
    copy.append(node('span', 'source-title', source.title), node('span', 'source-domain', domain));
    link.append(copy, icon('popout')); list.append(link);
  }
  return list;
}
// UI4: evidence level from the sources actually attached, distinct from the verdict and the model's confidence.
function proofLevel(check) {
  const hosts = new Set();
  for (const source of Array.isArray(check.sources) ? check.sources : []) {
    try { hosts.add(new URL(source.url).hostname.replace(/^www\./, '')); } catch { /* Ignored: not a usable link. */ }
  }
  if (!hosts.size) return 0;
  // F6: sites that repeat one origin (wire story, press release) are not independent confirmation.
  if (hosts.size === 1 || check.common_origin) return 1;
  return (check.source_excerpts || []).some(excerpt => excerpt?.published_at) ? 3 : 2;
}
const proofLabels = ['aucune source', 'un seul site', 'sources recoupées', 'recoupées et datées'];
function proofMeter(level, check = {}) {
  const meter = node('span', `proof-meter level-${level}`);
  const label = check.common_origin && level === 1 ? 'origine commune probable' : proofLabels[level];
  meter.title = `Niveau de preuve : ${label}. Il dépend des sources jointes, pas de l’assurance du modèle.`;
  meter.setAttribute('aria-label', `Niveau de preuve ${level} sur 3 : ${label}`);
  meter.append(node('span', 'proof-label', 'Preuve'));
  for (let notch = 1; notch <= 3; notch++) meter.append(node('i', notch <= level ? 'on' : ''));
  return meter;
}
window.InterpreteProof = {proofLevel};
function renderCheck(check) {
  const card = node('article', 'result-card');
  if (check.id) card.id = check.id;
  const sources = sourceList(check.sources);
  let verdict = check.verdict;
  if (verdict in verdictStyles && !sources) verdict = 'Informations insuffisantes';
  const meta = node('div', 'card-meta');
  meta.append(node('span', `verdict ${verdictStyles[verdict] || 'unsure'}`, verdict || 'Éclairage'), proofMeter(sources ? proofLevel(check) : 0, check));
  card.append(meta);
  card.append(node('h4', '', cleanText(check.claim)), node('p', 'result-summary', cleanText(check.summary)));
  const evidence = Array.isArray(check.evidence) ? check.evidence.filter(item => typeof item === 'string') : [];
  if (check.follow_up) {
    const followUp = node('div', 'follow-up');
    followUp.append(node('span', 'follow-up-label', 'POUR REBONDIR · PISTE DE RELANCE'), node('p', '', cleanText(check.follow_up)));
    const copy = node('button', 'copy-question', 'Copier la question'); copy.type = 'button';
    copy.onclick = async () => {
      try { if (desktop) await desktop.copyText(check.follow_up); else await navigator.clipboard.writeText(check.follow_up); copy.textContent = 'Question copiée'; }
      catch { showError('La copie est indisponible. Vous pouvez sélectionner la question directement.'); }
    };
    followUp.append(copy); card.append(followUp);
  }
  if (check.reasoning || evidence.length || check.limitations?.length || check.source_excerpts?.length) {
    const details = node('details', 'reasoning');
    const summary = node('summary', '', 'Comprendre la vérification'); summary.append(icon('chevron')); details.append(summary);
    if (check.reasoning) details.append(node('p', '', cleanText(check.reasoning)));
    if (evidence.length) {
      const list = node('ol', 'evidence-list');
      for (const point of evidence) list.append(node('li', '', cleanText(point)));
      details.append(list);
    }
    for (const limitation of check.limitations || []) details.append(node('p', 'limitation', cleanText(limitation)));
    for (const excerpt of check.source_excerpts || []) {
      const quote = node('blockquote', 'source-excerpt');
      quote.append(node('span', '', 'Extrait proposé · à relire dans le document'), node('p', '', cleanText(excerpt.quote)));
      const link = sourceList([{url: excerpt.url, title: excerpt.published_at ? `Document · date indiquée : ${excerpt.published_at}` : 'Ouvrir le document original'}]);
      if (link) quote.append(link); details.append(quote);
    }
    card.append(details);
  }
  for (const connection of check.connections || []) {
    const target = archive.lookup(connection.target_id); if (!target) continue;
    const details = node('details', `connection-note ${connection.relation === 'contradiction_potentielle' ? 'potential-conflict' : ''}`);
    const summary = node('summary', '', archive.labels[connection.relation] || 'Connexion'); summary.append(icon('chevron')); details.append(summary);
    details.append(node('blockquote', '', `« ${target.claim} »`), node('p', '', cleanText(connection.explanation)), node('small', '', target.session_title || 'Plus tôt dans cette interview'));
    const original = node('details', 'original-excerpt'); original.append(node('summary', '', 'Relire le propos d’origine'), node('p', '', target.original_text)); details.append(original);
    card.append(details);
  }
  if (sources) card.append(sources);
  else card.append(node('p', 'source-warning', 'Aucune source associée : les éléments ne permettent pas de conclure.'));
  card.append(node('p', 'editorial-note', 'Analyse automatique · sources à relire avant toute relance factuelle.'));
  return card;
}
function createEntry(text, kind) {
  ui['empty-feed'].hidden = true;
  const group = node('section', 'feed-group');
  const meta = node('div', 'entry-meta');
  meta.append(icon(kind === 'live' ? 'mic' : kind === 'url' ? 'link' : 'text'), companion.ownerDocument.createTextNode(kind === 'live' ? 'En direct' : kind === 'url' ? 'Lien partagé' : text.length > 600 ? 'Article partagé' : 'Texte partagé'));
  const now = new Date();
  const time = node('time', '', now.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}));
  time.dateTime = now.toISOString(); meta.append(time); group.append(meta);
  const pending = node('div', 'searching'); pending.append(node('span', 'spinner'), node('span', '', 'Interprete remonte aux sources…')); group.append(pending);
  const excerpt = node('details', 'original-excerpt');
  excerpt.append(node('summary', '', kind === 'live' ? 'Ce qui a été entendu' : 'Contenu soumis'), node('p', '', text)); group.append(excerpt);
  ui.feed.prepend(group); ui.feed.scrollTop = 0;
  return {group, pending, excerpt};
}
// F2: show the prepared question on the closed bubble.
function announceFollowUp(checks) {
  if (companion.classList.contains('is-open')) return;
  const ready = checks.find(check => typeof check.follow_up === 'string' && check.follow_up.trim());
  if (!ready) return;
  followUpPreview = cleanText(ready.follow_up).slice(0, 160); companion.classList.add('has-followup');
  try { navigator.vibrate?.(40); } catch { /* Vibration is optional. */ }
  updateStatus();
}
// F4: a provisional follow-up, without web search, shown while the full verification runs.
function quickEnabled() { try { return localStorage.getItem('interprete-quick') !== 'off'; } catch { return true; } }
function renderProvisional(check) {
  const card = node('article', 'provisional-card');
  card.append(node('span', 'verdict provisional', 'Piste provisoire · rien n’est encore vérifié'), node('h4', '', cleanText(check.claim)));
  if (check.follow_up) {
    const followUp = node('div', 'follow-up');
    followUp.append(node('span', 'follow-up-label', 'RELANCE IMMÉDIATE · À CONFIRMER'), node('p', '', cleanText(check.follow_up)));
    card.append(followUp);
  }
  card.append(node('p', 'provisional-note', cleanText(check.summary) || 'Les sources arrivent.'));
  return card;
}
async function runVerification(text, kind, entry = null, transcriptIds = []) {
  if (busy) return false;
  busy = true; updateStatus(); ui.error.hidden = true;
  if (configured !== true && !await refreshConfiguration()) {
    if (configured === false) showError('La recherche sera disponible une fois la clé API configurée sur le serveur. Vous pouvez déjà préparer votre texte.');
    busy = false; updateStatus(); return false;
  }
  const current = entry || createEntry(text, kind);
  const context = archive.context();
  if (!current.record) current.record = archive.createSubmission(text, kind, transcriptIds);
  current.record.status = 'pending';
  if (entry) {
    current.group.querySelector('.failed-search')?.remove();
    current.pending = node('div', 'searching'); current.pending.append(node('span', 'spinner'), node('span', '', 'Nouvelle recherche des sources…'));
    current.group.insertBefore(current.pending, current.excerpt);
  }
  lastRequest = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100000);
  const preparation = window.InterpretePreparation?.payload() || undefined;
  const requestKind = kind === 'live' ? 'live' : 'auto';
  let settled = false; const provisional = [];
  if (quickEnabled() && !/^https?:\/\/\S+$/i.test(text.trim())) {
    apiFetch('/api/verify', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({transcript: text, kind: requestKind, mode: 'quick', preparation})})
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (settled || !Array.isArray(result?.checks) || !result.checks.length) return;
        current.record.provisional_checks = result.checks;
        for (const check of result.checks) { const card = renderProvisional(check); provisional.push(card); current.group.insertBefore(card, current.pending); }
        announceFollowUp(result.checks);
      })
      .catch(() => { /* The full verification still answers. */ });
  }
  try {
    const response = await apiFetch('/api/verify', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({transcript: text, kind: requestKind, context, preparation}), signal: controller.signal});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'La recherche a échoué.');
    const checks = archive.completeSubmission(current.record, result);
    current.record.checked_at = result.checked_at;
    settled = true; for (const card of provisional) card.remove();
    current.pending.remove();
    for (const check of checks) current.group.insertBefore(renderCheck(check), current.excerpt);
    entryCount += checks.length;
    ui['feed-count'].textContent = `${entryCount} éclairage${entryCount > 1 ? 's' : ''}`;
    if (!companion.classList.contains('is-open')) {
      unreadCount += checks.length; ui.unread.textContent = unreadCount; ui.unread.hidden = false;
      announceFollowUp(checks);
    }
    if (kind !== 'live' && ui.transcript.value.trim() === text) { ui.transcript.value = ''; updateComposer(); }
  } catch (error) {
    current.record.status = 'failed'; current.record.error = error.name === 'AbortError' ? 'Délai de recherche dépassé.' : error.message;
    settled = true;
    for (const card of provisional) card.querySelector('.provisional-note').textContent = 'La vérification complète a échoué : cette piste reste non vérifiée.';
    current.pending.remove();
    const failure = node('div', 'result-card failed-search');
    failure.append(node('span', 'verdict unsure', 'Recherche interrompue'), node('p', 'result-summary', error.name === 'AbortError' ? 'La recherche prend trop de temps. Réessayez avec un extrait plus court.' : error.message));
    const retry = node('button', 'retry-button', 'Réessayer'); retry.type = 'button';
    retry.onclick = () => runVerification(text, kind, current); failure.append(retry);
    current.group.insertBefore(failure, current.excerpt);
  } finally {
    clearTimeout(timeout); busy = false; updateStatus(); scheduleLive(); updateArchiveCount();
  }
  return true;
}

function scheduleLive() {
  clearTimeout(liveTimer);
  if (!wantedListening || busy || configured !== true || pendingSpeech.trim().length < 10) return;
  // Flush after a short pause, or after eight seconds of continuous final results.
  const pause = priorityLive ? 600 : Math.min(2500, Math.max(0, 8000 - (Date.now() - pendingSince)));
  const cooldown = priorityLive ? 0 : Math.max(0, 20000 - (Date.now() - lastRequest));
  liveTimer = setTimeout(flushLive, Math.max(pause, cooldown));
  ui['live-queue'].textContent = priorityLive ? 'Mot-clé repéré : vérification prioritaire.' : cooldown > 2500 ? 'Extrait en attente de la prochaine recherche…' : 'L’extrait sera vérifié après une courte pause.';
}
async function flushLive() {
  if (!wantedListening || busy || configured !== true) return;
  const text = pendingSpeech.trim();
  if (text.length < 10) return;
  const transcriptIds = pendingTranscriptIds;
  pendingSpeech = ''; pendingSince = 0; pendingTranscriptIds = []; priorityLive = false;
  ui['live-queue'].textContent = 'Recherche en cours. L’écoute continue.';
  const accepted = await runVerification(text, 'live', null, transcriptIds);
  if (!accepted) {
    pendingSpeech = `${text} ${pendingSpeech}`.trim();
    pendingTranscriptIds = [...transcriptIds, ...pendingTranscriptIds];
    if (!pendingSince) pendingSince = Date.now();
  }
}
function stopListening() {
  microphoneEpoch++;
  if (wantedListening || listening) archive.recordCapture('microphone_stopped');
  wantedListening = false; listening = false;
  clearTimeout(liveTimer); clearTimeout(restartTimer);
  if (recognition) { try { recognition.stop(); } catch { /* Already stopped. */ } }
  if (microphoneCapture) captureCompletion = microphoneCapture.stop();
  if (!ui['live-preview'].hidden) ui['live-queue'].textContent = 'Écoute en pause. Vous pouvez la reprendre avec la bulle.';
  if (desktop) ui['live-preview'].hidden = true;
  updateStatus();
  return captureCompletion;
}
async function startListening() {
  setPanelOpen(true);
  if (desktop) {
    if (wantedListening || endingSession) return;
    if (!window.interpreteRecordOnly && !configured && !await refreshConfiguration()) { toggleSettings(true); return; }
    wantedListening = true; ui.error.hidden = true; updateStatus();
    ui['live-preview'].hidden = false;
    ui['live-queue'].textContent = window.interpreteRecordOnly ? 'Enregistrement local hors ligne · aucun audio envoyé à OpenAI.' : 'Transcription par extraits de 12 secondes · audio envoyé à OpenAI.';
    const epoch = ++microphoneEpoch;
    const capture = new window.InterpreteMicrophone({
      transcribe: (audio, mimeType) => desktop.transcribe(audio, mimeType),
      onText: (text, audioRef) => { acceptSpeech(text, audioRef); ui['live-transcript'].textContent = finalPreview; scheduleLive(); },
      onError: message => { archive.recordCapture('transcription_interrupted'); if (epoch === microphoneEpoch) stopListening(); showError(message); }
    });
    microphoneCapture = capture;
    try {
      await capture.start();
      if (!wantedListening || epoch !== microphoneEpoch) { capture.stop(); return; }
      listening = true; archive.recordCapture('microphone_started'); updateStatus();
    } catch { stopListening(); showError('Le micro est indisponible ou son accès a été refusé. Vérifiez les permissions du système.'); }
    return;
  }
  if (!recognition) {
    showError('Ce navigateur ne propose pas la transcription au micro. Utilisez Chrome sur ordinateur ou saisissez le contenu ci-dessous.');
    ui.transcript.focus(); return;
  }
  if (!window.isSecureContext) { showError('Le micro nécessite une connexion HTTPS ou une ouverture sur localhost.'); return; }
  if (wantedListening) return;
  ui.error.hidden = true; wantedListening = true; restartCount = 0;
  ui['live-preview'].hidden = false;
  try { recognition.start(); updateStatus(); }
  catch { stopListening(); showError('Le micro n’est pas encore disponible. Réessayez dans un instant.'); }
}
function acceptSpeech(text, audioRef = null) {
  pendingTranscriptIds.push(archive.recordTranscript(text, audioRef)); updateArchiveCount();
  if (!pendingSince) pendingSince = Date.now();
  pendingSpeech = `${pendingSpeech} ${text}`.trim();
  finalPreview = `${finalPreview} ${text}`.trim().slice(-600);
  // F3: a watched keyword or figure skips the wait between automatic searches.
  if (window.InterpretePreparation?.matches(text)) priorityLive = true;
}
if (recognition) {
  recognition.lang = 'fr-FR'; recognition.continuous = true; recognition.interimResults = true;
  recognition.onstart = () => {
    if (!wantedListening) { recognition.stop(); return; }
    archive.recordCapture('microphone_started'); listening = true; updateStatus(); scheduleLive();
  };
  recognition.onresult = event => {
    if (!wantedListening) return;
    restartCount = 0; window.InterpreteOrb?.pulse(0.7);
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript.trim();
      if (!text) continue;
      if (event.results[i].isFinal) {
        acceptSpeech(text);
      } else interim += ` ${text}`;
    }
    ui['live-transcript'].textContent = `${finalPreview} ${interim}`.trim() || 'En attente de votre voix…';
    if (pendingSpeech.length > 18000) {
      // Preserve the pending excerpt for manual verification rather than dropping speech.
      stopListening();
      if (!ui.transcript.value.trim()) { ui.transcript.value = pendingSpeech.slice(0, 20000); updateComposer(); pendingSpeech = ''; pendingSince = 0; pendingTranscriptIds = []; }
      showError('Un long extrait est en attente. Vérifiez-le avant de reprendre l’écoute.');
      return;
    }
    if (configured === false) ui['live-queue'].textContent = 'Transcription active · recherche de sources non configurée.';
    scheduleLive();
  };
  recognition.onerror = event => {
    if (event.error === 'no-speech' || (event.error === 'aborted' && !wantedListening)) return;
    const messages = {
      'not-allowed': 'Le micro n’a pas été autorisé. Activez-le dans les permissions du navigateur.',
      'service-not-allowed': 'Le service de transcription est désactivé dans ce navigateur.',
      'audio-capture': 'Aucun micro disponible. Vérifiez le branchement et l’entrée audio choisie.',
      'network': 'La transcription a perdu sa connexion. Vous pouvez relancer l’écoute ou saisir un texte.'
    };
    stopListening(); showError(messages[event.error] || 'L’écoute a été interrompue. Vous pouvez la relancer.');
  };
  recognition.onend = () => {
    listening = false; updateStatus();
    if (!wantedListening) return;
    if (++restartCount > 3) { stopListening(); showError('Le navigateur a arrêté l’écoute. Cliquez sur la bulle pour la reprendre.'); return; }
    restartTimer = setTimeout(() => {
      if (!wantedListening) return;
      try { recognition.start(); } catch { stopListening(); showError('Impossible de reprendre le micro. Cliquez pour réessayer.'); }
    }, 600);
  };
}

ui.bubble.onclick = () => { setPanelOpen(true); wantedListening ? stopListening() : startListening(); };
ui.microphone.onclick = () => wantedListening ? stopListening() : startListening();
ui.collapse.onclick = () => setPanelOpen(false);
ui['dismiss-error'].onclick = () => { ui.error.hidden = true; };
ui.composer.onsubmit = event => {
  event.preventDefault();
  const text = ui.transcript.value.trim();
  if (text.length < 10) return showError('Ajoutez une phrase d’au moins 10 caractères, un article ou un lien.');
  runVerification(text, /^https?:\/\/\S+$/i.test(text) ? 'url' : 'text');
};
ui.transcript.addEventListener('input', updateComposer);
ui.transcript.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); ui.composer.requestSubmit(); }
});
ui.example.onclick = () => { ui.transcript.value = 'La Grande Muraille de Chine est visible à l’œil nu depuis la Lune.'; updateComposer(); ui.transcript.focus(); };
companion.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (!ui['settings-tray'].hidden) toggleSettings(false);
    else if (!ui['archive-tray'].hidden) toggleArchive(false); else setPanelOpen(false);
  }
});
document.getElementById('open-assistant').onclick = () => { setPanelOpen(true); if (floatingWindow) floatingWindow.focus(); ui.transcript.focus(); };

function toggleArchive(open) {
  ui['archive-tray'].hidden = !open; ui['archive-button'].setAttribute('aria-expanded', String(open));
}
ui['archive-button'].onclick = () => toggleArchive(ui['archive-tray'].hidden);
ui['export-json'].onclick = async () => {
  try { const saved = await archive.exportJson(); if (saved !== false) ui['archive-status'].textContent = 'Archive JSON exportée. Elle pourra servir de contexte à une prochaine interview.'; }
  catch { ui['archive-status'].textContent = 'L’archive n’a pas pu être enregistrée. Réessayez.'; }
};
ui['export-html'].onclick = async () => {
  if (busy || endingSession) return;
  endingSession = true; updateStatus();
  ui['archive-status'].textContent = 'Fin de la transcription avant l’export…';
  await stopListening();
  if (pendingSpeech.trim().length >= 10 && configured === true) {
    const text = pendingSpeech.trim(), transcriptIds = pendingTranscriptIds;
    pendingSpeech = ''; pendingSince = 0; pendingTranscriptIds = [];
    ui['archive-status'].textContent = 'Vérification du dernier extrait avant l’export…';
    await runVerification(text, 'live', null, transcriptIds);
  }
  try {
    const saved = await archive.exportHtml();
    if (saved !== false) { ui['archive-status'].textContent = 'Compte rendu HTML exporté, avec la transcription et la carte. Conservez aussi le JSON pour les comparaisons futures.'; markUnsaved(false); }
    else ui['archive-status'].textContent = 'Enregistrement annulé. La session est toujours disponible.';
  } catch { ui['archive-status'].textContent = 'L’archive n’a pas pu être enregistrée. La session reste disponible.'; }
  finally { endingSession = false; updateStatus(); }
};
ui['import-archive'].onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Choisissez une archive de moins de 5 Mo.');
    const count = archive.importArchive(JSON.parse(await file.text()));
    ui['past-count'].textContent = `${archive.session.references.length} propos antérieurs disponibles. Les 12 derniers seront proposés comme contexte aux prochaines recherches.`;
    ui['archive-status'].textContent = `${count} propos importé${count > 1 ? 's' : ''}. Les connexions apparaîtront au fil des prochaines vérifications.`;
  } catch (error) { ui['archive-status'].textContent = error instanceof SyntaxError ? 'Ce fichier n’est pas une archive JSON valide.' : error.message; }
  event.target.value = '';
};

function toggleSettings(open) {
  ui['settings-tray'].hidden = !open; ui['settings-button'].setAttribute('aria-expanded', String(open));
  if (open) { toggleArchive(false); (desktop ? ui['api-key'] : ui['settings-tray'].querySelector('select'))?.focus(); }
}
ui['settings-button'].onclick = () => toggleSettings(ui['settings-tray'].hidden);
if (desktop) {
  document.documentElement.classList.add('desktop-root');
  document.body.classList.add('desktop-mode');
  document.getElementById('key-settings').hidden = false; ui['quit-desktop'].hidden = false;
  ui.detach.hidden = true;
  ui['quit-desktop'].onclick = () => desktop.quit();
  desktop.onOpen(() => { if(!window.InterpreteLauncher)setPanelOpen(true); });
  desktop.onService?.(state => {
    if (state === 'restarting') showError('Le service de recherche s’est arrêté. Redémarrage en cours ; votre session est conservée.');
    else if (state === 'ready') { ui.error.hidden = true; refreshConfiguration(); }
    else showError('Le service de recherche ne redémarre pas. Exportez votre session depuis l’archive, puis relancez Interprete.');
  });
  desktop.settings().then(settings => {
    ui['remember-key'].disabled = !settings.canRemember;
    if (!settings.canRemember) ui['storage-help'].textContent = 'Aucun coffre sécurisé disponible : la clé restera uniquement en mémoire.';
  });
  ui['key-form'].onsubmit = async event => {
    event.preventDefault(); ui['save-key'].disabled = true;
    try {
      await desktop.saveKey(ui['api-key'].value.trim(), ui['remember-key'].checked);
      ui['api-key'].value = ''; ui['settings-status'].textContent = 'Clé configurée. La prochaine recherche vérifiera l’accès au service.';
      await refreshConfiguration();
    } catch (error) { ui['settings-status'].textContent = error.message; }
    finally { ui['save-key'].disabled = false; }
  };
} else if (!window.documentPictureInPicture) {
  ui.detach.disabled = true;
  ui.detach.title = 'La fenêtre flottante nécessite Chrome sur ordinateur. Le volet reste disponible ici.';
} else {
  ui.detach.onclick = async () => {
    if (floatingWindow) { floatingWindow.close(); return; }
    try {
      floatingSize = {width: Math.min(460, Math.max(360, Math.round(screen.availWidth / 4))), height: Math.min(780, Math.max(480, screen.availHeight - 100))};
      floatingWindow = await window.documentPictureInPicture.requestWindow(floatingSize);
      const pip = floatingWindow;
      pip.document.title = 'Interprete'; pip.document.documentElement.lang = 'fr';
      // Carry the theme and companion classes over: the floating window has its own <html> and <body>.
      pip.document.documentElement.dataset.theme = document.documentElement.dataset.theme || 'pastel';
      pip.document.body.className = ['pip-body', ...[...document.body.classList].filter(name => name !== 'is-detached')].join(' ');
      const stylesheet = pip.document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = new URL('/style.css', window.location.href).href;
      pip.document.head.append(stylesheet);
      pip.document.body.append(document.querySelector('.icon-library').cloneNode(true), companion);
      document.body.classList.add('is-detached'); document.getElementById('detached-message').hidden = false;
      ui.detach.setAttribute('aria-label', 'Ramener Interprete dans l’onglet'); ui.detach.title = 'Ramener dans l’onglet';
      setPanelOpen(true);
      pip.addEventListener('pagehide', () => {
        stopListening();
        for (const name of pip.document.body.classList) if (name !== 'pip-body') document.body.classList.add(name);
        if (!pip.document.body.classList.contains('launcher-visible')) document.body.classList.remove('launcher-visible');
        document.body.append(companion); floatingWindow = null;
        document.body.classList.remove('is-detached'); document.getElementById('detached-message').hidden = true;
        ui.detach.setAttribute('aria-label', 'Ouvrir en fenêtre flottante'); ui.detach.title = 'Rester au-dessus des autres applications';
        setPanelOpen(true);
      }, {once: true});
    } catch {
      if (floatingWindow) floatingWindow.close();
      floatingWindow = null;
      showError('La fenêtre flottante est indisponible. Essayez dans Chrome sur ordinateur ; le volet reste accessible ici.');
    }
  };
}
window.addEventListener('pagehide', stopListening);
updateComposer();
refreshConfiguration().then(() => { scheduleLive(); });

// Appearance preferences contain no interview data or API credentials.
// UI2: the ambiance lives in the settings tray and follows the system (light → Pastel, dark → Sombre) by default.
(() => {
  const themes = {pastel: 'Pastel', dark: 'Sombre', matrix: 'Matrix', investigation: 'Enquête', fire: 'Feu'};
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const label = document.createElement('label'); label.className = 'theme-control';
  label.textContent = 'Ambiance ';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Thème de l’interface');
  for (const [value, text] of [['auto', 'Automatique (système)'], ...Object.entries(themes)]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
  }
  const hint = document.createElement('p'); hint.className = 'settings-hint';
  const stored = () => { try { return localStorage.getItem('interprete-theme'); } catch { return null; } };
  const valid = value => value === 'auto' || Object.hasOwn(themes, value);
  let choice = valid(stored()) ? stored() : 'auto';
  const resolve = value => value === 'auto' ? (scheme.matches ? 'dark' : 'pastel') : value;
  let current = '';
  function apply(value, notify = true) {
    choice = valid(value) ? value : 'auto'; select.value = choice;
    const theme = resolve(choice);
    hint.textContent = choice === 'auto' ? `Suit le réglage clair ou sombre du système : ${themes[theme]} en ce moment.` : 'Ambiance fixe, quel que soit le réglage du système.';
    document.documentElement.dataset.theme = theme; companion.ownerDocument.documentElement.dataset.theme = theme;
    if (notify && theme !== current) window.interpreteDesktop?.setTheme?.(theme)?.catch(() => {});
    current = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'pastel' ? '#f3eff9' : theme === 'matrix' ? '#030c08' : theme === 'fire' ? '#140c0a' : '#10131d');
  }
  apply(choice, false);
  scheme.addEventListener?.('change', () => { if (choice === 'auto') apply('auto'); });
  select.onchange = () => { apply(select.value); try { localStorage.setItem('interprete-theme', choice); } catch {} };
  // Native shells only store concrete themes; the launcher asks here whether a stored native theme should win.
  window.InterpreteTheme = Object.freeze({ choice: () => choice, stored: () => (valid(stored()) ? stored() : null), resolved: () => resolve(choice) });
  label.append(select); document.getElementById('appearance-settings').append(label, hint);
})();

(() => {
  const tools = document.createElement('details'); tools.className = 'osint-tools';
  const title = document.createElement('summary'); title.textContent = 'Atelier OSINT · rechercher des sources'; tools.append(title);
  const note = document.createElement('p'); note.textContent = 'Au clic, le texte saisi est transmis à Google pour rechercher dans le site choisi. Les résultats restent à examiner ; ils ne constituent pas une validation.'; tools.append(note);
  const providers = [
    ['INSEE', 'site:insee.fr'], ['Eurostat', 'site:ec.europa.eu/eurostat'],
    ['Légifrance', 'site:legifrance.gouv.fr'], ['Vie publique', 'site:vie-publique.fr'],
    ['AFP Factuel', 'site:factuel.afp.com'], ['Publications scientifiques', 'site:pubmed.ncbi.nlm.nih.gov']
  ];
  const links = document.createElement('div');
  for (const [name, scope] of providers) {
    const link = document.createElement('a'); link.textContent = name; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.href = 'https://www.google.com/search?q=' + encodeURIComponent(scope);
    link.addEventListener('click', () => {
      const query = ui.transcript.value.trim().slice(0, 600);
      link.href = 'https://www.google.com/search?q=' + encodeURIComponent(scope + ' ' + query);
    }); links.append(link);
  }
  tools.append(links); document.querySelector('.composer').after(tools);
})();


window.prepareInterpreteArchive = async () => {
  if (busy || endingSession) throw new Error('Attendez la fin de la recherche ou de l’export en cours.');
  endingSession=true;updateStatus();
  try {
    await stopListening();
    if(pendingSpeech.trim().length>=10 && configured===true) {
      const text=pendingSpeech.trim(), identities=pendingTranscriptIds;
      pendingSpeech='';pendingSince=0;pendingTranscriptIds=[];
      await runVerification(text,'live',null,identities);
    }
    return archive.snapshot();
  } finally {endingSession=false;updateStatus();}
};
