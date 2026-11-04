# Interprete

Assistant de vérification pour accompagner une interview ou un reportage : bulle
flottante, écoute au micro, fil d’éclairages sourcés et suggestions de relance.
Interface en français, sans dépendance applicative externe.

## Démarrer

Python 3.11 ou ultérieur suffit. Configurez `INTERPRETE_API_KEY` dans l’environnement
du serveur, jamais dans le code ou le navigateur, puis lancez depuis le dépôt :

```sh
python3 server.py
```

Ouvrez `http://127.0.0.1:8000` sur votre machine. `PORT` permet de changer le port.
`OPENAI_MODEL` remplace `gpt-4.1-mini` ; le modèle doit prendre en charge la
recherche web de l’API Responses. L’accès HTTPS à `api.openai.com` et du quota API
sont nécessaires. Les frais API sont distincts d’un abonnement ChatGPT.

La clé est une clé API OpenAI, créée dans votre compte sur
https://platform.openai.com/api-keys. Dans cet environnement cloud, renseignez-la
dans le champ secret `INTERPRETE_API_KEY` des paramètres de l’environnement,
destiné à `api.openai.com`. Ne la transmettez pas dans le chat. L’alias classique
`OPENAI_API_KEY` reste accepté pour une installation locale.

Le serveur écoute uniquement sur la boucle locale. Un déploiement distant
nécessite HTTPS, authentification et limitation de débit avant exposition.

## Pendant l’interview

- Cliquez sur la bulle pour ouvrir le volet et demander l’accès au micro.
  Cliquez à nouveau pour mettre l’écoute en pause. Réduire le volet arrête le micro.
- Les nouveaux fragments transcrits sont vérifiés après une courte pause,
  avec un intervalle d’au moins 20 secondes entre recherches automatiques.
  L’écoute continue pendant une recherche ; les nouveaux propos attendent la suivante.
- Le volet occupe environ un quart de l’écran sur ordinateur et s’adapte au mobile.
- Saisissez une phrase, collez un article (20 000 caractères maximum) ou un lien
  public. Envoyez avec la flèche ou `Ctrl/⌘ + Entrée`. Les liens sont consultés
  par le service de recherche ; les articles inaccessibles doivent être collés.
- Chaque carte rassemble une conclusion, une question pour rebondir, les éléments
  d’explication, les limites et les liens des sources.

Le micro nécessite HTTPS ou localhost et un navigateur compatible avec Web Speech
(notamment Chrome sur ordinateur). La transcription peut dépendre d’un service du
navigateur. Le micro capte l’entrée audio choisie, **pas le son d’un autre onglet** :
utilisez des haut-parleurs pour un reportage joué sur le même appareil.
Le navigateur peut interrompre l’écoute ; les reprises sont limitées et les erreurs
sont affichées. Les réponses prennent plusieurs secondes : ce prototype ne garantit
pas une latence compatible avec toutes les situations de direct.

## Au-dessus des autres applications

Le bouton ↗ du volet ouvre une fenêtre Document Picture-in-Picture dans Chrome
sur ordinateur. Cette fenêtre est gérée par le navigateur et peut rester au-dessus
des autres onglets et applications. Elle conserve la saisie, le fil et l’archive.
La fermer ramène le volet dans l’onglet et arrête le micro. Gardez l’onglet d’origine
ouvert : naviguer ailleurs dans cet onglet ferme la fenêtre flottante.

Le mode réduit tente de redimensionner cette fenêtre autour de la bulle. Le système
ou le navigateur peut imposer une taille minimale et ses propres bordures. Il ne
s’agit pas d’une application native sans cadre. Sans cette API, la bulle reste dans
la page Interprete ; aucune superposition aux autres sites n’est alors possible.

## Fin d’interview : archive et carte des connexions

Ouvrez le bouton d’archive dans l’en-tête du volet.

- **Terminer et exporter** arrête le micro, vérifie le dernier extrait en attente si
  la recherche est configurée, puis télécharge un compte rendu HTML autonome.
  Il contient la transcription complète horodatée, les propos soumis, les résultats,
  les sources, les relances et une carte interactive des connexions.
