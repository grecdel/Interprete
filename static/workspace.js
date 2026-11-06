'use strict';
// Private local evidence library. File contents never leave the device automatically.
(() => {
  const MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024;
  const archive = window.InterpreteArchive;
  const records = new Map(); let database;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const button = (text, action) => { const n = el('button', text); n.type = 'button'; n.onclick = action; return n; };
  const opener = button('Dossier d’enquête · pièces et outils', () => dialog.showModal()); opener.className = 'workspace-open';
  document.querySelector('.osint-tools').before(opener);
  const dialog = el('dialog', undefined, 'investigation'); dialog.setAttribute('aria-label', 'Dossier d’enquête');
  const header = el('header'); header.append(el('h2', 'Votre dossier d’enquête'), button('Fermer', () => dialog.close()));
  const description = el('p', 'Pièces conservées localement dans ce navigateur ou cette application. Exportez vos originaux séparément : le compte rendu conserve leur inventaire et vos annotations. Aucun contenu n’est envoyé automatiquement.');
  const input = el('input'); input.type = 'file'; input.multiple = true; input.id = 'evidence-files'; input.setAttribute('aria-label', 'Importer des pièces');
  const search = el('input'); search.type = 'search'; search.placeholder = 'Chercher dans les noms, notes et textes…'; search.setAttribute('aria-label', 'Rechercher dans les pièces');
  const status = el('p'); status.setAttribute('role', 'status');
  const list = el('section', undefined, 'evidence-list'); list.setAttribute('aria-label', 'Pièces recueillies');
  dialog.append(header, description, input, search, status, list); document.body.append(dialog);
  const tx = (mode, action) => new Promise((resolve, reject) => {
    const transaction = database.transaction('files', mode); let result;
    const request = action(transaction.objectStore('files'));
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(new Error('Stockage local indisponible ou plein.'));
    transaction.onabort = () => reject(new Error('Enregistrement local annulé.'));
  });
  function manifest() {
    archive.session.evidence = [...records.values()].map(({blob, ...record}) => record);
    window.interpreteDesktop?.setUnsaved(true);
  }
  async function save(record) { await tx('readwrite', store => store.put(record)); records.set(record.id, record); manifest(); render(); }
  function render() {
    list.replaceChildren(); const query = search.value.toLocaleLowerCase('fr');
    for (const record of records.values()) {
      if (!`${record.name} ${record.notes} ${record.text}`.toLocaleLowerCase('fr').includes(query)) continue;
      const card = el('article'); card.append(el('h3', record.name), el('p', `${record.size.toLocaleString('fr')} octets · SHA-256 ${record.sha256}`));
      const sourceLabel = el('label', 'Provenance / URL publique'); const source = el('input'); source.value = record.source || ''; sourceLabel.append(source);
      const noteLabel = el('label', 'Notes et passage pertinent'); const notes = el('textarea'); notes.value = record.notes || ''; notes.maxLength = 10000; noteLabel.append(notes);
      const claimLabel = el('label', 'Relier à une affirmation de cette session'); const claims = el('select');
      const none = el('option', 'Aucune association'); none.value = ''; claims.append(none);
      for (const entry of archive.session.submissions) for (const claim of entry.checks || []) { const option = el('option', claim.claim); option.value = claim.id; claims.append(option); }
      claims.value = record.claim_id || ''; claimLabel.append(claims);
      const saveNotes = button('Conserver les annotations', async () => {
        try {
          const value = source.value.trim();
          if (value) { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Utilisez une URL HTTP(S) sans identifiants.'); }
          await save({...record, notes: notes.value, source: value, claim_id: claims.value}); status.textContent = 'Annotations conservées localement.';
        } catch (error) { status.textContent = error.message; }
      });
      if (record.thumbnail && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(record.thumbnail)) { const image=el('img'); image.src=record.thumbnail; image.alt='Aperçu de ' + record.name; image.className='evidence-photo'; card.append(image); }
      const preview = el('details'); preview.append(el('summary', 'Consulter le texte extrait'));
      preview.append(el('pre', record.text || 'Texte non extrait. Pour un PDF ou une image, utilisez le bouton d’extraction locale. L’original reste conservé.'));
      if(record.type==='application/pdf'||/\.pdf$/i.test(record.name)||/^image\/(png|jpeg|webp)$/.test(record.type)) {
        const extract=button('Extraire le texte · PDF / OCR local',async()=>{
          extract.disabled=true;
          try {
            const result=await window.InterpreteDocuments.extract(record.blob,message=>{status.textContent=message;});
            await save({...record,...result});
            status.textContent=(result.text.trim()?'Texte extrait localement. ':'Aucun texte détecté. ')+(result.incomplete?'Extraction partielle (50 pages / 200 000 caractères maximum). ':'')+(result.extraction_method==='tesseract'?'OCR automatique à relire dans l’original.':'PDF scanné sans texte : OCR nécessaire sur ses images.');
          }catch(error){status.textContent='Extraction impossible : '+(error.message||'format non pris en charge.');}
          finally{extract.disabled=false;}
        });card.append(extract);
      }
      const use = button('Préparer une vérification', () => {
        const excerpt = notes.value.trim() || record.text;
        if (!excerpt) { status.textContent = 'Ajoutez d’abord le passage à vérifier dans les notes.'; return; }
        const composer = document.getElementById('transcript');
        if (composer.value.trim() && !window.confirm('Remplacer le texte actuellement saisi par cet extrait ?')) return;
        composer.value = excerpt.slice(0, 20000); composer.dispatchEvent(new Event('input', {bubbles:true})); dialog.close(); composer.focus();
      });
      const exportOriginal = button('Exporter la pièce et ses annotations (JSON)', async () => {
        try {
          const encoded = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(record.blob);
          });
          const {blob, ...metadata} = record;
          const content = JSON.stringify({app:'InterpreteEvidence', version:1, metadata, original_base64:encoded});
          if (window.interpreteDesktop) {
            const saved = await window.interpreteDesktop.saveArchive(content, 'json', 'piece-' + record.id + '.json');
            status.textContent = saved ? 'Pièce et annotations exportées avec l’original encodé dans le JSON.' : 'Export annulé.';
          } else {
            const url = URL.createObjectURL(new Blob([content], {type:'application/json'}));
            const link = el('a'); link.href = url; link.download = 'piece-' + record.id + '.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
            status.textContent = 'Export de la pièce préparé avec son original encodé dans le JSON.';
          }
        } catch { status.textContent = 'La pièce n’a pas pu être exportée. Conservez votre original séparément.'; }
      });
      const remove = button('Supprimer la pièce locale', async () => {
        if (!window.confirm(`Supprimer « ${record.name} » de ce dossier local ?`)) return;
        try { await tx('readwrite', store => store.delete(record.id)); records.delete(record.id); manifest(); render(); status.textContent = 'Pièce supprimée localement. Les exports antérieurs ne sont pas modifiés.'; } catch (error) { status.textContent = error.message; }
      });
      card.append(sourceLabel, noteLabel, claimLabel, saveNotes, preview, use, exportOriginal, remove); list.append(card);
    }
    if (!list.children.length) list.append(el('p', 'Aucune pièce correspondante. Importez un document pour commencer.'));
  }
  const tools = el('section', undefined, 'direct-osint');
  const toolTitle=el('h3','Rechercher dans les sources publiques');
  const provider=el('select'); provider.setAttribute('aria-label','Source OSINT');
  for(const [value,label] of [['crossref','Crossref · publications scientifiques'],['data_gouv','data.gouv.fr · jeux de données'],['entreprises','Annuaire des entreprises · SIREN'],['europe_pmc','Europe PMC · biomédecine / PubMed'],['wikidata','Wikidata · entités et références'],['wayback','Wayback · URL HTTPS à retrouver'],['gdelt','GDELT · découverte d’articles'],['openlibrary','Open Library · ouvrages']]) {const option=el('option',label);option.value=value;provider.append(option);}
  const term=el('input'); term.type='search';term.maxLength=250;term.placeholder='Sujet, titre, entreprise…';term.setAttribute('aria-label','Recherche OSINT directe');
  const results=el('div'); results.setAttribute('aria-live','polite');
  const cache=new Map();
  const run=button('Interroger cette source',async()=>{
    const query=term.value.trim(); if(query.length<3){status.textContent='Saisissez au moins trois caractères.';return;}
    run.disabled=true;results.replaceChildren();status.textContent='Recherche documentaire en cours…';
    try {
      const key=provider.value+'|'+query; let response=cache.get(key);
      if(!response || Date.now()-response.saved>300000) {
        const body={provider:provider.value,query};
        const result=window.interpreteDesktop ? await window.interpreteDesktop.request('/api/osint',body) : await fetch('/api/osint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>({ok:r.ok,body:await r.json()}));
        if(!result.ok) throw new Error(result.body.error||'Recherche indisponible.');
        response={saved:Date.now(),body:result.body}; if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,response);
      }
      status.textContent=(response.body.notice||'Résultats à examiner.')+' Consultation : '+new Date(response.body.retrieved_at).toLocaleString('fr-FR');
      for(const item of response.body.results||[]) {
        let url;try{url=new URL(item.url);if(url.protocol!=='https:'||url.username||url.password)continue;}catch{continue;}
        const card=el('article');const link=el('a',item.title);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
        const keep=button('Conserver cette notice dans le dossier',async()=>{
          try {
            if(!database)throw new Error('Le stockage local n’est pas disponible.');
            const text=JSON.stringify({type:'notice_documentaire_non_verifiee',...item,retrieved_at:response.body.retrieved_at,query:response.body.query},null,2);
            const bytes=new TextEncoder().encode(text);const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
            if([...records.values()].some(r=>r.sha256===sha256)){status.textContent='Cette notice est déjà dans le dossier.';return;}
            await save({id:'evidence_'+crypto.randomUUID(),name:item.title.slice(0,150)+'.json',type:'application/json',size:bytes.length,sha256,collected_at:response.body.retrieved_at,source:url.href,notes:'Notice issue de '+response.body.provider+' ; document original à consulter.',claim_id:'',text,blob:new Blob([bytes],{type:'application/json'})});
            status.textContent='Notice et provenance conservées ; le document complet n’a pas été téléchargé.';
          } catch(error){status.textContent=error.message;}
        });
        card.append(link,el('p',item.description),keep);results.append(card);
      }
      if(!results.children.length)results.append(el('p','Aucun résultat. Cela ne prouve pas l’absence d’information.'));
    }catch(error){status.textContent=error.message||'Le connecteur est indisponible.';}
    finally{run.disabled=false;}
  });
  tools.append(toolTitle,el('p','La requête est transmise au fournisseur choisi au clic. Les fichiers du dossier ne sont pas envoyés. Ces notices sont des pistes, pas des preuves validées.'),provider,term,run,results);
  dialog.insertBefore(tools,input);
  search.oninput = render;
  input.onchange = async () => {
    input.disabled = true;
    try {
      if (!database) throw new Error('Le stockage local n’est pas disponible.');
      for (let file of input.files) {
        let imported = {};
        if (file.size > 12 * 1024 * 1024) throw new Error("Le fichier importé dépasse 12 Mio.");
        if (/\.json$/i.test(file.name)) {
          let packed; try { packed = JSON.parse(await file.text()); } catch {}
          if (packed?.app === "InterpreteEvidence") {
            if (packed.version !== 1 || typeof packed.original_base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(packed.original_base64) || !packed.metadata || typeof packed.metadata.name !== "string") throw new Error("Archive de pièce invalide.");
            const decoded = atob(packed.original_base64);
            if (decoded.length > MAX_FILE) throw new Error("Original trop volumineux.");
            const data = Uint8Array.from(decoded, char => char.charCodeAt(0));
            const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(n => n.toString(16).padStart(2, "0")).join("");
            if (digest !== packed.metadata.sha256) throw new Error("L’empreinte de la pièce ne correspond pas à son contenu.");
            imported = packed.metadata;
            file = new File([data], imported.name.slice(0, 250), {type:typeof imported.type === "string" ? imported.type : ""});
          }
        }
        if (file.size > MAX_FILE) throw new Error(`${file.name} dépasse la limite de 8 Mio par pièce.`);
        if ([...records.values()].reduce((n, r) => n + r.size, 0) + file.size > MAX_TOTAL) throw new Error('Le dossier atteint sa limite de 64 Mio.');
        const bytes = await file.arrayBuffer();
        const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
        if ([...records.values()].some(r => r.sha256 === sha256)) { status.textContent = `${file.name} est déjà présent (contenu identique).`; continue; }
        const textual = /\.(txt|md|csv|json|srt|vtt|log)$/i.test(file.name) || /^text\//.test(file.type);
        const text = textual ? new TextDecoder().decode(bytes).slice(0, 200000) : '';
        let thumbnail = '';
        if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
          const encoded = await new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file); });
          const image = new Image(); image.src=encoded; await image.decode();
          const canvas=document.createElement('canvas'), scale=Math.min(1,320/image.width,200/image.height);
          canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale)); canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height); thumbnail=canvas.toDataURL('image/jpeg',.75);
        }
        await save({id:'evidence_' + crypto.randomUUID(), name:file.name, type:file.type, size:file.size, sha256, collected_at:new Date().toISOString(), source:typeof imported.source === 'string' ? imported.source.slice(0, 2000) : '', notes:typeof imported.notes === 'string' ? imported.notes.slice(0, 10000) : '', claim_id:'', thumbnail, text, text_truncated:textual && new TextDecoder().decode(bytes).length > 200000, blob:file});
        status.textContent = `${file.name} conservé localement. ${textual ? 'Texte consultable (200 000 caractères maximum).' : 'Original conservé, extraction non disponible.'}`;
      }
    } catch (error) { status.textContent = error.message || 'Import impossible.'; }
    finally { input.value = ''; input.disabled = !database; }
  };
  input.disabled = true;
  try {
    const request = indexedDB.open('interprete-evidence', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', {keyPath:'id'});
    request.onerror = () => { status.textContent = 'Stockage local indisponible. Aucun fichier ne sera importé.'; };
    request.onsuccess = async () => {
      database = request.result;
      database.onversionchange = () => { database.close(); database = null; input.disabled = true; };
      try {
        for (const record of await tx('readonly', store => store.getAll())) records.set(record.id, record);
        if (records.size) manifest(); input.disabled = false; render();
        status.textContent = 'Dossier local prêt. La suppression des données de l’application efface les pièces conservées ici.';
      } catch (error) { status.textContent = error.message; }
    };
  } catch { status.textContent = 'Stockage local non disponible sur cet appareil.'; }
})();
