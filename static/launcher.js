'use strict';
(() => {
  const panel=document.getElementById('assistant-panel'),orb=document.getElementById('bubble');
  const card=document.createElement('section');card.id='companion-launcher';card.className='companion-launcher';card.hidden=true;card.setAttribute('aria-label','Accueil d’Interprète');
  const create=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
  const title=create('h2'),intro=create('p'),welcome=create('div'),choices=create('div');choices.className='launcher-choices';
  const label=create('label','Choisissez mon ambiance');const theme=create('select');theme.setAttribute('aria-label','Thème au premier lancement');
  for(const option of companion.querySelector('.theme-control select').options)theme.append(option.cloneNode(true));
  theme.value=document.documentElement.dataset.theme||'pastel';label.append(theme);
  theme.onchange=()=>{const existing=companion.querySelector('.theme-control select');existing.value=theme.value;existing.dispatchEvent(new Event('change'));};
  welcome.id='launcher-welcome';
  const done=create('button','Installer ma bulle');done.id='launcher-complete';done.type='button';welcome.append(label,create('p','Je reste discrète. Le micro ne démarre que lorsque vous choisissez Record et accordez son autorisation.'),done);
  const close=create('button','×');close.type='button';close.className='launcher-close';close.setAttribute('aria-label','Fermer l’accueil');
  if(window.InterpreteNative)welcome.append(create('p','Sur Android, activez la permission de bulle au-dessus des applications dans Réglages pour me retrouver hors de cette fenêtre.'));
  card.append(close,title,intro,welcome,choices);document.getElementById('companion').append(card);
  let onboarded=false,ready=false;
  function hidePanel(){panel.hidden=true;companion.classList.remove('is-open');orb.setAttribute('aria-expanded','false');}
  function closeMenu(){card.hidden=true;companion.ownerDocument.body.classList.remove('launcher-visible');desktop?.setLauncherOpen?.(false);orb.focus();}
  function show(){hidePanel();card.hidden=false;companion.ownerDocument.body.classList.add('launcher-visible');desktop?.setLauncherOpen?.(true);welcome.hidden=onboarded;choices.hidden=!onboarded;close.hidden=!onboarded;title.textContent=onboarded?'Que puis-je faire pour vous ?':'Bonjour, je suis Interprète.';intro.textContent=onboarded?'Choisissez comment commencer.':'Je vous aide à écouter, rechercher des sources et préparer vos relances. Choisissons d’abord mon apparence.';choices.querySelector('[data-action=record] span').textContent=wantedListening?'Mettre l’écoute audio en pause':'Écouter l’audio et lancer l’analyse';(onboarded?choices.querySelector('button'):theme).focus();}
  for(const [name,detail,action] of [
    ['Record','Écouter l’audio et lancer l’analyse','record'],
    ['Requête textuelle','Écrire une phrase, un article ou un lien','text'],
    ['Ouvrir le panneau latéral','Retrouver les outils et le dossier d’enquête','panel']
  ]){
    const button=create('button');button.type='button';button.dataset.action=action;button.append(create('strong',name),create('span',detail));
    button.onclick=async()=>{card.hidden=true;companion.ownerDocument.body.classList.remove('launcher-visible');
      if(action==='record'){if(wantedListening){await stopListening();setPanelOpen(true);}else await startListening();}
      else{setPanelOpen(true);if(action==='text')ui.transcript.focus();else if(desktop&&configured!==true){await refreshConfiguration();if(!configured)toggleSettings(true);}}
    };choices.append(button);
  }
  done.onclick=async()=>{done.disabled=true;try{if(desktop?.completeOnboarding)await desktop.completeOnboarding(theme.value);else {try{localStorage.setItem('interprete-onboarded','yes');}catch{ /* Session-only welcome if storage is unavailable. */ }}onboarded=true;closeMenu();}catch{intro.textContent='Le choix n’a pas pu être mémorisé. Réessayez.';}finally{done.disabled=false;}};
  close.onclick=closeMenu;
  orb.onclick=show;
  document.getElementById('open-assistant').onclick=show;
  companion.addEventListener('keydown',event=>{if(event.key==='Escape'&&!card.hidden){event.stopImmediatePropagation();event.preventDefault();if(onboarded)closeMenu();}},true);
  window.InterpreteLauncher={show,ready:()=>ready};
  if(desktop)desktop.onOpen(show);
  document.body.classList.add('companion-mode');hidePanel();
  (async()=>{
    try{const settings=desktop?await desktop.settings():{};onboarded=desktop?Boolean(settings.onboardingComplete):localStorage.getItem('interprete-onboarded')==='yes';
      if(settings.theme){theme.value=settings.theme;theme.onchange();}
    }catch{onboarded=false;}
    ready=true;if(onboarded)closeMenu();else show();
  })();
})();