- **JSON** conserve une archive structurée pour réutilisation. Les exports sont des
  instantanés : exportez à nouveau après d’autres échanges. Une recherche échouée
  ou inachevée est conservée comme telle ; elle ne devient pas un résultat validé.
- **Comparer à une archive passée** importe un JSON Interprete. Les prochains
  extraits peuvent être reliés aux anciennes affirmations : concordance, nuance,
  contexte ou incohérence potentielle. Jusqu’à 200 nouvelles affirmations sont
  retenues par import. Le contexte de chaque recherche est limité aux 12 dernières
  affirmations de la session et aux 12 dernières importées ; ce n’est pas une
  recherche exhaustive dans des archives entières.

Ouvrez le fichier HTML téléchargé dans un navigateur. La carte et la transcription
fonctionnent hors ligne ; les documents sources nécessitent Internet. La carte
permet de sélectionner un nœud, de filtrer les incohérences potentielles et de
retrouver les passages concernés. L’archive est aussi imprimable en PDF.

La transcription conserve les fragments définitifs du moteur vocal dans leur ordre
de réception. Elle peut être erronée : **aucun enregistrement audio ni identification
automatique des interlocuteurs n’est inclus**. Les propos exacts envoyés à la
vérification sont conservés séparément des reformulations du modèle, avec leurs
liens vers les fragments transcrits.

La session reste uniquement en mémoire dans l’onglet : exportez avant de le fermer
ou de le recharger. Aucune archive n’est sauvegardée automatiquement sur le serveur.
Les imports restent en mémoire ; des extraits des propos antérieurs sont transmis
avec les nouvelles recherches pour établir les connexions. Les requêtes OpenAI
utilisent `store: false` ; la transcription peut aussi passer par le fournisseur
du navigateur. Ces choix ne constituent pas une garantie d’absence de rétention
chez ces fournisseurs.

## Fiabilité journalistique

**Interprete est une aide à l’enquête, pas une source infaillible.** La qualité
éditoriale, la véracité des affirmations et la fidélité des citations ne sont pas
certifiées par ce prototype.

Le service demande des sources primaires, vérifie le contexte dans ses consignes,
et ne rattache aux cartes que les URL présentes dans les annotations de recherche
web. Une conclusion sans source associée est ramenée à « Informations insuffisantes ».
Les liens vers des propos antérieurs ne peuvent cibler que des identifiants réellement
fournis. Un site unique est signalé comme nécessitant un recoupement.

Ces contrôles ne prouvent ni qu’un document est exact ni qu’il étaye la conclusion.
Les extraits et dates proposés par le modèle ne sont pas vérifiés textuellement
contre les documents originaux : ils sont explicitement à relire. Les incohérences
sont des pistes : dates, périmètres ou interlocuteurs différents peuvent les expliquer.
Les relances sont des suggestions, pas des accusations établies. Relisez les sources
et recoupez avant toute affirmation factuelle à l’antenne.

Un usage de production en rédaction demanderait notamment une évaluation sur un
corpus réel d’interviews, la mesure des erreurs de transcription et de citation,
et la validation éditoriale de la qualité et de la latence des résultats.

## Vérifier le module

Tests du serveur, des sources associées et des connexions :

```sh
python3 -m unittest discover -s tests -v
```

Parcours navigateur (nécessitent Playwright et Chromium ; `CHROMIUM_PATH` peut
remplacer `/usr/bin/chromium`) :

```sh
python3 -m unittest discover -s tests -p browser_smoke.py -v
```

Les parcours couvrent le volet ordinateur/mobile, les entrées texte/article/lien,
l’écoute et ses fragments successifs, les erreurs, le mode flottant, les exports
HTML/JSON et la comparaison avec une archive. Le micro et les réponses de recherche
sont **simulés** dans les tests. La recherche réelle exige une clé API ; l’audio,
les autorisations système et la qualité des résultats doivent être validés sur le
poste du journaliste.
