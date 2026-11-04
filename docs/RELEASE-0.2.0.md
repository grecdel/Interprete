Interprete devient une application de bureau pour **Linux x86_64**.

- Un fichier **AppImage**, avec une archive portable `.tar.gz` en alternative.
- Python et le serveur local sont embarqués : aucune configuration Codex à faire.
- Une vraie fenêtre au premier plan, réductible en bulle, avec prise en charge de X11/XWayland.
- La clé API se saisit dans les réglages de l’application ; mémorisation optionnelle via le coffre du système.
- Capture au micro transcrite par extraits via OpenAI, saisie de texte/article/lien et pistes de relance.
- Export HTML/JSON avec transcription, sources et carte des connexions.
- Une présentation GitHub illustrée de captures réelles, avec données fictives de démonstration.

**Pour ouvrir l’AppImage :** autorisez son exécution dans les propriétés du fichier,
ou utilisez `chmod +x Interprete-0.2.0-linux-x86_64.AppImage`, puis double-cliquez dessus.
L’archive portable contient un fichier `interprete` à lancer après extraction.
Le fichier SHA256SUMS permet de vérifier l’intégrité des téléchargements.

Une clé API OpenAI et du crédit API sont nécessaires aux recherches et à la transcription.
Les tests audio et de recherche sont simulés. Cette version reste un **prototype
expérimental**, sans certification d’exactitude journalistique ni garantie de temps réel.
Les sources, citations et conclusions doivent être contrôlées avant publication ou relance factuelle à l’antenne.
