"""Public documentary searches. No OpenAI key, arbitrary URL or credential forwarding."""
import json
import re
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

_CACHE = {}
_LOCK = threading.Lock()


def search(provider, query, opener=urllib.request.urlopen):
    if provider not in ('crossref', 'data_gouv', 'entreprises'):
        raise ValueError('Connecteur inconnu.')
    if not isinstance(query, str) or not 3 <= len(query.strip()) <= 250:
        raise ValueError('La recherche doit contenir entre 3 et 250 caractères.')
    query = query.strip()
    cache_key = (provider, query)
    with _LOCK:
        cached = _CACHE.get(cache_key)
        if cached and time.monotonic() - cached[0] < 300:
            return dict(cached[1], cached=True)
    encoded = urllib.parse.quote(query, safe='')
    endpoints = {
        'crossref': 'https://api.crossref.org/works?rows=5&query=' + encoded,
        'data_gouv': 'https://www.data.gouv.fr/api/1/datasets/?page_size=5&q=' + encoded,
        'entreprises': 'https://recherche-entreprises.api.gouv.fr/search?per_page=5&q=' + encoded,
    }
    request = urllib.request.Request(endpoints[provider], headers={'Accept': 'application/json', 'User-Agent': 'Interprete/0.4 documentary-research'})
    with opener(request, timeout=20) as response:
        raw = response.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Réponse documentaire trop volumineuse.')
    payload = json.loads(raw)
    rows = payload.get('message', {}).get('items', []) if provider == 'crossref' else payload.get('data', []) if provider == 'data_gouv' else payload.get('results', [])
    results = []
    for row in rows[:5]:
        if not isinstance(row, dict):
            continue
        if provider == 'crossref':
            title = next(iter(row.get('title') or []), 'Publication sans titre')
            url = row.get('URL', '')
            details = 'DOI : ' + str(row.get('DOI', '')) + ' · Éditeur : ' + str(row.get('publisher', ''))
        elif provider == 'data_gouv':
            title, url, details = row.get('title', ''), row.get('page', ''), re.sub('<[^>]+>', ' ', row.get('description') or '')
        else:
            title = row.get('nom_complet') or row.get('nom_raison_sociale') or 'Entreprise'
            siren = str(row.get('siren', ''))
            if not re.fullmatch(r'[0-9]{9}', siren):
                continue
            url = 'https://annuaire-entreprises.data.gouv.fr/entreprise/' + siren
            details = 'SIREN : ' + siren + ' · État administratif : ' + str(row.get('etat_administratif', ''))
        parsed = urllib.parse.urlsplit(str(url))
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
            continue
        results.append({'title':str(title)[:500], 'url':str(url)[:2000], 'description':str(details)[:3000], 'provider':provider})
    output = {'provider':provider, 'query':query, 'results':results, 'retrieved_at':datetime.now(timezone.utc).isoformat(), 'cached':False, 'notice':'Résultats documentaires à examiner ; ils ne valident pas une affirmation.'}
    with _LOCK:
        if len(_CACHE) >= 128:
            _CACHE.pop(next(iter(_CACHE)))
        _CACHE[cache_key] = (time.monotonic(), output)
    return output
