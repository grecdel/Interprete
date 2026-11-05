# Atelier d’enquête et intégrations OSINT

## Socle ajouté au code

Le dossier d’enquête conserve les pièces dans IndexedDB sur l’appareil. Limites actuelles : 8 Mio par pièce, 64 Mio pour le dossier. Extraction locale des textes TXT, Markdown, CSV, JSON et sous-titres SRT/VTT ; aperçu limité à 200 000 caractères. Les PDF peuvent être lus et leur texte extrait ; les images PNG/JPEG/WebP peuvent être traitées par OCR français/anglais local, au clic. Les autres formats sont conservables sans extraction spécifique. Voir les limites dans VERSION-0.4.md. Recherche dans les noms, notes et textes ; empreintes SHA-256 et dédoublonnage ; provenance renseignée par l’utilisateur ; association à une affirmation de la session ; préparation explicite d’un extrait à vérifier.

L’export de session HTML/JSON conserve l’inventaire, le texte extrait et les annotations, pas les fichiers binaires originaux. Chaque pièce peut aussi être exportée séparément dans un conteneur JSON comprenant son original encodé en base64 et ses annotations ; ce conteneur se réimporte dans le dossier avec contrôle de l’empreinte. La bibliothèque est commune aux sessions sur cet appareil. Elle n’est pas une sauvegarde : effacer les données de l’application ou du navigateur peut l’effacer. Les empreintes ne prouvent pas l’authenticité d’un document. Huit connecteurs API sont intégrés : Crossref, data.gouv.fr, Annuaire des entreprises, Europe PMC, Wikidata, Wayback, GDELT et Open Library. Les autres raccourcis de recherche sont des liens externes. Les notices enregistrées ne remplacent pas la lecture du document original.

## Connecteurs proposés

Les capacités ci-dessous comprennent les trois connecteurs intégrés et les propositions restantes, indiquées dans la colonne de droite. Vérifier les conditions, quotas, licences et disponibilités actuelles avant activation ; ne pas promettre une API universelle ou gratuite. Les fichiers privés ne sont pas transmis à ces services sans action explicite.

| Service / outil connu | Usage dans Interprete | Mode d’intégration envisagé / contrainte |
| --- | --- | --- |
| INSEE / Eurostat | Séries statistiques, dates, périmètres, unités | API officielles selon jeu ; certaines API INSEE requièrent un compte |
| data.gouv.fr | Jeux de données publics français | **Intégré** : API du catalogue ; conserver licence, producteur et version |
| Légifrance / PISTE | Textes de loi et versions applicables à une date | API avec accès PISTE ; ne pas confondre texte actuel et texte historique |
| EUR-Lex / CELLAR | Droit et documents de l’Union européenne | Services officiels ; formats et accès à valider |
| Crossref | DOI, métadonnées et liens des publications | **Intégré** : API publique ; métadonnées, pas garantie d’accès au texte intégral |
| OpenAlex | Publications, auteurs et références | API ; conditions de clé et quotas à vérifier |
| PubMed / NCBI E-utilities | Littérature biomédicale | API ; limites de débit, clé selon usage |
| Unpaywall | Localiser une version légalement ouverte d’un article | API avec adresse de contact ; ne contourne pas les paywalls |
| Wayback Machine / CDX | Versions publiques anciennes d’une page | API / consultation selon disponibilité ; date d’archive distincte de date de publication |
| GDELT | Repérer une couverture médiatique et ses évolutions | API de découverte ; les articles restent à vérifier |
| Wikidata | Identifier et désambiguïser personnes, lieux et organismes | SPARQL / API ; point de départ avec références à contrôler |
| OpenCorporates | Identifier une société et ses liens publics | API avec accès/licence appropriés ; couverture variable |
| Annuaire des entreprises / Sirene | Identifiants et établissements français | **Intégré pour l’Annuaire des entreprises** via son API de recherche publique ; accès Sirene complet distinct |
| OpenSanctions | Comparer des entités à des listes documentées | API / licence adaptée ; homonymie et faux positifs à traiter |
| RDAP | Enregistrement d’un domaine et registre compétent | Protocoles/services publics ; données parfois masquées |
| crt.sh | Certificats publics et noms de domaine associés | Consultation / accès à valider ; présence d’un nom ≠ attribution d’un propriétaire |
| OpenStreetMap / Overpass | Contexte géographique d’un événement | API avec quotas ; une carte ne prouve pas à elle seule une localisation |
| Sentinel Hub / Copernicus | Comparaison temporelle d’images satellites | Comptes, licences, quotas et couverture à vérifier |
| InVID-WeVerify | Vérification de vidéos et recherche d’images clés | Compagnon navigateur ou parcours d’export ; ne pas promettre d’intégrer l’extension telle quelle dans Android |
| Google Lens / TinEye | Recherche d’images inversée | Ouverture utilisateur ; API TinEye selon offre, pas d’API Lens générale présumée |
| VirusTotal / urlscan.io | Réputation et contexte technique d’une URL publique | Clés/quota ; certaines soumissions deviennent publiques : pas d’envoi automatique de pièces privées |
| Aleph / OCCRP | Recherche dans des corpus et documents | Accès au corpus et droits nécessaires ; pas d’accès universel présumé |

