# Interprète 0.7.0 — une bulle vivante, un volet épuré

La bulle devient une sphère de particules vivante, aux couleurs de chacune des cinq ambiances : une sphère en points, des rubans de fils lumineux et un anneau de poussière. Au repos, elle respire lentement ; pendant l’écoute, elle s’incline et sa surface ondule avec la voix ; pendant l’analyse, ses particules s’accélèrent et des ondes la balaient ; quand une relance est prête, elle libère une gerbe de lumière puis retrouve son calme. Sur un appareil sans processeur graphique matériel, ou si le rendu devient trop lent, une bulle simple reste en place, et la préférence système de réduction des mouvements est respectée.

## Pendant l’interview

- **La bulle est le bouton du micro** quand le volet est ouvert. La grande carte « Écouter un reportage » laisse place à une pastille sous la ligne d’état.
- **Relance rapide provisoire** : une question à poser s’affiche en quelques secondes, avant toute recherche et sans verdict, puis cède la place à la vérification sourcée. Elle coûte un petit appel en plus ; on peut la désactiver dans le menu « + ».
- **Niveau de preuve** en trois crans sur chaque carte : aucun site, un seul site, sources recoupées, recoupées et datées. Il dépend des sources jointes, pas de l’assurance du modèle.
- **Sources qui se recopient** : quand plusieurs sources reprennent une même dépêche ou un même communiqué, la carte l’indique et le niveau de preuve redescend à 1.
- **Transcription en direct sur une ligne**, dépliable d’un toucher.
- **Relance prête sur la bulle fermée** : la question s’affiche à côté de la bulle jusqu’à la réouverture du volet.
- **Ambiance rangée dans les Réglages** (bouton curseurs de l’en-tête) : par défaut, elle suit le mode clair ou sombre du système (Pastel ou Sombre) ; on peut aussi la fixer. Nouvelle ambiance **Feu**.
- **Raccourcis sur ordinateur** : Espace pour écouter ou mettre en pause, Ctrl+K pour vérifier une phrase, Échap pour fermer.

## Avant et après

- **Préparer l’interview** (menu « + ») : interlocuteur, sujet, date, propos attendus à vérifier à l’avance, mots et chiffres à surveiller, jusqu’à trois pièces du dossier. Ce contexte accompagne les recherches sans jamais servir de preuve. Un mot surveillé déclenche une vérification immédiate.
- **Relire et corriger la transcription** dans l’archive : le texte entendu est conservé et chaque correction est journalisée dans le compte rendu.
- **Dossier de preuves** : un fichier HTML autonome, sans script, à transmettre à la rédaction : propos, verdicts, niveau de preuve, relances, sources, extraits, limites, pièces et corrections.

## Fiabilité et sécurité

- Le service local de l’application de bureau redémarre s’il s’arrête et prévient l’utilisateur. La clé n’est plus transmise par variable d’environnement.
- Le mode web refuse les requêtes dont l’hôte n’est pas la machine locale (protection contre le DNS rebinding).
- Les annotations d’une pièce ne sont plus écrasées par une extraction PDF ou OCR en cours.
- La fenêtre flottante garde le dossier, l’atelier OSINT et le thème.
- Android ne peut plus livrer la réponse d’une page précédente à une nouvelle demande.
- Sur ordinateur, les sources réellement consultées par la recherche sont retenues comme sur Android ; une adresse inventée reste refusée.
- Application de bureau : plus de rechargement accidentel par Ctrl+R, plus d’outils de développement dans la version distribuée.

## Installation

- Android 8+ : installer `Interprete-0.7.0-android.apk`. La bulle au-dessus des applications utilise le nouveau rendu à partir d’Android 13.
- Linux x86_64 : rendre `Interprete-0.7.0-linux-x86_64.AppImage` exécutable, puis le lancer. Une archive portable `.tar.gz` est également fournie.
- Les sommes SHA-256 et les informations de signature Android accompagnent les fichiers.

Prototype : les conclusions et les sources doivent être contrôlées avant un usage journalistique.
