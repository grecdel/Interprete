# Fonctions de la version 0.4

## Accès aux documents et recherches

Le dossier local ouvre les PDF avec PDF.js et extrait leurs textes, avec des repères de page. Il rend un aperçu de la première page. L’OCR d’images PNG/JPEG/WebP utilise Tesseract et les modèles français/anglais embarqués : aucun document n’est envoyé à un fournisseur OCR. Un texte extrait reste à comparer à l’original. Limites : 8 Mio par fichier, 50 pages / 200 000 caractères par PDF. Les scans PDF sans couche texte nécessitent encore une conversion des pages en images.

Crossref, data.gouv.fr et l’Annuaire des entreprises sont interrogés par leurs API publiques depuis le serveur local sur bureau/web et directement depuis le téléphone Android. La requête est envoyée au fournisseur choisi au clic. Aucun fichier du dossier n’est envoyé automatiquement. Les résultats sont limités à cinq notices, datées et enregistrables dans le dossier. Le cache de cinq minutes du serveur et de l’interface conserve la date de la consultation initiale ; il ne rend pas les résultats actuels par magie.

Les autres services du catalogue OSINT restent des propositions, pas des connecteurs disponibles. Les ressources exigeant une licence, un compte ou une clé distincte ne sont pas activées automatiquement.

## Audio Android

Avant le démarrage, choisissez la conservation audio et la durée maximale (30, 60 ou 180 minutes). Le mode hors ligne enregistre sans transcrire et ne nécessite pas de clé OpenAI. Il exige la conservation audio activée.

Le micro et le service de premier plan gardent leurs permissions et indicateurs Android. Les segments WAV sont enregistrés dans l’espace privé de l’application, avec une empreinte SHA-256. Les extraits sont associés à la transcription quand celle-ci aboutit. Les positions en millisecondes décrivent le segment dans une prise : elles ne constituent pas un alignement au mot. Une pause et une reprise constituent des prises distinctes.

Le stockage audio est limité à 512 Mio pour l’ensemble des prises présentes. Une erreur réseau peut interrompre la transcription ; le système l’indique. Les durées configurées sont des plafonds : le stockage, les permissions et les restrictions du constructeur peuvent arrêter l’enregistrement plus tôt. Aucun essai réel de trois heures sur téléphone n’a encore été réalisé.

Le bouton **Terminer et exporter le dossier avec audio (ZIP)** attend la dernière transcription puis écrit progressivement les fichiers, sans charger toute l’interview en RAM. Le ZIP contient `index.html`, `session.json` et les extraits dans `audio/`. Le HTML seul n’embarque pas les fichiers audio. Décompressez le ZIP en conservant son arborescence pour écouter les extraits ; l’aperçu de l’application peut aussi lire les audios locaux après l’export ZIP.

Les réglages permettent de récupérer les audios conservés après une fermeture de l’application, puis de les exporter. Les transcriptions non exportées de sessions fermées ne sont pas restaurées. Exportez avant de supprimer les audios ; les archives déjà exportées ne sont pas effacées par la suppression locale.

Cette conservation audio et cet export ZIP sont intégrés au moteur Android. Le moteur de bureau conserve son fonctionnement de transcription par extraits sans cette conservation longue durée.

## Outils de lecture

Le glossaire local explique une quinzaine de termes économiques et statistiques reconnus dans une phrase ; il ne reformule pas sémantiquement toutes les phrases possibles. Le calculateur affiche sa formule et exige une valeur initiale positive. Le comparateur de citations cherche une correspondance textuelle après normalisation des espaces, sans certifier l’authenticité du document ni le contexte.

## Bibliothèques embarquées

- PDF.js / pdfjs-dist 6.5.438, Apache-2.0, licence et fontes dans `static/vendor/pdf`.
- Tesseract.js 7.0.0 et son moteur, Apache-2.0, licences dans `static/vendor/ocr`.
- tessdata_fast 4.1.0, français et anglais, Apache-2.0 ; sources et empreintes dans `static/vendor/ocr/lang/models.json`.

Les dépendances npm sont fixées dans le lockfile. Les moteurs, workers et modèles sont distribués localement ; aucun CDN n’est nécessaire au traitement des documents.
