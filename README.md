# Interprète

**Un assistant pour préparer une relance, retrouver des sources et relire une interview.**

Interprète réunit un micro, un fil de vérifications, un dossier de documents et un tableau d’enquête. Les conclusions automatiques restent à recouper avant publication.

![Tableau d’enquête — exemple avec des données fictives](docs/assets/investigation-board.png)

## Installer

| Votre appareil | Installation |
| --- | --- |
| **Android 8 ou plus récent** | [Télécharger l’APK 0.5](https://github.com/grecdel/Interprete/releases/download/v0.5.0/Interprete-0.5.0-android.apk), ouvrir le fichier et autoriser l’installation depuis le navigateur si demandé. Garder Android System WebView à jour. |
| **PC Linux x86_64** | [Télécharger l’AppImage 0.5](https://github.com/grecdel/Interprete/releases/download/v0.5.0/Interprete-0.5.0-linux-x86_64.AppImage), autoriser son exécution puis l’ouvrir. Une archive portable est aussi fournie dans la version GitHub. |
| **Windows, macOS, Linux ARM** | Pas d’exécutable publié et validé pour ces plateformes. Le [mode web local](docs/INSTALLATION.md#mode-web-local-windows-macos-et-linux) fonctionne avec Python ; les fonctions natives Android ne sont pas disponibles dans ce mode. |
| **iPhone / iPad** | Pas d’application iOS publiée. L’APK Android ne s’installe pas sur iOS. |

[Guide d’installation détaillé](docs/INSTALLATION.md) · [Tous les téléchargements](https://github.com/grecdel/Interprete/releases)

## Premier démarrage

1. Ouvrir **Réglages** et renseigner sa clé API OpenAI pour la transcription et les vérifications web. Un abonnement ChatGPT n’inclut pas le crédit API.
2. Autoriser le micro. Sur Android, autoriser séparément la bulle flottante si souhaité.
3. Saisir une phrase ou un lien, écouter une interview, ou ouvrir **Dossier d’enquête** pour importer des documents et utiliser l’OSINT.
4. Exporter le compte rendu avant de quitter. Sur Android, choisir le ZIP pour joindre les fichiers audio conservés.

La clé n’est pas fournie dans le programme. Sur Android, sa mémorisation utilise Android Keystore. Les recherches documentaires publiques et le PDF/OCR local ne nécessitent pas cette clé.

## Ce qui est disponible

- Thèmes pastel, sombre, Matrix et enquête ; bulle animée ; tableau en liège, photos, liens, recherche et musique optionnelle.
- Dossier local : fichiers, annotations, provenance, empreintes, recherche et export/réimport des pièces.
- Extraction des PDF et OCR local des images ; glossaire de jargon, calcul de variation et comparaison textuelle de citations.
- **Huit connecteurs documentaires** : Crossref, data.gouv.fr, Annuaire des entreprises, Europe PMC, Wikidata, Wayback, GDELT et Open Library.
- Android : audio local, mode hors ligne, limites de durée 30/60/180 minutes et dossier ZIP avec audio associé aux propos.

Les résultats OSINT sont des notices à examiner, pas des verdicts. Wayback et GDELT peuvent limiter ou refuser temporairement les requêtes. Les autres services proposés dans le [catalogue OSINT](docs/OSINT.md) ne sont pas activés : certains exigent des accès ou licences spécifiques.

## Limites à connaître

L’outil reste un prototype. Ni la transcription, ni l’OCR, ni les conclusions ne sont garantis exacts. Les sources originales, dates et périmètres doivent être vérifiés par la rédaction.

Les fichiers restent locaux sauf envoi explicitement déclenché. L’audio destiné à la transcription est envoyé à OpenAI ; le mode Android hors ligne conserve l’audio sans le transcrire. Le son interne des autres applications et les appels ne sont pas capturés directement.

La conservation audio longue durée et l’export ZIP audio sont propres à Android. Les durées sont des plafonds, sous réserve de stockage et de fonctionnement du téléphone. Un essai réel de trois heures reste nécessaire avant de compter sur cette durée en direct. Les imports effectués directement dans une carte autonome sont temporaires.

[Limites détaillées](docs/VERSION-0.4.md) · [Audit de sécurité](docs/SECURITY_AUDIT.md) · [Signaler une vulnérabilité](SECURITY.md) · [Développement](docs/DEVELOPMENT.md)
