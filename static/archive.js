'use strict';

// A session stays in memory. Exported files are the only persisted copy.
window.InterpreteArchive = (() => {
  const labels = {contradiction_potentielle: 'Incohérence à examiner', concordance: 'Concordance', nuance: 'Nuance', contexte: 'Mise en contexte'};
  const id = prefix => `${prefix}_${crypto.randomUUID()}`;
  const now = () => new Date().toISOString();
  const text = (value, limit = 20000) => typeof value === 'string' ? value.slice(0, limit) : '';
  const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  const session = {app: 'Interprete', version: 1, id: id('session'), created_at: now(), transcript: [], captures: [], submissions: [], references: []};

  function allClaims() {
    return session.submissions.flatMap(entry => (entry.checks || []).map(check => ({...check, original_text: entry.text, at: entry.at, session_title: 'Cette session'})));
  }
  function recordTranscript(value) {
    const record = {id: id('speech'), at: now(), text: value, speaker: 'non_identifie'};
    session.transcript.push(record); return record.id;
  }
  function recordCapture(action) { session.captures.push({at: now(), action}); }
  function createSubmission(value, kind, transcriptIds = []) {
    const entry = {id: id('entry'), at: now(), kind, text: value, transcript_ids: [...transcriptIds], status: 'pending', checks: []};
    session.submissions.push(entry); return entry;
  }
  function completeSubmission(entry, result) {
    const checks = result.checks?.length ? result.checks : [{claim: 'Éclairage sur l’extrait', verdict: result.has_sources ? 'Éclairage' : 'Informations insuffisantes', summary: result.analysis, sources: result.sources}];
    entry.status = 'completed'; delete entry.error;
    entry.checks = checks.map(check => ({...check, id: id('claim')}));
    return entry.checks;
  }
  function context() {
    const local = allClaims().slice(-12);
    const past = session.references.slice(-12);
    return [...local, ...past].map(claim => ({id: claim.id, claim: text(claim.claim, 600), summary: text(claim.summary, 400), original_text: text(claim.original_text, 1000), at: text(claim.at, 80), session_title: text(claim.session_title, 120)}));
  }
  function lookup(identity) { return [...allClaims(), ...session.references].find(claim => claim.id === identity); }
  function importArchive(raw) {
    if (!raw || raw.app !== 'Interprete' || raw.version !== 1 || !safeId(raw.id) || !Array.isArray(raw.submissions)) throw new Error('Choisissez une archive JSON exportée par Interprete.');
    if (raw.id === session.id) throw new Error('Cette archive appartient à la session en cours. Choisissez une interview précédente.');
    if (raw.submissions.length > 1000) throw new Error('Cette archive contient trop d’entrées.');
    const candidates = [];
    const date = typeof raw.created_at === 'string' && Number.isFinite(Date.parse(raw.created_at)) ? new Date(raw.created_at).toLocaleDateString('fr-FR') : 'date inconnue';
    for (const entry of raw.submissions) {
      if (!entry || !Array.isArray(entry.checks)) continue;
      for (const claim of entry.checks.slice(0, 3)) {
        if (!claim || !safeId(claim.id) || !text(claim.claim)) continue;
        candidates.push({id: claim.id, claim: text(claim.claim, 600), verdict: text(claim.verdict, 80), summary: text(claim.summary, 3000), original_text: text(entry.text, 20000), at: text(entry.at, 80), session_title: `Archive du ${date}`, sources: Array.isArray(claim.sources) ? claim.sources.filter(source => source && typeof source.url === 'string').slice(0, 12).map(source => ({url: text(source.url, 2000), title: text(source.title, 400)})) : []});
      }
    }
    if (!candidates.length) throw new Error('Cette archive ne contient pas encore d’affirmations vérifiées à comparer.');
    const known = new Set([...allClaims(), ...session.references].map(claim => claim.id));
    const additions = candidates.filter(claim => !known.has(claim.id) && known.add(claim.id));
    const retained = additions.slice(-200);
    session.references.push(...retained);
    return retained.length;
  }
  function snapshot() {
    return JSON.parse(JSON.stringify({...session, exported_at: now()}));
  }
  async function download(content, extension, mime) {
    const name = `interprete-${session.created_at.slice(0, 10)}-${session.id.slice(-6)}.${extension}`;
    if (window.interpreteDesktop) return window.interpreteDesktop.saveArchive(content, extension, name);
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function exportJson() { return download(JSON.stringify(snapshot(), null, 2), 'json', 'application/json;charset=utf-8'); }
  function exportHtml() {
    const data = JSON.stringify(snapshot()).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return download(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Interprete — Archive de session</title><style>${viewerStyles}</style></head><body><header><span class="brand">Interprete <small>Archive de session</small></span><button id="print">Imprimer / PDF</button></header><main><p class="eyebrow" id="date"></p><h1>Les propos. Les faits.<br>Les connexions.</h1><p id="stats" class="muted"></p><p class="notice">Transcription automatique à relire : elle peut comporter des erreurs. Les connexions sont des pistes proposées par un modèle, à confronter au contexte et aux sources. Aucun enregistrement audio n’est inclus.</p><nav><a href="#transcription">Transcription</a><a href="#mindmap">Carte des connexions</a><a href="#verifications">Vérifications</a></nav><section id="transcription"><h2>01 · Ce qui a été entendu</h2><p class="muted">Les fragments définitifs du moteur de transcription, conservés dans leur ordre d’origine. Les heures correspondent à leur réception.</p><div id="transcript-list"></div></section><section id="mindmap"><h2>02 · La carte des connexions</h2><p class="muted">Cliquez sur un nœud pour isoler ses liens, puis sur son titre pour lire le détail. La carte relie les extraits aux affirmations, aux sources et aux propos antérieurs.</p><div class="map-tools"><button id="map-all" aria-pressed="true">Tous les liens</button><button id="map-conflicts" aria-pressed="false">Incohérences à examiner</button><span>Zoom</span><button id="zoom-out" aria-label="Réduire la carte">−</button><button id="zoom-in" aria-label="Agrandir la carte">+</button></div><p class="legend"><span class="gray">Extrait → affirmation</span><span class="green">Source citée</span><span class="red">Incohérence potentielle</span><span class="purple">Concordance / nuance / contexte</span></p><div class="map-scroll"><svg id="graph" role="img" aria-label="Carte des propos, vérifications, sources et connexions"></svg></div><div id="map-selection" class="map-selection" aria-live="polite"></div></section><section id="verifications"><h2>03 · Les éclairages et leurs preuves</h2><div id="verification-list"></div></section><section id="past" hidden><h2>04 · Propos antérieurs reliés</h2><div id="past-list"></div></section><footer>Fichier autonome, consultable hors ligne. Les liens vers les sources nécessitent une connexion. Pour comparer une autre interview à celle-ci, conservez aussi l’export JSON.</footer></main><script type="application/json" id="archive-data">${data}</script><script>(${archiveViewer.toString()})();</script></body></html>`, 'html', 'text/html;charset=utf-8');
  }

  // This function is embedded in the standalone HTML; it must have no external dependencies.
  function archiveViewer() {
    const data = JSON.parse(document.getElementById('archive-data').textContent);
    const relationLabels = {contradiction_potentielle: 'Incohérence à examiner', concordance: 'Concordance', nuance: 'Nuance', contexte: 'Mise en contexte'};
    const $ = identity => document.getElementById(identity);
    const element = (tag, className, content) => {
      const el = document.createElement(tag); if (className) el.className = className;
      if (content !== undefined) el.textContent = content; return el;
    };
    const formatTime = value => {
      const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit'}) : 'Heure inconnue';
    };
    const safeLink = value => {
      try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null; } catch { return null; }
    };
    const sourcesFor = (container, sources) => {
      const list = element('ul', 'sources');
      for (const source of sources || []) {
        const url = safeLink(source.url); if (!url) continue;
        const li = element('li'); const a = element('a', '', source.title || url.hostname);
        a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        li.append(a, element('small', '', url.hostname)); list.append(li);
      }
      if (list.children.length) container.append(list);
    };
    const local = data.submissions.flatMap(entry => (entry.checks || []).map(check => ({...check, entry, at: entry.at})));
    const claimsById = new Map([...local, ...(data.references || [])].map(claim => [claim.id, claim]));
    const linkedPast = new Set(local.flatMap(check => (check.connections || []).map(connection => connection.target_id)).filter(identity => !local.some(check => check.id === identity)));
    const past = (data.references || []).filter(claim => linkedPast.has(claim.id));
    const connectionCount = local.reduce((sum, claim) => sum + (claim.connections || []).filter(connection => claimsById.has(connection.target_id)).length, 0);
    $('date').textContent = `SESSION DU ${new Date(data.created_at).toLocaleDateString('fr-FR')} · EXPORTÉE LE ${new Date(data.exported_at).toLocaleString('fr-FR')}`;
    $('stats').textContent = `${data.transcript.length} fragment(s) transcrit(s) · ${local.length} affirmation(s) examinée(s) · ${connectionCount} connexion(s)`;
    $('print').onclick = () => window.print();
    if (data.evidence?.length) {
      const section = element('section'); section.id = 'evidence';
      section.append(element('h2', '', 'Pièces du dossier'), element('p', 'notice', 'Inventaire et annotations : les fichiers originaux ne sont pas incorporés à ce compte rendu. Une empreinte identifie un contenu ; elle ne certifie ni son origine ni sa véracité.'));
      for (const item of data.evidence) {
        const card = element('article', 'claim');
        card.append(element('h3', '', item.name), element('p', 'muted', `Collecte : ${item.collected_at} · ${item.size} octets · SHA-256 ${item.sha256}`));
        if (item.notes) card.append(element('p', '', item.notes));
        if (item.source) sourcesFor(card, [{url:item.source, title:'Provenance renseignée'}]);
        if (item.claim_id && claimsById.has(item.claim_id)) {
          const link = element('a', '', 'Voir l’affirmation associée'); link.href = '#' + item.claim_id; card.append(link);
        }
        section.append(card);
      }
      $('verifications').before(section);
    }

    if (!data.transcript.length) $('transcript-list').append(element('p', 'muted', 'Aucune transcription micro dans cette session. Les textes et liens soumis sont conservés ci-dessous.'));
    for (const fragment of data.transcript) {
      const row = element('div', 'transcript-row'); row.id = fragment.id;
      row.append(element('time', '', formatTime(fragment.at)), element('p', '', fragment.text)); $('transcript-list').append(row);
    }
    function renderClaim(claim, isPast = false) {
      const card = element('article', 'claim'); card.id = claim.id;
      const top = element('div', 'claim-top'); top.append(element('span', `badge ${claim.verdict === 'Contredit' ? 'red' : claim.verdict === 'Confirmé' ? 'green' : 'purple'}`, claim.verdict || 'À examiner'), element('time', '', isPast ? claim.session_title : formatTime(claim.at))); card.append(top);
      card.append(element('h3', '', claim.claim), element('p', '', claim.summary || ''));
      if (claim.reasoning) card.append(element('p', 'muted', claim.reasoning));
      if (claim.evidence?.length) {
        const list = element('ol'); for (const point of claim.evidence) list.append(element('li', '', point)); card.append(list);
      }
      if (claim.follow_up) { const box = element('div', 'connection'); box.append(element('strong', '', 'Pour rebondir · piste de relance'), element('p', '', claim.follow_up)); card.append(box); }
      for (const limitation of claim.limitations || []) card.append(element('p', 'muted', `Réserve : ${limitation}`));
      for (const excerpt of claim.source_excerpts || []) {
        const quote = element('blockquote'); quote.append(element('small', '', 'Extrait proposé, à relire dans le document'), element('p', '', excerpt.quote));
        sourcesFor(quote, [{url: excerpt.url, title: excerpt.published_at ? `Date indiquée : ${excerpt.published_at}` : 'Document original'}]); card.append(quote);
      }
      for (const connection of claim.connections || []) {
        const target = claimsById.get(connection.target_id); if (!target) continue;
        const box = element('div', `connection ${connection.relation === 'contradiction_potentielle' ? 'conflict' : ''}`);
        box.append(element('strong', '', relationLabels[connection.relation] || 'Connexion'));
        const a = element('a', '', `« ${target.claim} »`); a.href = `#${target.id}`;
        box.append(a, element('p', '', connection.explanation || ''), element('small', '', target.session_title || 'Plus tôt dans cette session')); card.append(box);
      }
      sourcesFor(card, claim.sources);
      if (!claim.sources?.length) card.append(element('p', 'muted', 'Aucune source web associée à cette analyse.'));
      return card;
    }
    for (const entry of data.submissions) {
      const section = element('section', 'submission'); section.id = entry.id;
      section.append(element('h3', 'entry-title', `${entry.kind === 'live' ? 'En direct' : entry.kind === 'url' ? 'Lien partagé' : 'Texte partagé'} · ${formatTime(entry.at)}`));
      const excerpt = element('details'); const summary = element('summary', '', 'Relire les propos exacts soumis à la vérification'); excerpt.append(summary, element('blockquote', '', entry.text));
      section.append(excerpt);
      if (entry.transcript_ids?.length) {
        const links = element('p', 'transcript-links', 'Dans la transcription : ');
        for (const identity of entry.transcript_ids) {
          const fragment = data.transcript.find(part => part.id === identity); if (!fragment) continue;
          const a = element('a', '', formatTime(fragment.at)); a.href = `#${identity}`; links.append(a, document.createTextNode(' '));
        }
        section.append(links);
      }
      if (!entry.checks?.length) section.append(element('p', 'muted', entry.status === 'failed' ? `Recherche non aboutie : ${entry.error || 'erreur du service'}` : 'Vérification non terminée au moment de l’export.'));
      for (const check of local.filter(claim => claim.entry.id === entry.id)) section.append(renderClaim(check));
      $('verification-list').append(section);
    }
    if (!data.submissions.length) $('verification-list').append(element('p', 'muted', 'Aucune vérification soumise dans cette session.'));
    if (past.length) { $('past').hidden = false; for (const claim of past) {
      const card = renderClaim(claim, true);
      if (claim.original_text) { const d = element('details'); d.append(element('summary', '', 'Propos d’origine'), element('blockquote', '', claim.original_text)); card.append(d); }
      $('past-list').append(card);
    } }

    const nodes = [], edges = [], sourceNodes = new Map();
    const clip = (value, length = 90) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
    for (const [index, entry] of data.submissions.entries()) nodes.push({id: `quote_${entry.id}`, x: 150, y: 90 + index * 94, label: clip(entry.text), category: 'Propos d’origine', href: `#${entry.id}`, kind: 'quote'});
    for (const [index, claim] of local.entries()) {
      nodes.push({id: claim.id, x: 465, y: 90 + index * 94, label: clip(claim.claim), category: claim.verdict || 'À examiner', href: `#${claim.id}`, kind: 'claim'});
      edges.push({from: `quote_${claim.entry.id}`, to: claim.id, label: 'Propos examiné', kind: 'quote'});
      for (const source of claim.sources || []) {
        const url = safeLink(source.url); if (!url) continue;
        if (!sourceNodes.has(url.href)) {
          const sourceNode = {id: `source_${sourceNodes.size}`, x: 780, y: 90 + sourceNodes.size * 94, label: clip(source.title || url.hostname), category: url.hostname, href: url.href, kind: 'source'};
          sourceNodes.set(url.href, sourceNode); nodes.push(sourceNode);
        }
        edges.push({from: claim.id, to: sourceNodes.get(url.href).id, label: 'Source citée', kind: 'source'});
      }
      for (const connection of claim.connections || []) {
        if (claimsById.has(connection.target_id)) edges.push({from: claim.id, to: connection.target_id, label: relationLabels[connection.relation] || 'Connexion', description: connection.explanation || '', kind: connection.relation === 'contradiction_potentielle' ? 'conflict' : 'connection'});
      }
    }
    for (const [index, claim] of past.entries()) nodes.push({id: claim.id, x: 1095, y: 90 + index * 94, label: clip(claim.claim), category: claim.session_title || 'Propos antérieur', href: `#${claim.id}`, kind: 'past'});
    const positions = new Map(nodes.map(item => [item.id, item]));
    const svg = $('graph'), namespace = 'http://www.w3.org/2000/svg';
    const height = Math.max(340, ...nodes.map(item => item.y + 70));
    const width = past.length ? 1250 : sourceNodes.size ? 935 : 620;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.style.width = `${width}px`; svg.style.height = `${height}px`;
    const svgElement = (tag, attributes = {}) => { const el = document.createElementNS(namespace, tag); for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value); return el; };
    const defs = svgElement('defs');
    for (const color of ['#c8c3d2', '#97bbaa', '#c88b80', '#a89bc9']) {
      const marker = svgElement('marker', {id: `arrow${color.slice(1)}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse'});
      marker.append(svgElement('path', {d: 'M 0 0 L 10 5 L 0 10 z', fill: color})); defs.append(marker);
    }
    svg.append(defs);
    for (const [x, label] of [[150, 'PROPOS D’ORIGINE'], [465, 'AFFIRMATIONS EXAMINÉES'], ...(sourceNodes.size ? [[780, 'SOURCES CITÉES']] : []), ...(past.length ? [[1095, 'PROPOS ANTÉRIEURS']] : [])]) {
      const title = svgElement('text', {x, y: 28, 'text-anchor': 'middle', class: 'column-title'}); title.textContent = label; svg.append(title);
    }
    let selected = null, conflictsOnly = false, zoom = 1;
    const edgeElements = [], nodeElements = [];
    for (const edge of edges) {
      const start = positions.get(edge.from), end = positions.get(edge.to); if (!start || !end) continue;
      const sameColumn = start.x === end.x;
      const x1 = start.x + 127, x2 = sameColumn ? end.x + 127 : end.x - 127;
      const path = svgElement('path', {d: sameColumn ? `M${x1} ${start.y} C${x1 + 80} ${start.y},${x1 + 80} ${end.y},${x2} ${end.y}` : `M${x1} ${start.y} C${x1 + 60} ${start.y},${x2 - 60} ${end.y},${x2} ${end.y}`, fill: 'none', 'stroke-width': edge.kind === 'conflict' ? 2 : 1.2});
      const color = edge.kind === 'source' ? '#97bbaa' : edge.kind === 'conflict' ? '#c88b80' : edge.kind === 'connection' ? '#a89bc9' : '#c8c3d2';
      path.setAttribute('stroke', color); path.setAttribute('marker-end', `url(#arrow${color.slice(1)})`);
      if (edge.kind === 'conflict' || edge.kind === 'connection') path.setAttribute('stroke-dasharray', '5 4');
      const title = svgElement('title'); title.textContent = `${edge.label}${edge.description ? ' : ' + edge.description : ''}`; path.append(title);
      svg.append(path); edgeElements.push({edge, el: path});
    }
    function updateMap() {
      const visibleEdges = edges.filter(edge => (!conflictsOnly || edge.kind === 'conflict') && (!selected || edge.from === selected || edge.to === selected));
      const activeIds = new Set(visibleEdges.flatMap(edge => [edge.from, edge.to]));
      for (const {edge, el} of edgeElements) el.style.opacity = visibleEdges.includes(edge) ? '1' : '.06';
      for (const {item, el} of nodeElements) el.style.opacity = (!selected && !conflictsOnly) || activeIds.has(item.id) || item.id === selected ? '1' : '.2';
      $('map-selection').replaceChildren();
      if (selected) {
        const item = positions.get(selected); const a = element('a', '', item.label); a.href = item.href;
        if (item.kind === 'source') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        $('map-selection').append(a);
        for (const edge of visibleEdges.filter(edge => edge.description)) $('map-selection').append(element('p', '', `${edge.label} : ${edge.description}`));
      } else if (conflictsOnly && !visibleEdges.length) $('map-selection').append(element('p', '', 'Aucune incohérence potentielle n’a été signalée dans cette session. Cela ne démontre pas que tous les propos sont cohérents.'));
    }
    for (const item of nodes) {
      const group = svgElement('g', {transform: `translate(${item.x - 127},${item.y - 33})`, tabindex: 0, role: 'button', 'aria-label': `${item.category} : ${item.label}`, class: 'map-node'});
      group.append(svgElement('rect', {width: 254, height: 70, rx: 10, fill: item.kind === 'past' ? '#f1eef8' : item.kind === 'source' ? '#f1f7f3' : '#fff', stroke: '#e1ddea'}));
      const category = svgElement('text', {x: 12, y: 17, class: 'node-category'}); category.textContent = clip(item.category, 40); group.append(category);
      const words = item.label.split(/\s+/); const lines = []; let line = '';
      for (const word of words) { if ((line + ' ' + word).trim().length > 37 && line) { lines.push(line); line = word; } else line = `${line} ${word}`.trim(); }
      if (line) lines.push(line);
      lines.slice(0, 2).forEach((content, index) => { const t = svgElement('text', {x: 12, y: 37 + index * 15, class: 'node-label'}); t.textContent = content; group.append(t); });
      const choose = () => { selected = selected === item.id ? null : item.id; updateMap(); };
      group.addEventListener('click', choose); group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
      svg.append(group); nodeElements.push({item, el: group});
    }
    $('map-all').onclick = () => { conflictsOnly = false; selected = null; $('map-all').setAttribute('aria-pressed', 'true'); $('map-conflicts').setAttribute('aria-pressed', 'false'); updateMap(); };
    $('map-conflicts').onclick = () => { conflictsOnly = true; selected = null; $('map-all').setAttribute('aria-pressed', 'false'); $('map-conflicts').setAttribute('aria-pressed', 'true'); updateMap(); };
    const resize = direction => { zoom = Math.max(.5, Math.min(2, zoom + direction)); svg.style.width = `${width * zoom}px`; svg.style.height = `${height * zoom}px`; };
    $('zoom-in').onclick = () => resize(.15); $('zoom-out').onclick = () => resize(-.15);
    if (!nodes.length) $('map-selection').append(element('p', 'muted', 'La carte apparaîtra après les premières vérifications.'));
  }

  const viewerStyles = `:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#37313f;background:#f7f6f9;line-height:1.7}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}header{display:flex;align-items:center;justify-content:space-between;padding:25px 5vw;border-bottom:1px solid #e5e0eb;background:#fff}.brand{font-size:20px;font-weight:650}.brand small{font-size:12px;color:#8c8299;font-weight:400;margin-left:14px}main{max-width:1200px;margin:auto;padding:45px 5vw}h1{font-size:42px;line-height:1.2;font-weight:550;letter-spacing:-1.5px}h2{font-size:21px;font-weight:550;margin-top:0}h3{font-size:17px;line-height:1.5}p,li{font-size:14px}a{color:#7d659b;overflow-wrap:anywhere}button{border:1px solid #ddd6e7;border-radius:7px;padding:8px 12px;background:#fff;color:#756486;cursor:pointer}button:focus-visible,a:focus-visible,.map-node:focus{outline:2px solid #8b73af;outline-offset:3px}button[aria-pressed=true]{background:#ede7f5;color:#6d528e}.eyebrow{font-size:10px;letter-spacing:1px;color:#95869d}.muted{color:#8b7f96;font-size:13px}.notice{background:#eee9f4;padding:16px 20px;border-radius:12px;color:#897599;font-size:12px}nav{display:flex;gap:20px;flex-wrap:wrap;margin:28px 0}nav a{font-size:13px;text-decoration:none}main>section{padding:35px 0;border-top:1px solid #e6e0ed;scroll-margin-top:20px}.transcript-row{display:grid;grid-template-columns:85px 1fr;gap:20px;padding:10px 0;border-bottom:1px solid #eee8f2}.transcript-row time{font-size:11px;color:#aa9bb5;padding-top:2px}.transcript-row p{margin:0;white-space:pre-wrap}.transcript-row:target,.claim:target{background:#f0eaf7;outline:2px solid #b8a2d1;outline-offset:5px}.map-scroll{overflow:auto;max-height:650px;border:1px solid #e4ddeb;border-radius:14px;background:#fbfafd;padding:14px;margin-top:18px}.map-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.map-tools span{font-size:11px;color:#9a8ca6;margin-left:auto}.legend{display:flex;gap:15px;flex-wrap:wrap;font-size:10px}.legend span:before{content:'—';margin-right:5px}.gray{color:#aaa1b4}.green{color:#699c80}.red{color:#bb7d70}.purple{color:#9682ae}.column-title{fill:#9e8db0;font-size:10px;letter-spacing:.5px}.node-label{fill:#6f5f7e;font-size:11px}.node-category{fill:#a391b1;font-size:9px}.map-node{cursor:pointer;transition:opacity .2s}.map-selection{background:#eee8f4;padding:14px 18px;border-radius:10px;margin-top:12px;font-size:12px;min-height:45px}.map-selection p{font-size:12px}.submission{margin:25px 0 40px}.entry-title{color:#8f7d9e;font-size:12px;font-weight:500}.claim{padding:22px;background:white;border:1px solid #e5deec;border-radius:14px;margin-top:14px;scroll-margin-top:20px}.claim-top{display:flex;justify-content:space-between;gap:15px;align-items:center}.claim time{font-size:10px;color:#aaa0b2}.badge{display:inline-block;padding:4px 8px;border-radius:6px;background:#f2edf7;font-size:10px;font-weight:550}.connection{border-left:2px solid #baa4d0;background:#f8f5fb;padding:12px 16px;margin:16px 0;font-size:12px}.connection.conflict{border-color:#c68a7b;background:#fcf3f0}.connection strong{display:block;color:#a08ab1;font-size:11px}.connection.conflict strong{color:#b67d70}.connection a{display:block;margin-top:7px}.connection p{font-size:12px;margin:8px 0}.connection small{color:#ad9db7;font-size:10px}.sources{padding-left:18px}.sources li{margin-bottom:8px;font-size:12px}.sources small{display:block;color:#a49bad;font-size:10px}summary{font-size:12px;color:#9d8baa;cursor:pointer}blockquote{font-size:13px;white-space:pre-wrap;max-height:350px;overflow:auto;border-left:2px solid #d3c4e0;padding-left:16px;color:#8f7c9f;margin:12px 0}.transcript-links{font-size:10px;color:#a694b3}footer{font-size:11px;color:#ac9db6;border-top:1px solid #e5deec;padding-top:20px;margin-top:20px}@media(max-width:600px){main{padding-top:25px}.brand small{display:block;margin-left:0}h1{font-size:34px}.transcript-row{grid-template-columns:65px 1fr;gap:10px}.claim{padding:16px}.map-tools span{margin-left:0}}@media print{body{background:white}header button,.map-tools{display:none}.map-scroll{max-height:none;overflow:visible}.map-scroll svg{max-width:100%;height:auto!important}details{display:block}details>*{display:block!important}.claim{break-inside:avoid}a{color:#4c3a61}a[href^="http"]:after{content:' (' attr(href) ')';font-size:9px}nav{display:none}}`;
  return {session, labels, recordTranscript, recordCapture, createSubmission, completeSubmission, context, lookup, importArchive, exportJson, exportHtml, snapshot};
})();
