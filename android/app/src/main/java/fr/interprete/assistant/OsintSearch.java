package fr.interprete.assistant;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class OsintSearch {
    private static boolean documentaryUrl(String value) {
        try {java.net.URI uri=new java.net.URI(value);return !ClaimNormalizer.publicUrl(value).isEmpty()&&"https".equals(uri.getScheme())&&(uri.getPort()==-1||uri.getPort()==443);}catch(Exception error){return false;}
    }
    static JSONObject search(JSONObject input) throws Exception {
        String provider=input.optString("provider"), query=input.optString("query").trim();
        if (query.length()<3 || query.length()>250) throw new IllegalArgumentException("Saisissez entre 3 et 250 caractères.");
        String encoded=URLEncoder.encode(query,"UTF-8"), endpoint;
        switch(provider) {
            case "crossref": endpoint="https://api.crossref.org/works?rows=5&query="+encoded; break;
            case "data_gouv": endpoint="https://www.data.gouv.fr/api/1/datasets/?page_size=5&q="+encoded; break;
            case "entreprises": endpoint="https://recherche-entreprises.api.gouv.fr/search?per_page=5&q="+encoded; break;
            case "europe_pmc":endpoint="https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=5&query="+encoded;break;
            case "wikidata":endpoint="https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=fr&limit=5&search="+encoded;break;
            case "wayback":if(!documentaryUrl(query))throw new IllegalArgumentException("Utilisez une URL HTTPS publique.");endpoint="https://archive.org/wayback/available?url="+encoded;break;
            case "gdelt":endpoint="https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&maxrecords=5&query="+encoded;break;
            case "openlibrary":endpoint="https://openlibrary.org/search.json?limit=5&fields=key,title,author_name,first_publish_year&q="+encoded;break;
            default: throw new IllegalArgumentException("Connecteur inconnu.");
        }
        HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();
        JSONObject payload;
        try {
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
            connection.setRequestProperty("Accept","application/json"); connection.setRequestProperty("User-Agent","Interprete/0.5 documentary-research");
            int status=connection.getResponseCode(); if(status!=200) throw new IllegalStateException("Le connecteur documentaire est indisponible (HTTP "+status+").");
            try(java.io.InputStream stream=connection.getInputStream()) {payload=new JSONObject(new String(NativeApi.read(stream,2*1024*1024),StandardCharsets.UTF_8));}
        } finally {connection.disconnect();}
        return normalize(provider,query,payload);
    }
    static JSONObject normalize(String provider,String query,JSONObject payload) throws Exception {
        JSONArray rows=provider.equals("crossref")?payload.optJSONObject("message")==null?null:payload.getJSONObject("message").optJSONArray("items"):payload.optJSONArray(provider.equals("data_gouv")?"data":"results");
        if(provider.equals("europe_pmc"))rows=payload.optJSONObject("resultList")==null?null:payload.getJSONObject("resultList").optJSONArray("result");
        else if(provider.equals("wikidata"))rows=payload.optJSONArray("search");
        else if(provider.equals("wayback")){rows=new JSONArray();JSONObject snapshots=payload.optJSONObject("archived_snapshots");if(snapshots!=null&&snapshots.optJSONObject("closest")!=null)rows.put(snapshots.getJSONObject("closest"));}
        else if(provider.equals("gdelt"))rows=payload.optJSONArray("articles");
        else if(provider.equals("openlibrary"))rows=payload.optJSONArray("docs");
        JSONArray results=new JSONArray();
        if(rows!=null) for(int i=0;i<Math.min(5,rows.length());i++) {
            JSONObject row=rows.optJSONObject(i); if(row==null) continue;
            String title,url,details;
            if(provider.equals("crossref")) {JSONArray names=row.optJSONArray("title"); title=names==null?"Publication":names.optString(0,"Publication"); url=row.optString("URL"); details="DOI : "+row.optString("DOI")+" · Éditeur : "+row.optString("publisher");}
            else if(provider.equals("data_gouv")) {title=row.optString("title");url=row.optString("page");details=row.optString("description").replaceAll("<[^>]+>"," ");}
            else if(provider.equals("entreprises")) {String siren=row.optString("siren");if(!siren.matches("[0-9]{9}"))continue;title=row.optString("nom_complet",row.optString("nom_raison_sociale","Entreprise"));url="https://annuaire-entreprises.data.gouv.fr/entreprise/"+siren;details="SIREN : "+siren+" · État administratif : "+row.optString("etat_administratif");}
            else if(provider.equals("europe_pmc")){String id=row.optString("id"),source=row.optString("source");if(!id.matches("[A-Za-z0-9_.-]+")||!source.matches("[A-Za-z0-9_-]+"))continue;title=row.optString("title");url="https://europepmc.org/article/"+source+"/"+id;details="Auteurs : "+row.optString("authorString")+" · Année : "+row.optString("pubYear")+" · DOI : "+row.optString("doi");}
            else if(provider.equals("wikidata")){String id=row.optString("id");if(!id.matches("Q[0-9]+"))continue;title=row.optString("label",id);url="https://www.wikidata.org/wiki/"+id;details=row.optString("description")+" · Références à contrôler.";}
            else if(provider.equals("wayback")){if(!row.optBoolean("available"))continue;title="Version archivée : "+row.optString("timestamp");url=row.optString("url").replace("http://web.archive.org/","https://web.archive.org/");details="Capture de "+query+" ; date de capture distincte de la publication.";}
            else if(provider.equals("gdelt")){title=row.optString("title");url=row.optString("url");details="Repéré le "+row.optString("seendate")+" · "+row.optString("domain")+" · Indépendance des sources à vérifier.";}
            else {String key=row.optString("key");if(!key.matches("/works/OL[0-9]+W"))continue;title=row.optString("title");url="https://openlibrary.org"+key;details="Première publication : "+row.optString("first_publish_year");}
            if(!documentaryUrl(url)) continue;
            results.put(Json.object("title",title.substring(0,Math.min(500,title.length())),"url",url,"description",details.substring(0,Math.min(3000,details.length())),"provider",provider));
        }
        return Json.object("provider",provider,"query",query,"results",results,"retrieved_at",java.time.Instant.now().toString(),"cached",false,"notice","Résultats documentaires à examiner ; ils ne valident pas une affirmation.");
    }
}
