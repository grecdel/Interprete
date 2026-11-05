# Utiliser Interprète

## Se repérer dans le volet latéral

Au premier lancement, Interprète se présente et propose un thème : pastel, sombre, Matrix ou enquête. Ensuite, seule la bulle animée apparaît. Un clic propose trois actions : **Record** pour démarrer l’écoute et l’analyse, **Requête textuelle** pour saisir un contenu, ou **Ouvrir le panneau latéral** pour retrouver les outils. Le micro nécessite les permissions et la configuration. Sur bureau, le volet occupe une partie du bord de l’écran ; sur mobile, il s’adapte à la place disponible. Le maintien au-dessus des autres applications dépend du système. Android demande une permission spécifique pour la bulle.

Quand le volet est ouvert, la même bulle se place en haut au centre et reste animée. Elle retrouve sa position flottante à la réduction. Les animations respectent le réglage système de réduction des mouvements.

Dans le volet, l’en-tête donne accès aux **réglages**, à l’**archive** et à la réduction. La commande **micro** se trouve au-dessus du fil. Le **fil des vérifications** contient les analyses, sources et pistes de relance. La **zone de saisie** permet de vérifier une phrase, un article ou un lien. Le bouton **Dossier d’enquête** ouvre les documents et les connecteurs ; les outils locaux de lecture et calcul se déplient dans le volet.

Choisir l’ambiance dans le sélecteur de thème : pastel (eau), sombre (électricité violette), Matrix (données numériques) ou enquête (fumée). La matière de la bulle et ses particules orbitales changent immédiatement avec le thème. La préférence système de réduction des animations arrête aussi les particules. Réduire le volet arrête le micro. Sur Android, la touche Accueil peut laisser continuer une écoute déjà démarrée ; utiliser les commandes de la notification pour la mettre en pause ou arrêter l’assistant.

## Exemple 1 — Interview en direct

**Situation fictive :** l’interlocuteur affirme que le budget a augmenté de 20 %.

1. **Préparer.** Importer le document de référence dans le dossier ; noter sa source, sa date et son périmètre. Extraire le texte du PDF ou utiliser l’OCR d’une image si nécessaire. Les scans PDF sans couche texte nécessitent encore une conversion des pages en images pour l’OCR.
2. **Écouter.** Autoriser le micro puis activer l’écoute, ou saisir la phrase pour éviter une erreur de transcription. Le micro capte l’entrée audio choisie par le système : il ne capture pas directement le son interne d’une autre application ni un appel.
3. **Lire.** Examiner les sources et les limites de l’analyse. Une conclusion sans preuve exploitable ne doit pas être retenue parce qu’elle semble assurée.
4. **Rebondir.** Envisager une question comme « Quel budget, pour quelle période et selon quel périmètre ? » Vérifier la pièce originale avant une relance factuelle.
5. **Conserver.** Exporter le compte rendu et le JSON. Sur Android, si l’audio a été conservé, utiliser le ZIP pour joindre les WAV.

Un passage de 100 à 120 représente +20 %. Un passage d’un taux de 10 % à 12 % représente +2 points de pourcentage, et +20 % relativement au taux initial. Interprète aide à faire ces distinctions ; le choix des chiffres comparables reste à justifier.

## Exemple 2 — Vérifier un article avant publication

Coller l’extrait ou le lien dans la zone de saisie, lancer la vérification puis ouvrir les sources originales. Un contenu inaccessible ou payant n’est pas considéré comme lu : coller le passage autorisé à examiner.

Dans le dossier d’enquête, interroger le fournisseur adapté : données publiques avec data.gouv.fr, publications avec Crossref ou Europe PMC, entités avec Wikidata, sociétés avec l’Annuaire des entreprises. Wayback recherche une capture existante d’une URL ; GDELT découvre des articles ; Open Library fournit des notices d’ouvrages. Les quotas et disponibilités des services peuvent empêcher une recherche.

Conserver les notices utiles avec leur date et leur provenance, puis consulter les documents complets. Plusieurs articles ne constituent pas forcément plusieurs confirmations indépendantes.

## Exemple 3 — Relire un dossier documentaire

Importer les pièces, utiliser la recherche sur les noms, notes et textes extraits, puis annoter les passages importants. Le bouton de préparation place un extrait dans la zone de vérification ; il ne lance pas d’envoi automatiquement.

Le glossaire explique certains termes présents dans une phrase. Le comparateur cherche une citation dans le texte d’un document après normalisation des espaces. Une correspondance textuelle ne certifie ni l’authenticité du document ni le contexte de la citation. Les empreintes SHA-256 permettent de comparer les octets d’une pièce, sans prouver sa véracité.

Le dossier local est partagé entre les sessions sur cet appareil. Exporter les pièces et leurs annotations pour les sauvegarder ; effacer les données du navigateur ou de l’application peut supprimer les copies locales.

## Exemple 4 — Comparer deux interviews

Conserver l’archive JSON de la première interview, puis l’importer depuis l’archive du volet lors de la suivante. Elle fournit du contexte aux recherches ultérieures ; elle ne réalise pas une comparaison exhaustive de tout ce qui a été dit.

Dans le compte rendu, sélectionner les fiches pour suivre leurs liens. Contrôler les dates, interlocuteurs et périmètres avant de qualifier une divergence de contradiction. La transcription n’identifie pas automatiquement les personnes.

## Choisir le bon export

| Export | Contenu et usage |
| --- | --- |
| **HTML** | Compte rendu et carte consultables hors ligne ; ouverture des sources en ligne. N’embarque pas les fichiers audio. |
| **JSON de session** | Données de session et contexte réimportable pour une autre interview ; inventaire des pièces, pas tous leurs binaires originaux. |
| **JSON d’une pièce** | Original encodé et annotations, réimportables dans le dossier avec vérification d’empreinte. |
| **ZIP audio Android** | `index.html`, `session.json` et extraits WAV ; décompresser en conservant les dossiers pour réécouter les propos. |

Les pièces importées directement dans une carte autonome sont temporaires. Pour les conserver, les importer dans le dossier de l’application avant d’exporter. Les durées audio Android sont des plafonds dépendant du stockage et du téléphone ; le fonctionnement réel pendant trois heures n’a pas encore été validé sur appareil physique.

[Installer](INSTALLATION.md) · [Fonctions et limites](VERSION-0.4.md) · [OSINT](OSINT.md) · [Audit de sécurité](SECURITY_AUDIT.md)
