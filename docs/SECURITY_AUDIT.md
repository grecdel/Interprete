# Audit de sécurité — version 0.5

Date : **5 novembre 2026**. Audit réalisé pendant le développement, par revue de code, contrôles de dépendances et tests de régression. Ce rapport n’est ni un pentest indépendant ni une certification de sécurité ou d’exactitude journalistique.

## Corrections effectuées

| Constat | Correction | Vérification |
| --- | --- | --- |
| Le client OSINT Python suivait automatiquement les redirections | Refus explicite des redirections pour les connecteurs documentaires ; Android les refusait déjà | Test de redirection refusée |
| Filtrage incomplet des liens et représentations IPv4 ambiguës | Refus des hôtes privés/locaux, identifiants, ports non HTTPS, caractères de contrôle et adresses numériques non canoniques | Tests Python et Android |
| Réponses documentaires malformées susceptibles de provoquer une erreur non maîtrisée | Validation de la structure et des identifiants ; erreurs affichées plutôt que résultats fabriqués | Tests de réponses malformées et d’identifiants dangereux |
| Six alertes npm modérées provenant de minimatch dans la chaîne de packaging | Override ciblé des seules versions 7–10 vers 11.0.1, en conservant les anciennes API 3 et 5 ; lockfile régénéré | `npm audit` : zéro vulnérabilité connue après correction ; packaging soumis à CI avant publication des exécutables |
| Contrôles de sécurité non systématiques dans GitHub Actions | Workflow dédié aux audits npm/Python et aux régressions, avec permissions GitHub en lecture seule | Workflow `security.yml` |

## Contrôles réalisés

- `npm audit` sur le lockfile : **0 alerte connue** après correction, toutes sévérités confondues au moment de l’audit.
- `pip-audit -r requirements-build.txt` : **aucune vulnérabilité connue** signalée pour les dépendances Python de fabrication.
- Inspection des fichiers suivis par Git : aucun magasin de signature privé, `.env` ou fichier de mot de passe suivi ; recherche de motifs de clés privées/API sans affichage de leurs valeurs : aucun motif détecté dans les fichiers texte examinés, hors bibliothèques tierces embarquées.
- Régressions Python : 26 tests ; bureau JavaScript : 5 tests. Scénarios navigateur : 15 tests.
- Revue des frontières : API locale réservée à la boucle locale ; contrôle d’origine des POST ; nonce privé sur bureau ; origines de la WebView contrôlées ; clés Android chiffrées avec Keystore ; aucune clé dans les ressources distribuées ; import de texte rendu avec `textContent` ; exports JSON échappés ; identifiants des extraits ZIP contraints ; plafonds de taille et délais pour les connecteurs.
- Signatures et empreintes des téléchargements contrôlées avant publication ; clé privée de signature conservée hors Git et hors CI.

## Portée et limites

Les audits de dépendances couvrent les avis connus par leurs bases au moment du contrôle ; ils ne prouvent pas l’absence de faille. Le scan de motifs de secrets n’est pas une analyse exhaustive de tout l’historique Git ni une preuve qu’aucun secret d’un format inconnu n’existe.

Les modèles et moteurs PDF/OCR copiés dans `static/vendor` sont distribués localement avec leurs licences ; les avis npm ne remplacent pas une analyse approfondie de chaque binaire et modèle. Les dépendances Gradle Android et les bibliothèques natives ne font pas l’objet d’une certification indépendante dans cet audit.

Les fichiers d’enquête et audios restent des données sensibles. Le stockage privé et les empreintes ne prouvent pas l’authenticité d’un document. Les requêtes publiques sont envoyées au fournisseur choisi ; les fichiers ne sont pas transmis automatiquement aux connecteurs. La transcription en ligne utilise OpenAI. Certains SDK peuvent transmettre des diagnostics techniques selon leurs conditions ; l’image OCR Android est traitée localement.

Wayback a répondu HTTP 429 et GDELT HTTP 503 pendant les essais réseau ; leur disponibilité n’est pas garantie. Les essais automatisés audio utilisent une source simulée : un essai réel de trois heures sur téléphone reste nécessaire. Les autres connecteurs proposés sous licence ou accès distinct ne sont pas annoncés comme activés.

## Reproduction

```sh
npm ci --ignore-scripts
npm audit
python3 -m unittest discover -s tests -p 'test_*.py'
npm run test:desktop
pip-audit -r requirements-build.txt
```

Les builds Linux et Android exécutent en complément leurs contrôles de packaging et scénarios d’application. Voir [GitHub Actions](https://github.com/grecdel/Interprete/actions).
