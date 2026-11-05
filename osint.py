"""Public documentary searches. No OpenAI key, arbitrary URL or credential forwarding."""
import json
import ipaddress
import re
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise ValueError('Redirection documentaire refusée.')


def public_url(value):
    try:
        if not isinstance(value,str) or len(value)>2000 or any(ord(c)<=32 or ord(c)==127 for c in value): return False
        url=urllib.parse.urlsplit(value)
        if url.scheme!='https' or not url.hostname or url.username or url.password or url.port not in (None,443): return False
        host=url.hostname.lower()
        if '.' not in host or host.endswith(('.local','.localhost','.internal')): return False
        try: return ipaddress.ip_address(host).is_global
        except ValueError: return not bool(re.fullmatch(r'[0-9.]+',host))
    except (ValueError,TypeError): return False


_CACHE = {}
_LOCK = threading.Lock()


def obj(value):
    return value if isinstance(value,dict) else {}


def search(provider, query, opener=None):
    if provider not in ('crossref', 'data_gouv', 'entreprises','europe_pmc','wikidata','wayback','gdelt','openlibrary'):
        raise ValueError('Connecteur inconnu.')
    if not isinstance(query, str) or not 3 <= len(query.strip()) <= 250:
        raise ValueError('La recherche doit contenir entre 3 et 250 caractères.')
    query = query.strip()
    if provider=='wayback' and not public_url(query):
        raise ValueError('Utilisez une URL HTTPS publique sans identifiants pour les archives.')
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
    endpoints.update({
        'europe_pmc':'https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=5&query='+encoded,
        'wikidata':'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=fr&limit=5&search='+encoded,
        'wayback':'https://archive.org/wayback/available?url='+encoded,
        'gdelt':'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&maxrecords=5&query='+encoded,
        'openlibrary':'https://openlibrary.org/search.json?limit=5&fields=key,title,author_name,first_publish_year&q='+encoded,
    })
    request = urllib.request.Request(endpoints[provider], headers={'Accept': 'application/json', 'User-Agent': 'Interprete/0.4 documentary-research'})
    if opener is None: opener=urllib.request.build_opener(NoRedirect()).open
    with opener(request, timeout=20) as response:
        raw = response.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Réponse documentaire trop volumineuse.')
    try: payload = json.loads(raw)
    except (ValueError,RecursionError) as error: raise ValueError('Réponse documentaire illisible.') from error
    if not isinstance(payload,dict): raise ValueError('Réponse documentaire invalide.')
    message=payload.get('message')
    rows = message.get('items', []) if provider == 'crossref' and isinstance(message,dict) else payload.get('data', []) if provider == 'data_gouv' else payload.get('results', [])
    if not isinstance(payload,dict): raise ValueError('Réponse documentaire invalide.')
    if provider=='europe_pmc': rows=obj(payload.get('resultList')).get('result',[])
    elif provider=='wikidata': rows=payload.get('search',[])
    elif provider=='wayback': rows=[obj(payload.get('archived_snapshots')).get('closest',{})]
    elif provider=='gdelt': rows=payload.get('articles',[])
    elif provider=='openlibrary': rows=payload.get('docs',[])
    if not isinstance(rows,list): raise ValueError('Résultats documentaires invalides.')
    results = []
    for row in rows[:5]:
        if not isinstance(row, dict):
            continue
        if provider == 'crossref':
            names=row.get('title'); title=names[0] if isinstance(names,list) and names and isinstance(names[0],str) else 'Publication sans titre'
            url = row.get('URL', '')
            details = 'DOI : ' + str(row.get('DOI', '')) + ' · Éditeur : ' + str(row.get('publisher', ''))
        elif provider == 'data_gouv':
            title, url, details = row.get('title', ''), row.get('page', ''), re.sub('<[^>]+>', ' ', str(row.get('description') or ''))
        elif provider=='entreprises':
            title = row.get('nom_complet') or row.get('nom_raison_sociale') or 'Entreprise'
            siren = str(row.get('siren', ''))
            if not re.fullmatch(r'[0-9]{9}', siren):
                continue
            url = 'https://annuaire-entreprises.data.gouv.fr/entreprise/' + siren
            details = 'SIREN : ' + siren + ' · État administratif : ' + str(row.get('etat_administratif', ''))
        elif provider=='europe_pmc':
            identity=str(row.get('id','')); source=str(row.get('source',''))
            if not re.fullmatch('[A-Za-z0-9_.-]+',identity) or not re.fullmatch('[A-Za-z0-9_-]+',source): continue
            title=row.get('title','Publication');url='https://europepmc.org/article/'+source+'/'+identity
            details='Auteurs : '+str(row.get('authorString',''))+' · Année : '+str(row.get('pubYear',''))+' · DOI : '+str(row.get('doi',''))
        elif provider=='wikidata':
            identity=str(row.get('id',''))
            if not re.fullmatch('Q[0-9]+',identity): continue
            title=row.get('label',identity);url='https://www.wikidata.org/wiki/'+identity;details=str(row.get('description',''))+' · Références à contrôler ; entité non certifiée.'
        elif provider=='wayback':
            if not row.get('available'): continue
            title='Version archivée : '+str(row.get('timestamp',''));url=str(row.get('url','')).replace('http://web.archive.org/','https://web.archive.org/',1);details='Capture de '+query+' ; date de capture distincte de la date de publication.'
        elif provider=='gdelt':
            title=row.get('title','Article');url=row.get('url','');details='Repéré le '+str(row.get('seendate',''))+' · '+str(row.get('domain',''))+' · Les reprises ne sont pas des confirmations indépendantes.'
        else:
            key=str(row.get('key',''))
            if not re.fullmatch('/works/OL[0-9]+W',key): continue
            title=row.get('title','Ouvrage');url='https://openlibrary.org'+key;details='Auteurs : '+', '.join(str(a) for a in (row.get('author_name') if isinstance(row.get('author_name'),list) else [])[:5])+' · Première publication : '+str(row.get('first_publish_year',''))
        if not public_url(str(url)):
            continue
        results.append({'title':str(title)[:500], 'url':str(url)[:2000], 'description':str(details)[:3000], 'provider':provider})
    output = {'provider':provider, 'query':query, 'results':results, 'retrieved_at':datetime.now(timezone.utc).isoformat(), 'cached':False, 'notice':'Résultats documentaires à examiner ; ils ne valident pas une affirmation.'}
    with _LOCK:
        if len(_CACHE) >= 128:
            _CACHE.pop(next(iter(_CACHE)))
        _CACHE[cache_key] = (time.monotonic(), output)
    return output
