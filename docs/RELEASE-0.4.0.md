Interprete 0.4.0 — atelier d’enquête et audio Android.

- Thèmes pastel, sombre, Matrix et enquête ; boule organique animée.
- Tableau en liège, fiches et photos façon Polaroïd, fils rouges, recherche, imports et ambiance jazzy optionnelle.
- Dossier de pièces local : recherche, annotations, provenance, empreintes SHA-256, dédoublonnage, export/réimport des originaux dans un conteneur JSON.
- Lecture et extraction PDF locales ; OCR français/anglais des images avec moteurs et modèles embarqués.
- Recherches directes dans Crossref, data.gouv.fr et l’Annuaire des entreprises ; conservation des notices avec leur provenance. Une notice n’est pas un document intégral ni une preuve validée.
- Glossaire local de jargon, calcul de variation et recherche d’une citation dans un texte.
- Android : conservation audio optionnelle sur disque, limites de 30/60/180 minutes, mode d’enregistrement sans transcription et export ZIP comprenant compte rendu, JSON et extraits WAV.
- Audio associé aux fragments transcrits et accessible depuis le compte rendu et les propos de la carte ; récupération/suppression des audios locaux dans les réglages.

Téléchargez **Interprete-0.4.0-android.apk**, puis ouvrez-le sur Android 8.0 ou ultérieur avec Android System WebView à jour. La signature est la même que celle de la version 0.3.0 : installez la mise à jour sans désinstaller si vous souhaitez conserver les données privées.

Les recherches OpenAI nécessitent votre clé API et peuvent être facturées. Les trois connecteurs documentaires et le traitement PDF/OCR ne nécessitent pas cette clé. Le mode audio hors ligne conserve le son, sans le transcrire.

Limites : 8 Mio par pièce, 64 Mio pour le dossier de pièces ; extraction PDF jusqu’à 50 pages et 200 000 caractères ; les PDF scannés sans texte nécessitent encore une conversion des pages en images pour l’OCR. Conservation audio limitée à 512 Mio sur le téléphone ; la durée réelle dépend des permissions, du stockage et du système. Les extraits ne fournissent pas d’alignement au mot ni d’identification automatique du locuteur. Les autres services OSINT proposés ne sont pas tous connectés.

Le ZIP audio se décompresse pour ouvrir `index.html` avec son dossier `audio/`, ou se consulte après export dans l’application tant que les audios locaux sont présents. Les imports réalisés directement dans la carte autonome sont temporaires ; utilisez le dossier d’enquête pour conserver des pièces.

Prototype expérimental : citations, OCR, transcription, sources et connexions doivent être relus et recoupés. Aucun verdict journalistique infaillible n’est garanti. Les essais automatisés utilisent des interviews et de l’audio simulés ; ils ne remplacent pas un essai sur votre téléphone avant un direct.
