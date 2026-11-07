# Évolution d’Interprete

## État de cette modification

Ajoutés au code : sélecteur pastel/sombre/Matrix, boule organique animée et assortie, respect de la réduction des animations, atelier de liens de recherche vers INSEE, Eurostat, Légifrance, Vie publique, AFP Factuel et PubMed. Ces liens ouvrent une recherche Google limitée au domaine choisi et peuvent transmettre le texte saisi à Google ; aucun envoi n’a lieu avant le clic. Ils ne constituent pas des connecteurs ni une vérification automatique. Le thème est mémorisé seulement si le stockage du navigateur est disponible.

L’APK publié v0.3.0 ne contient pas ces modifications. La conservation audio et la fresque décrites ci-dessous restent à implémenter.

## Audio et fresque : conception cible

Conserver les segments audio dans l’espace privé du téléphone pendant que la transcription continue par petits extraits. Une longue interview ne doit pas être accumulée en RAM. Prévoir les durées 30 minutes, 1 heure et 3 heures, avec espace disque estimé et arrêt explicite ; aucune durée garantie avant des essais sur appareil réel.

Chaque segment doit porter un identifiant, son début et sa fin sur l’horloge monotone de la session et son empreinte SHA-256. Chaque fragment de transcription référence les segments correspondants. Les heures actuelles de réception de transcription ne suffisent pas pour synchroniser l’audio : il faut enregistrer les temps de capture. Ne pas inventer de précision au mot sans alignement audio.

Exporter un dossier ZIP contenant le compte rendu HTML, les données JSON et les pistes audio relatives, avec manifeste d’intégrité. Garder également un export texte seul. Le compte rendu doit jouer l’extrait associé à une affirmation et permettre sa réécoute en contexte. Une correction de transcription conserve l’original, sa date et sa justification.

La fresque présente une scène par séquence : bande chronologique, locuteurs, propos, preuves, interprétations, tensions et questions ouvertes. Les éléments partagent des repères visuels et temporels. Les relations distinguent citation, preuve, contexte et contradiction potentielle ; les inférences restent visuellement séparées des propos. Sélectionner un élément isole son voisinage et ouvre l’extrait audio. Prévoir une vue liste accessible, une légende, la recherche et le zoom, sans coder le verdict uniquement par la couleur.

## Propositions priorisées

1. Thèmes pastel, sombre et Matrix : ajoutés au code.
2. Boule en floraison assortie au thème : ajoutée au code.
3. Animation réduite selon les préférences système : ajoutée au code.
4. Atelier de recherche par sources publiques : liens ajoutés au code.
5. Audio long conservé sur disque avec estimation de l’espace.
6. Lecture de l’extrait audio depuis chaque propos transcrit.
7. Archive ZIP autonome avec audio, HTML, JSON et empreintes.
8. Fresque chronologique au lieu du graphe uniforme.
9. Portraits ou initiales des locuteurs, avec attribution corrigible.
10. Comparaison côte à côte de deux propos et de leurs contextes.
11. Explication en français courant du jargon politique, avec termes d’origine.
12. Décomposition d’une phrase complexe en affirmations vérifiables.
13. Séparation visuelle entre fait, opinion, promesse et prévision.
14. Recalcul des pourcentages, budgets et variations avec étapes visibles.
15. Vérification des unités, monnaies, dates et périmètres.
16. Documents primaires prioritaires : INSEE, Eurostat, textes officiels.
17. Vérification mot à mot des citations contre le document original.
18. Historique de publication, correction et consultation des sources.
19. Archives web pour comparer des versions publiques d’une page.
20. Recherche scientifique avec DOI et signalement des rétractations.
21. Détection des sources qui se recopient pour éviter le faux recoupement. Ajouté dans la 0.7.
22. Identification d’une source antérieure commune à plusieurs articles.
23. Cache des documents avec date, provenance et règles d’expiration.
24. Dossier préparatoire par interview pour réduire les recherches en direct. Ajouté dans la 0.7.
25. Deux vitesses : relance rapide explicitement provisoire, enquête approfondie. Ajouté dans la 0.7.
26. Priorisation des affirmations selon leur impact et leur vérifiabilité.
27. Indicateur du niveau de preuve, distinct de la certitude du modèle. Ajouté dans la 0.7.
28. Questions de relance courtes avec justification et source associée.
29. Comparaison d’archives avec contrôle des dates et des interlocuteurs.
30. Correction de la transcription avec journal des modifications. Ajouté dans la 0.7.
31. Recherche multilingue et conservation des citations dans leur langue.
32. Mode hors ligne pour enregistrer et prendre des notes, recherches différées.
33. Tableau de bord de latence, coût API et extraits encore non traités.
34. Batterie de cas journalistiques évalués humainement avant chaque version.
35. Suppression des données et durée de conservation configurables.
36. Export d’un dossier de preuves partageable avec la rédaction. Ajouté dans la 0.7.

## Conditions de qualité

La popularité d’un domaine et l’assurance du modèle ne prouvent pas une affirmation. Une preuve doit conserver son origine, sa date, son passage pertinent et ses limites. Signaler les propos mal entendus, les extraits manquants et les recherches incomplètes. Aucun dispositif ne garantit une fiabilité journalistique infaillible.

## Tableau « enquête » ajouté au code

Le thème Enquête est sélectionnable dans l’application et dans la carte du compte rendu HTML. Il comprend un tableau en liège, des fiches papier, des dossiers, des punaises, des fils rouges et des photos importées présentées en Polaroïd. Les étiquettes des liens restent consultables : les fils rouges ne signifient pas tous une contradiction.

La barre de recherche ignore la casse et les accents et recherche dans les propos, les catégories et les textes des pièces. Les commandes permettent de zoomer, de revenir à une vue d’ensemble et d’isoler les liens ou les incohérences potentielles.

Un sélecteur permet d’importer des pièces dans la carte. Sélectionner d’abord une fiche associe explicitement les pièces à cette fiche. Dans cette vue autonome, ces imports restent temporaires ; le dossier d’enquête de l’application fournit la conservation locale, les annotations et l’export des originaux. Les miniatures des photos importées dans le dossier sont incorporées au compte rendu ; les binaires originaux restent séparés.

L’ambiance jazzy est une petite boucle instrumentale synthétisée localement avec Web Audio. Elle démarre uniquement au clic, se coupe au changement d’ambiance ou lorsque la page est masquée, et ne demande aucun service musical externe.

Validation : tests navigateur de recherche, import texte/photo, association explicite et lecture/arrêt de l’ambiance ; suite Python et bureau ; compilation locale du code Java Android. Ces changements ne sont pas encore dans l’APK v0.3.0 publié. Les autres évolutions approuvées (dont l’audio long et les connecteurs API) restent à implémenter.