## Outils à embarquer localement

- PDF.js **intégré** : lecture et extraction de PDF, sans contourner les restrictions d’accès.
- Tesseract OCR **intégré pour les images** : texte des scans, avec affichage de l’image et correction humaine.
- ExifTool : métadonnées et provenance technique ; intégration bureau via processus isolé, adaptation Android distincte.
- FFmpeg : découpage audio/vidéo et images clés ; vérifier la licence de la configuration distribuée et les limites mobiles.
- Moteur SQLite FTS : index de dossiers volumineux, recherche hors ligne et filtres.
- Extraction CSV et calculs déterministes : pourcentages, conversions d’unités et tableaux comparables ; conserver les hypothèses.

## Outils propres à Interprete

1. **Loupe de preuve** : ouvrir ensemble le propos, son audio, le passage exact du document, sa date et ses réserves.
2. **Décodeur de discours** : expliquer le jargon et décomposer les assertions sans attribuer une intention au locuteur.
3. **Contrôleur de périmètre** : signaler les changements de période, population, monnaie ou dénominateur.
4. **Trace des reprises** : distinguer dix articles indépendants de dix reprises d’une même dépêche.
5. **Comparateur de versions** : montrer ce qui a changé entre deux documents, avec dates et passages.
6. **Table de confrontation** : aligner deux affirmations et leurs contextes avant de parler de contradiction.
7. **Fresque de scène** : séquences, locuteurs, lieux, preuves et incertitudes ; un élément sélectionné isole ses liens.
8. **Préparateur de relances** : question courte, preuve associée, objection possible et limite de la conclusion.
9. **Manifeste d’intégrité** : inventaire des fichiers et empreintes, journal des corrections et export portable.
10. **File d’enquête** : recherches prioritaires, résultats provisoires, délais et budget API visibles.

## Ordre d’intégration

1. Dossier local, provenance, empreintes, annotations et inventaire exporté : socle présent dans cette modification.
2. Lecture PDF/OCR et export portable des pièces : intégrés ; index complet de grands corpus à développer.
3. Crossref, data.gouv.fr et Annuaire des entreprises : intégrés avec notices conservables ; autres connecteurs statistiques et juridiques à développer.
4. Conservation audio Android sur disque, association aux fragments et export ZIP : intégrés au code 0.4 ; synchronisation au mot non fournie.
5. Tableau enquête et comparaison textuelle de citations : intégrés ; fresque chronologique complète et comparaison de versions à développer.
6. Connecteurs spécialisés : entreprises, géographie, archives et médias, selon les accès obtenus.

La version Android 0.4 réunit ces ajouts. Les autres services du catalogue, l’alignement audio au mot et la fresque chronologique complète restent à développer. Consultez VERSION-0.4.md pour les limites, les plateformes concernées et la validation.


## Extension 0.5

Europe PMC donne accès aux notices biomédicales, dont des références PubMed ; il ne s’agit pas d’un accès universel au texte intégral. Wikidata sert à identifier des entités et leurs références. Wayback recherche une capture existante d’une URL HTTPS publique : il ne crée pas de capture. GDELT découvre des articles et ne prouve pas l’indépendance de leurs sources. Open Library fournit des notices bibliographiques.

Essais réseau du 5 novembre 2026 : Europe PMC, Wikidata et Open Library ont renvoyé des résultats ; Wayback a répondu HTTP 429 et GDELT HTTP 503. Ces services restent soumis à leurs quotas et disponibilités. Les erreurs sont affichées, sans fabriquer de résultats.

Les services sous licence ou avec accès propre (OpenCorporates, OpenSanctions, certains services juridiques, etc.) restent non activés. Les extensions navigateur comme InVID ne sont pas présentées comme intégrées nativement dans Android.
