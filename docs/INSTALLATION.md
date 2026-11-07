# Installer Interprète

## Android

1. Télécharger [Interprete-0.7.0-android.apk](https://github.com/grecdel/Interprete/releases/download/v0.7.0/Interprete-0.7.0-android.apk).
2. Ouvrir le fichier depuis Téléchargements ; autoriser l’installation depuis cette source si Android le demande.
3. Installer comme mise à jour de la version précédente, avec la même signature, sans désinstaller pour conserver les données mémorisées. Exporter toute session en cours avant une mise à jour.
4. Dans Réglages, renseigner la clé API OpenAI pour la transcription et les vérifications. Les connecteurs documentaires et l’OCR n’en ont pas besoin.
5. Autoriser le micro et, si souhaité, l’affichage de la bulle au-dessus des applications.

Android 8 minimum, Android System WebView à jour. Pas besoin de Python, de serveur Linux ni de Codex sur le téléphone. Les restrictions de batterie du constructeur peuvent interrompre l’écoute. [Guide Android](ANDROID.md).

## Linux x86_64

Télécharger l’[AppImage 0.7](https://github.com/grecdel/Interprete/releases/download/v0.7.0/Interprete-0.7.0-linux-x86_64.AppImage), puis dans le dossier du téléchargement :

```sh
chmod +x Interprete-0.7.0-linux-x86_64.AppImage
./Interprete-0.7.0-linux-x86_64.AppImage
```

On peut aussi autoriser l’exécution dans les propriétés du fichier, puis double-cliquer. Si AppImage/FUSE n’est pas disponible, télécharger l’archive `Interprete-0.7.0-linux-x64.tar.gz`, l’extraire et lancer `interprete` dans le dossier extrait.

Le serveur Python et l’interface sont embarqués. Les builds sont validés sous Ubuntu 22.04 ; la compatibilité avec toutes les distributions n’est pas certifiée. La mémorisation de la clé est proposée uniquement si le coffre système est disponible. Sous Wayland, le comportement « toujours au-dessus » dépend du gestionnaire de fenêtres. L’audio long conservé et son export ZIP restent des fonctions Android.

## Mode web local : Windows, macOS et Linux

Ce mode nécessite **Python 3.11 ou plus récent** ([site officiel](https://www.python.org/downloads/)) et les fichiers du dépôt. Sous Windows, activer l’option d’ajout de Python au PATH pendant son installation. Aucun exécutable Windows ou macOS n’est annoncé comme publié ou testé.

```sh
git clone https://github.com/grecdel/Interprete.git
cd Interprete
```

Créer une clé OpenAI depuis son compte, puis configurer la variable uniquement sur son ordinateur, sans l’enregistrer dans Git :

Windows PowerShell ou invite de commandes :

```powershell
py -3 -c "import getpass,os,runpy;os.environ['INTERPRETE_API_KEY']=getpass.getpass('Cle API OpenAI : ');runpy.run_path(os.path.abspath('server.py'),run_name='__main__')"
```

macOS / Linux :

```sh
python3 -c "import getpass,os,runpy;os.environ['INTERPRETE_API_KEY']=getpass.getpass('Cle API OpenAI : ');runpy.run_path(os.path.abspath('server.py'),run_name='__main__')"
```

La clé est saisie sans affichage et n’est pas inscrite littéralement dans l’historique de la commande. Sans Git, utiliser **Code → Download ZIP** sur GitHub, extraire les fichiers et ouvrir un terminal dans le dossier extrait.

Ouvrir **http://127.0.0.1:8000** sur le même ordinateur. Sans clé, les outils locaux et les recherches documentaires restent utilisables. Le micro web dépend du navigateur ; les fonctions natives Android, sa bulle système et son audio long ne sont pas reproduits par ce mode. Ne pas exposer ce serveur local sur Internet.

## iPhone et iPad

Aucune application iOS ni procédure d’installation native n’est fournie. L’APK est réservé à Android. Ne pas considérer l’écoute en arrière-plan ou l’accès à un serveur installé sur un autre appareil comme des fonctions iOS validées.

## Vérifier un téléchargement

Les versions GitHub fournissent des fichiers d’empreintes SHA-256 et, pour Android, `SIGNATURE.txt`. Comparer le nom exact et l’empreinte du fichier téléchargé. Une empreinte prouve la correspondance des octets au téléchargement publié, pas l’exactitude des conclusions journalistiques.
