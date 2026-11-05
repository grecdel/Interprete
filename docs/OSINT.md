# Atelier d’enquête et intégrations OSINT

## Socle ajouté au code

Le dossier d’enquête conserve les pièces dans IndexedDB sur l’appareil. Limites actuelles : 8 Mio par pièce, 64 Mio pour le dossier. Extraction locale des textes TXT, Markdown, CSV, JSON et sous-titres SRT/VTT ; aperçu limité à 200 000 caractères. Les PDF, images et autres formats peuvent être conservés mais leur contenu n’est pas encore extrait. Recherche dans les noms, notes et textes ; empreintes SHA-256 et dédoublonnage ; provenance renseignée par l’utilisateur ; association à une affirmation de la session ; préparation explicite d’un extrait à vérifier.

L’export de session HTML/JSON conserve l’inventaire, le texte extrait et les annotations, pas les fichiers binaires originaux. Chaque pièce peut aussi être exportée séparément dans un conteneur JSON comprenant son original encodé en base64 et ses annotations ; ce conteneur se réimporte dans le dossier avec contrôle de l’empreinte. La bibliothèque est commune aux sessions sur cet appareil. Elle n’est pas une sauvegarde : effacer les données de l’application ou du navigateur peut l’effacer. Les empreintes ne prouvent pas l’authenticité d’un document. Les recherches externes existantes sont des liens, pas des connecteurs API.

## Connecteurs proposés

Les capacités ci-dessous sont des propositions d’intégration. Vérifier les conditions, quotas, licences et disponibilités actuelles avant activation ; ne pas promettre une API universelle ou gratuite. Les fichiers privés ne sont pas transmis à ces services sans action explicite.

| Service / outil connu | Usage dans Interprete | Mode d’intégration envisagé / contrainte |
| --- | --- | --- |
| INSEE / Eurostat | Séries statistiques, dates, périmètres, unités | API officielles selon jeu ; certaines API INSEE requièrent un compte |
| data.gouv.fr | Jeux de données publics français | API du catalogue ; conserver licence, producteur et version |
| Légifrance / PISTE | Textes de loi et versions applicables à une date | API avec accès PISTE ; ne pas confondre texte actuel et texte historique |
| EUR-Lex / CELLAR | Droit et documents de l’Union européenne | Services officiels ; formats et accès à valider |
| Crossref | DOI, métadonnées et liens des publications | API publique ; métadonnées, pas garantie d’accès au texte intégral |
| OpenAlex | Publications, auteurs et références | API ; conditions de clé et quotas à vérifier |
| PubMed / NCBI E-utilities | Littérature biomédicale | API ; limites de débit, clé selon usage |
| Unpaywall | Localiser une version légalement ouverte d’un article | API avec adresse de contact ; ne contourne pas les paywalls |
| Wayback Machine / CDX | Versions publiques anciennes d’une page | API / consultation selon disponibilité ; date d’archive distincte de date de publication |
| GDELT | Repérer une couverture médiatique et ses évolutions | API de découverte ; les articles restent à vérifier |
| Wikidata | Identifier et désambiguïser personnes, lieux et organismes | SPARQL / API ; point de départ avec références à contrôler |
| OpenCorporates | Identifier une société et ses liens publics | API avec accès/licence appropriés ; couverture variable |
| Annuaire des entreprises / Sirene | Identifiants et établissements français | API officielle selon accès et restrictions de diffusion |
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

- PDF.js : lecture et extraction de PDF, sans contourner les restrictions d’accès.
- Tesseract OCR : texte des scans, avec affichage de l’image et correction humaine.
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
2. Lecture PDF/OCR, export portable des originaux et index local complet.
3. Connecteurs statistiques, juridiques et scientifiques avec cache daté et sources appelables.
4. Conservation audio longue durée sur disque et synchronisation aux temps de capture.
5. Fresque interactive, relecture des citations et comparaison de versions.
6. Connecteurs spécialisés : entreprises, géographie, archives et médias, selon les accès obtenus.

L’APK v0.3.0 déjà publié n’est pas remplacé par ces changements de code. Les connecteurs, l’audio long et la fresque ne doivent être annoncés comme disponibles qu’après leur implémentation et leurs essais sur chaque plateforme.
