'use strict';
// Deterministic helpers, separate from evidence verdicts and model confidence.
(() => {
  const root=document.createElement('details');root.className='analysis-tools';
  const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  root.append(make('summary','Outils de lecture et de calcul · local'));
  const open=document.querySelector('.workspace-open');open.after(root);
  const jargon={
    'effet de base':'Une variation peut paraître forte parce que la valeur de départ était exceptionnellement basse ou haute.',
    'solde structurel':'Estimation du solde public corrigé des effets du cycle économique et de certaines mesures exceptionnelles ; il dépend de méthodes et d’hypothèses.',
    'déficit public':'Sur une période donnée, les dépenses publiques dépassent les recettes. Ce flux se distingue du stock de dette.',
    'dette publique':'Stock des engagements financiers publics à une date donnée ; vérifier le périmètre retenu.',
    'points de pourcentage':'Différence entre deux taux : passer de 10 % à 12 % représente +2 points, soit +20 % relativement au taux initial.',
    'euros constants':'Montants corrigés de l’évolution des prix, avec une année de référence à préciser.',
    'euros courants':'Montants exprimés aux prix de leur période, sans correction de l’inflation.',
    'pouvoir d’achat':'Quantité de biens et services qu’un revenu permet d’acheter ; le résultat dépend des prix, revenus et ménages considérés.',
    'prélèvements obligatoires':'Impôts et cotisations sociales effectivement reçus par les administrations publiques et institutions concernées.',
    'externalité':'Effet d’une activité sur des tiers dont le coût ou le bénéfice n’est pas entièrement inclus dans son prix.',
    'désinflation':'Ralentissement de la hausse des prix ; les prix peuvent continuer d’augmenter.',
    'déflation':'Baisse durable et générale du niveau des prix.',
    'corrélation':'Association statistique entre des variables ; elle ne démontre pas à elle seule un lien de cause à effet.',
    'médiane':'Valeur qui sépare une population ordonnée en deux groupes de même effectif ; elle se distingue de la moyenne.',
    'par habitant':'Valeur divisée par une population : comparer la même population et la même période.'
  };
  const text=make('textarea');text.placeholder='Phrase complexe, jargon ou citation à examiner…';text.setAttribute('aria-label','Texte à décrypter');text.maxLength=20000;
  const decrypt=make('button','Expliquer le jargon présent');decrypt.type='button';const decoded=make('div');decoded.setAttribute('aria-live','polite');
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  decrypt.onclick=()=>{decoded.replaceChildren();for(const [term,definition] of Object.entries(jargon))if(normalize(text.value).includes(normalize(term)))decoded.append(make('strong',term),make('p',definition));if(!decoded.children.length)decoded.append(make('p','Aucun terme du glossaire local reconnu. Ce résultat ne signifie pas que la phrase est claire ou exacte.'));};
  root.append(make('p','Ces outils expliquent et comparent des textes. Ils ne valident pas une affirmation.'),text,decrypt,decoded);
  const calc=make('section');calc.append(make('h4','Variation en pourcentage'));
  const before=make('input'),after=make('input');for(const input of [before,after]){input.inputMode='decimal';input.type='text';}
  before.setAttribute('aria-label','Valeur initiale');before.placeholder='Valeur initiale positive';after.setAttribute('aria-label','Valeur finale');after.placeholder='Valeur finale';
  const calculate=make('button','Calculer la variation');calculate.type='button';const formula=make('p');formula.setAttribute('role','status');
  const number=value=>{const text=value.replace(/\s/g,'').replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return NaN;return Number(text);};
  calculate.onclick=()=>{const a=number(before.value),b=number(after.value);formula.textContent=!Number.isFinite(a)||!Number.isFinite(b)||a<=0?'Utilisez des nombres finis avec une base strictement positive.':`(${b} − ${a}) ÷ ${a} × 100 = ${((b-a)/a*100).toLocaleString('fr-FR',{maximumFractionDigits:6})} %. Vérifiez unités, période, population et inflation avant de comparer.`;};
  calc.append(before,after,calculate,formula);root.append(calc);
  const comparison=make('section');comparison.append(make('h4','Retrouver une citation dans un document'));
  const quote=make('textarea'),documentText=make('textarea');quote.placeholder='Citation exacte recherchée';quote.setAttribute('aria-label','Citation à retrouver');quote.maxLength=10000;documentText.placeholder='Texte du document original';documentText.setAttribute('aria-label','Document de comparaison');documentText.maxLength=200000;
  const compare=make('button','Comparer les textes');compare.type='button';const result=make('p');result.setAttribute('role','status');
  const spaces=value=>value.normalize('NFC').replace(/\s+/g,' ').trim();
  compare.onclick=()=>{const wanted=spaces(quote.value),source=spaces(documentText.value);result.textContent=!wanted?'Ajoutez une citation.':source.includes(wanted)?'Correspondance textuelle trouvée (espaces normalisés). Cela ne prouve ni l’authenticité du document ni la justesse de la citation dans son contexte.':'Aucune correspondance textuelle exacte. Vérifiez le passage, l’OCR, les coupures et la ponctuation ; ce résultat ne prouve pas une fabrication.';};
  comparison.append(quote,documentText,compare,result);root.append(comparison);
})();
