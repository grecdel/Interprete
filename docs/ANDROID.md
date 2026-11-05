# Interprete pour Android

L’APK cible **Android 8.0 ou ultérieur**, avec Android System WebView à jour. Il contient l’interface et le moteur Android ; aucun serveur Linux ou environnement Codex n’est nécessaire. Aucun processeur particulier n’est imposé : l’application n’embarque pas de bibliothèque native liée à une architecture.

## Installer

Téléchargez [Interprete-0.3.0-android.apk](https://github.com/grecdel/Interprete/releases/download/v0.3.0/Interprete-0.3.0-android.apk), puis ouvrez-le sur votre téléphone. Android peut demander d’autoriser l’installation depuis le navigateur ou le gestionnaire de fichiers utilisé. Il s’agit d’une installation manuelle, pas d’une application publiée sur Google Play.

L’APK est signé avec l’identité privée du projet. Son certificat public se trouve dans `android/signing-certificate.der` ; les empreintes du téléchargement accompagnent la version publiée. Une mise à jour doit conserver la même signature pour préserver l’installation et ses données.

## La clé API

Saisissez votre clé API OpenAI dans les réglages de l’application. Elle n’est pas incluse dans l’APK. Sans mémorisation, elle reste en mémoire. Avec mémorisation, elle est chiffrée avec une clé liée à l’application dans **Android Keystore** et stockée dans l’espace privé de l’application. Les sauvegardes Android de l’application sont désactivées.

La transcription et les recherches nécessitent Internet et peuvent être facturées sur votre compte API OpenAI. Un abonnement ChatGPT ne fournit pas ce crédit API. La première recherche permet de vérifier les accès et le quota de la clé.

## Écouter et utiliser la bulle

Le micro demande l’autorisation Android à son premier usage. L’écoute doit être démarrée depuis Interprete visible à l’écran. Elle utilise un service de premier plan avec une notification et les indicateurs de confidentialité du système.

Dans les réglages, **Activer la bulle au-dessus des applications** ouvre une autorisation Android distincte. Après l’avoir accordée, revenez dans Interprete. La bulle apparaît lorsque vous quittez le volet, peut être déplacée et permet de revenir à l’assistant. Cette option peut être indisponible sur certains appareils ou modes Android Go.

- Le bouton micro démarre ou met en pause l’écoute.
- La croix du volet arrête le micro et réduit l’application.
- La touche Accueil peut laisser continuer l’écoute déjà démarrée. La notification permet de la mettre en pause ou d’arrêter l’assistant.
- L’application ne redémarre pas automatiquement l’écoute après un arrêt ou un redémarrage du téléphone.

Le micro capte le son autour du téléphone ou l’entrée audio choisie par Android. **L’audio interne d’une autre application et les appels ne sont pas capturés directement.** Utilisez des haut-parleurs ou une entrée adaptée. Les restrictions de batterie du constructeur peuvent affecter le fonctionnement en arrière-plan.

L’audio est envoyé à OpenAI par extraits d’environ 12 secondes. Les buffers sont temporaires en mémoire, sans fichier audio conservé par Interprete. La transcription reste automatique et peut être erronée. Une file d’attente limitée met l’écoute en pause en cas de retard important ; les erreurs sont affichées.

## Vérifications et archives

La saisie accepte une phrase, un article ou un lien public. Les cartes présentent les pistes de relance, le contexte et les sources associées. Une conclusion sans source exploitable devient « Informations insuffisantes ».

Le compte rendu HTML/JSON est enregistré avec le sélecteur de fichiers Android, à l’emplacement choisi. Aucune permission générale d’accès au stockage n’est demandée. Après un export HTML, **Voir le dernier compte rendu** permet d’explorer la carte dans l’application, sans interface donnant accès à la clé API. Le fichier peut aussi être transféré sur un ordinateur.

La session active reste en mémoire : exportez avant de quitter. Une destruction du processus par Android peut perdre une session non exportée. Aucun interlocuteur n’est identifié automatiquement. Importer une archive passée fournit un contexte limité, pas une comparaison exhaustive de toutes les interviews.

Cette application reste un **prototype expérimental**. Les citations et conclusions ne sont pas certifiées exactes. Relisez les documents originaux et recoupez avant un usage journalistique en direct.

## Compiler et signer

Préparez JDK 17 ou ultérieur, Python 3 et le SDK Android 36 :

```sh
cd android
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleRelease
```

Le wrapper et la distribution Gradle sont vérifiés contre leurs empreintes officielles. Les ressources publiques sont copiées depuis `static/` ; les consignes sont extraites littéralement de `server.py`, sans copier de variable d’environnement. Le build `release` est non débogable et initialement non signé.

Le workflow `build-android.yml` compile les APK, exécute les tests et prépare une version destinée aux essais dans l’émulateur. Les réponses OpenAI et la source audio des essais sont simulées : ces tests ne certifient pas la fidélité d’un micro réel ni l’exactitude journalistique.

Pour la version 0.3.0, les sept tests unitaires et le contrôle Android passent. Le [parcours dans l’émulateur Android 35](https://github.com/grecdel/Interprete/actions/runs/41964216914) vérifie la saisie et le chiffrement de la clé, une vérification simulée, l’écoute, la conservation de la dernière phrase après un arrêt depuis la notification et l’écriture d’un compte rendu HTML contenant la transcription et la carte.

La signature de distribution se fait hors CI avec `scripts/sign_android.py`. Les fichiers privés restent dans `.android-signing/`, ignorés par Git et non incorporés dans l’APK. **Conservez une sauvegarde privée et sûre de ce dossier pour les futures mises à jour** : recréer une identité différente ne permet pas de mettre à jour les installations existantes. Ne publiez jamais ce dossier, son mot de passe ou le magasin de clés.
