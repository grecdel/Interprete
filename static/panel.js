'use strict';
// 0.7 panel, layout A ("fil épuré") with the closed-bubble preview of layout C (see app.js, F2):
// the bubble is the microphone while the panel is open, the tools sit behind one "+" button,
// the live transcript stays on one line, and computers get keyboard shortcuts.
(() => {
  const companion = document.getElementById('companion');
  if (!companion) return;
  const find = selector => companion.querySelector(selector);
  const bubble = find('#bubble'), microphone = find('#microphone'), transcript = find('#transcript');
  const open = () => companion.classList.contains('is-open');

  // UI1: the bubble starts or pauses listening when the panel is open. Closed, it keeps opening the actions.
  bubble.addEventListener('click', event => {
    if (!open() || microphone.disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    microphone.click();
  }, true);
  // The large "Écouter un reportage" card becomes a small control under the status line.
  find('.panel-identity > div')?.append(microphone);
  microphone.classList.add('listen-chip');

  // UI5: one line of live transcript; a click shows it in full.
  const preview = find('#live-preview');
  if (preview) {
    preview.tabIndex = 0; preview.setAttribute('role', 'button'); preview.setAttribute('aria-expanded', 'false');
    preview.title = 'Afficher toute la transcription en direct';
    const toggle = () => { const expanded = preview.classList.toggle('expanded'); preview.setAttribute('aria-expanded', String(expanded)); };
    preview.addEventListener('click', toggle);
    preview.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
  }

  // UI3: one "+" button in the composer gathers the dossier, the reading tools and the OSINT workshop.
  const composer = find('#composer'), toolbar = find('.composer-toolbar');
  const menu = companion.ownerDocument.createElement('section');
  menu.id = 'tools-menu'; menu.className = 'tools-menu'; menu.hidden = true; menu.setAttribute('aria-label', 'Outils d’enquête');
  const heading = companion.ownerDocument.createElement('p'); heading.className = 'tools-menu-title'; heading.textContent = 'Outils d’enquête';
  menu.append(heading);
  for (const selector of ['.workspace-open', '.analysis-tools', '.osint-tools']) {
    const item = find(selector); if (item && !menu.contains(item)) menu.append(item);
  }
  const plus = companion.ownerDocument.createElement('button');
  plus.type = 'button'; plus.id = 'tools-button'; plus.className = 'tools-button'; plus.textContent = '+';
  plus.setAttribute('aria-label', 'Outils : dossier, calcul, OSINT'); plus.title = 'Dossier d’enquête, outils de lecture et OSINT';
  plus.setAttribute('aria-controls', 'tools-menu'); plus.setAttribute('aria-expanded', 'false');
  const setMenu = value => { menu.hidden = !value; plus.setAttribute('aria-expanded', String(value)); };
  plus.onclick = () => setMenu(menu.hidden);
  toolbar?.prepend(plus);
  composer?.before(menu);
  // Opening the dossier from the menu closes the menu behind it.
  find('.workspace-open')?.addEventListener('click', () => setMenu(false));

  // UI6: keyboard shortcuts. Escape closes the tools menu before the panel's own Escape handling.
  const editable = target => target instanceof Element && target.closest('input, textarea, select, button, a, summary, [contenteditable], [role="button"]');
  function shortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!open() && typeof setPanelOpen === 'function') setPanelOpen(true);
      transcript.focus(); return;
    }
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopImmediatePropagation(); setMenu(false); plus.focus(); return; }
    if (event.key === ' ' && !event.repeat && open() && !editable(event.target) && !microphone.disabled) { event.preventDefault(); microphone.click(); }
  }
  companion.addEventListener('keydown', shortcuts, true);
  document.addEventListener('keydown', event => { if (!companion.contains(event.target)) shortcuts(event); });
  // F5 and F7 in the archive tray: proofread the transcript (with a change log) and export an evidence report.
  const archive = window.InterpreteArchive, tray = find('#archive-tray'), archiveStatus = find('#archive-status');
  if (archive && tray) {
    const doc = companion.ownerDocument;
    const make = (tag, text, className) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
    const changed = () => { if (typeof markUnsaved === 'function') markUnsaved(true); };
    const evidence = make('button', 'Dossier de preuves ↗', 'evidence-export'); evidence.type = 'button'; evidence.id = 'export-evidence';
    evidence.title = 'Propos, verdicts, niveau de preuve, sources, extraits et limites, à partager avec la rédaction';
    evidence.onclick = async () => {
      try { const saved = await archive.exportEvidence(); archiveStatus.textContent = saved === false ? 'Export annulé.' : 'Dossier de preuves exporté : un fichier HTML sans script, lisible par la rédaction.'; }
      catch { archiveStatus.textContent = 'Le dossier de preuves n’a pas pu être exporté. La session reste disponible.'; }
    };
    find('.archive-actions')?.append(evidence);

    const review = make('details', undefined, 'transcript-review'); review.id = 'transcript-review';
    const summary = make('summary', 'Relire et corriger la transcription'); review.append(summary);
    const list = make('div', undefined, 'transcript-review-list'); review.append(list);
    function render() {
      list.replaceChildren();
      const fragments = archive.session.transcript;
      if (!fragments.length) { list.append(make('p', 'Aucun fragment transcrit pour l’instant.', 'muted-note')); return; }
      for (const fragment of fragments.slice(-50).reverse()) {
        const row = make('div', undefined, 'transcript-review-row');
        const time = make('time', new Date(fragment.at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit'}));
        const field = make('textarea'); field.value = fragment.text; field.rows = 2; field.maxLength = 20000;
        field.setAttribute('aria-label', 'Fragment transcrit à ' + time.textContent);
        const save = make('button', 'Corriger'); save.type = 'button';
        save.onclick = () => {
          try {
            if (archive.correctTranscript(fragment.id, field.value)) { changed(); archiveStatus.textContent = 'Correction enregistrée dans le journal. Les vérifications déjà faites gardent le texte entendu.'; render(); }
            else archiveStatus.textContent = 'Aucune modification à enregistrer.';
          } catch (error) { archiveStatus.textContent = error.message; }
        };
        row.append(time, field, save);
        if (typeof fragment.original_text === 'string') row.append(make('small', `Entendu : « ${fragment.original_text} »`, 'muted-note'));
        list.append(row);
      }
      if (fragments.length > 50) list.append(make('p', 'Seuls les 50 derniers fragments sont modifiables ici.', 'muted-note'));
    }
    review.addEventListener('toggle', () => { if (review.open) render(); });
    archiveStatus?.before(review);
  }

  const hint = find('#composer-hint');
  if (hint && !window.InterpreteNative) hint.textContent = 'Espace : écouter ou mettre en pause · Ctrl+K : vérifier une phrase · Échap : réduire';
})();
