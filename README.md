<p align="center"><img src="docs/assets/icon.png" width="72" alt="Icône Interprete"></p>
<h1 align="center">Interprete</h1>
<p align="center"><strong>Une bulle pendant l’interview. Des pistes pour rebondir. Un dossier pour tout relire.</strong></p>
<p align="center">
  <a href="https://github.com/grecdel/Interprete/releases/tag/v0.4.0">Android 0.4</a> ·
  <a href="https://github.com/grecdel/Interprete/releases/tag/v0.2.0">Linux 0.2</a> ·
  <a href="docs/ANDROID.md">Guide Android</a> ·
  <a href="docs/VERSION-0.4.md">Fonctions et limites de la version 0.4</a>
</p>

> **Prototype expérimental.** Les transcriptions, citations, conclusions et connexions doivent être relues et recoupées avant une utilisation journalistique. Les captures utilisent des données fictives.

## Android : une application autonome

Téléchargez [**Interprete-0.4.0-android.apk**](https://github.com/grecdel/Interprete/releases/download/v0.4.0/Interprete-0.4.0-android.apk), ouvrez le fichier sur Android 8.0 ou ultérieur avec Android System WebView à jour, puis renseignez votre clé API OpenAI dans les réglages. Aucun serveur Linux ni environnement Codex à lancer.

- Micro Android et bulle flottante optionnelle avec autorisations explicites.
- Thèmes pastel, sombre, Matrix et enquête ; boule organique animée.
- Dossier local de pièces : recherche, annotations, provenance, empreintes, dédoublonnage et export/réimport.
- Lecture/extraction PDF et OCR français/anglais des images, avec moteurs et modèles embarqués.
- Connecteurs directs **Crossref**, **data.gouv.fr** et **Annuaire des entreprises** ; notices datées et conservables.
- Glossaire local de jargon, calculateur de variation et comparaison textuelle de citations.
- Conservation audio Android optionnelle sur disque, plafonds de 30/60/180 minutes et mode hors ligne sans transcription.
- Export ZIP du compte rendu, du JSON et des WAV ; audio rattaché aux propos et accessible depuis la carte.

Les appels OpenAI nécessitent Internet et peuvent être facturés sur votre compte API ; un abonnement ChatGPT ne fournit pas ce crédit. La clé n’est pas incluse dans l’APK. Sa mémorisation utilise Android Keystore. Les trois connecteurs publics et le traitement local des documents ne nécessitent pas cette clé.

## Un tableau pour suivre les connexions

Le thème enquête apporte liège, dossiers, photos façon Polaroïd, punaises et fils rouges. La recherche filtre les éléments ; la vue d’ensemble et le zoom permettent de parcourir le tableau. L’ambiance jazzy locale démarre uniquement au clic.

![Tableau enquête avec données fictives et pièces importées](docs/assets/investigation-board.png)

Les étiquettes distinguent les relations : une association ne constitue pas une preuve. Les imports directs dans la carte sont temporaires ; utilisez le dossier d’enquête pour conserver les pièces.

## Documents et audio : connaître les limites

Les pièces sont conservées localement, sans envoi automatique aux services de recherche. Limites : 8 Mio par pièce, 64 Mio pour le dossier ; extraction PDF jusqu’à 50 pages et 200 000 caractères. L’OCR d’images doit être relu ; les PDF scannés sans texte nécessitent encore une conversion des pages en images.

L’audio Android est limité à 512 Mio au total. Les durées configurées sont des plafonds, pas une garantie de fonctionnement sur tous les téléphones. Le micro écoute l’entrée choisie par Android ; l’audio interne des applications et les appels ne sont pas capturés directement. L’association audio/transcription porte sur les segments, sans alignement au mot ni identification automatique des interlocuteurs.

Les notices OSINT sont des pistes documentaires : elles ne certifient pas les affirmations. Les autres services du [catalogue OSINT](docs/OSINT.md) ne sont pas tous connectés.

## Linux

La [version Linux publiée 0.2](https://github.com/grecdel/Interprete/releases/tag/v0.2.0) fournit une AppImage et une archive portable autonomes. Elle précède les nouveautés Android 0.4. Python, le serveur et l’interface de cette version sont embarqués.

```sh
chmod +x Interprete-0.2.0-linux-x86_64.AppImage
./Interprete-0.2.0-linux-x86_64.AppImage
```

![Application Linux — données fictives de présentation](docs/assets/hero.png)

## Développement et validation

[Mode web](docs/DEVELOPMENT.md) · [Application de bureau](docs/DESKTOP.md) · [Android](docs/ANDROID.md) · [Détails 0.4 et licences](docs/VERSION-0.4.md).

Les tests automatisés vérifient les parcours logiciels avec des interviews et des réponses OpenAI simulées. Le PDF/OCR est testé avec des documents fictifs. Les tests ne certifient pas l’exactitude journalistique et ne remplacent pas un essai sur appareil réel avant un direct.
