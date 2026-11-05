Première version Android autonome d’Interprete, pour Android 8.0 ou ultérieur avec Android System WebView à jour.

- Micro Android, écoute en arrière-plan avec notification, pause et arrêt.
- Bulle flottante optionnelle et déplaçable, avec autorisation explicite d’affichage.
- Saisie de texte ou de lien, cartes de vérification, sources et pistes de relance.
- Archives HTML/JSON, carte des connexions et consultation du dernier compte rendu dans l’application.
- Clé API saisie dans l’application, mémorisation chiffrée via Android Keystore ; aucune clé API dans l’APK.

Téléchargez **Interprete-0.3.0-android.apk**, ouvrez le fichier et autorisez son installation depuis votre navigateur si Android le demande. Renseignez ensuite votre clé API OpenAI dans les réglages. Les appels API nécessitent Internet et peuvent être facturés sur votre compte.

L’application écoute le micro du téléphone. Le son interne des autres applications et les appels ne sont pas capturés directement.

**Prototype expérimental** : la transcription et les sources doivent être relues et recoupées. L’application ne garantit pas une exactitude journalistique infaillible. Les tests automatisés utilisent des réponses et de l’audio simulés ; ils ne valident pas un enregistrement sur téléphone réel.

L’APK est signé avec l’identité du projet. `SHA256SUMS` permet de vérifier le téléchargement et `SIGNATURE.txt` contient l’empreinte publique du certificat.

[Guide Android](https://github.com/grecdel/Interprete/blob/main/docs/ANDROID.md) · [Version Linux v0.2.0](https://github.com/grecdel/Interprete/releases/tag/v0.2.0)
