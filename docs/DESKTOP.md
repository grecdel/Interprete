# Utiliser Interprete sur Linux

## Télécharger et ouvrir

Dans [GitHub Releases](https://github.com/grecdel/Interprete/releases), choisissez le fichier `Interprete-0.2.0-linux-x86_64.AppImage`. Cette distribution cible Linux sur processeur Intel/AMD 64 bits ; elle ne convient pas à ARM. Les builds GitHub sont produits sur Ubuntu 22.04.

Dans le gestionnaire de fichiers, ouvrez les propriétés du téléchargement et autorisez son exécution. Double-cliquez ensuite sur le fichier. En terminal :

```sh
chmod +x Interprete-0.2.0-linux-x86_64.AppImage
./Interprete-0.2.0-linux-x86_64.AppImage
```

Si votre distribution ne fournit pas FUSE compatible AppImage, prenez l’archive `.tar.gz`, extrayez-la et lancez le fichier `interprete` qu’elle contient. Conservez les fichiers voisins : ils font partie de l’application. Le système doit fournir les bibliothèques d’une session de bureau Linux moderne et autoriser le confinement Chromium. Ne désactivez pas le sandbox pour contourner une politique de votre ordinateur.

Pour vérifier les téléchargements, placez le fichier `SHA256SUMS` avec les deux archives puis utilisez `sha256sum -c SHA256SUMS`.

## Au premier lancement

Interprete ouvre un volet compact et ses réglages. Collez votre clé **API OpenAI**, puis cliquez sur **Utiliser cette clé**. Une recherche réelle confirmera si cette clé possède les accès et le quota nécessaires. La présence d’une clé ne prouve pas sa validité.

La mémorisation est désactivée si aucun coffre sécurisé n’est disponible. Si vous l’activez, la clé est chiffrée avec le mécanisme du système via Electron `safeStorage` et stockée dans le profil utilisateur d’Interprete. Le mode de stockage Linux `basic_text` est refusé. Sans mémorisation, la clé reste en mémoire jusqu’à la fermeture. L’option de mémorisation peut être retirée en saisissant une clé sans cocher la case : l’ancienne copie chiffrée est alors supprimée.

Ne placez jamais votre clé dans GitHub, une capture d’écran ou un message. La clé d’un environnement de développement n’est pas transportée dans l’AppImage.

## La bulle et le micro

La croix du volet réduit Interprete en bulle et arrête l’écoute. Cliquer sur la bulle rouvre le volet et demande l’accès au micro. Une poignée discrète au-dessus de la bulle permet de la déplacer ; l’en-tête du volet permet aussi de déplacer la fenêtre.

Le placement libre et le premier plan reposent sur X11/XWayland. Si `DISPLAY` est disponible, l’application utilise X11, y compris au travers de XWayland. Sur une session Wayland sans XWayland, le placement et le maintien au premier plan peuvent être limités par le compositeur. Interprete ne contrôle pas les fenêtres des autres applications.

Le micro capte l’entrée audio choisie dans votre système. **Il ne capture pas directement le son d’un autre onglet ou d’une application.** Pour un reportage diffusé sur le même ordinateur, utilisez des haut-parleurs ou une entrée audio de boucle configurée dans votre système.

Après autorisation, l’audio est envoyé à OpenAI par enregistrements successifs de 12 secondes. Le dernier extrait est transcrit quand vous arrêtez l’écoute. En cas de retard important ou d’erreur, l’écoute se met en pause et le problème est signalé. Les pauses de quelques instants entre enregistrements et les délais réseau peuvent affecter une transcription : relisez-la.

## Texte, articles et sources

La zone inférieure accepte une phrase, un article (20 000 caractères maximum) ou un lien public. Envoyez avec la flèche ou `Ctrl + Entrée`.

Une carte présente la conclusion proposée, une piste de relance, les explications et les sources associées. Ouvrez les documents d’origine pour contrôler ce qu’ils disent. Les questions proposées sont des suggestions. Une absence de sources ne réfute pas une affirmation.

La fiabilité journalistique n’est pas certifiée. Les tests techniques ne prouvent ni la vérité des affirmations ni la fidélité des citations.

## Terminer et conserver une interview

Dans le bouton d’archive de l’en-tête, choisissez **Terminer et exporter**. Interprete attend la fin de la dernière transcription, traite l’extrait encore en attente si la recherche est configurée, puis ouvre une boîte d’enregistrement de fichier HTML. Une recherche échouée est conservée comme telle.

Le fichier HTML contient la transcription horodatée, les textes soumis, les analyses, les sources et la carte des connexions. Il s’ouvre dans un navigateur hors ligne et peut être imprimé en PDF. Le bouton **JSON** conserve une version réimportable.

Une ancienne archive peut servir de contexte pour une prochaine interview. Au maximum 12 affirmations récentes de la session et 12 importées sont envoyées avec une recherche : ce n’est pas une comparaison exhaustive de toutes les archives. Aucune identification automatique des interlocuteurs n’est effectuée.

La session reste dans la mémoire de l’application. La fermeture affiche un avertissement si du contenu n’a pas été exporté. Les fichiers ne sont enregistrés qu’à l’emplacement choisi dans la boîte de dialogue.

## Données et connexion

L’interface et le serveur sont embarqués et fonctionnent localement. Un jeton aléatoire de session réserve l’API locale à l’application ; la clé API OpenAI n’est pas communiquée aux pages de votre navigateur.

La transcription envoie l’audio à l’API OpenAI ; les recherches envoient les extraits de texte ainsi que le contexte sélectionné des archives importées. Ces opérations utilisent votre crédit API. Aucun fichier audio n’est conservé par Interprete. Les requêtes de recherche utilisent `store: false` ; cela ne garantit pas l’absence de rétention chez le fournisseur. Vérifiez les règles de votre rédaction avant d’envoyer un entretien confidentiel.

## Quitter

Utilisez **Quitter Interprete** en bas du volet, ou le menu de la bulle/zone de notification. Quitter arrête le serveur local. La croix du volet, elle, garde la bulle disponible.
