package fr.interprete.assistant;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class OsintSearch {
    static JSONObject search(JSONObject input) throws Exception {
        String provider=input.optString("provider"), query=input.optString("query").trim();
        if (query.length()<3 || query.length()>250) throw new IllegalArgumentException("Saisissez entre 3 et 250 caractères.");
        String encoded=URLEncoder.encode(query,"UTF-8"), endpoint;
        switch(provider) {
            case "crossref": endpoint="https://api.crossref.org/works?rows=5&query="+encoded; break;
            case "data_gouv": endpoint="https://www.data.gouv.fr/api/1/datasets/?page_size=5&q="+encoded; break;
            case "entreprises": endpoint="https://recherche-entreprises.api.gouv.fr/search?per_page=5&q="+encoded; break;
            default: throw new IllegalArgumentException("Connecteur inconnu.");
        }
        HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();
        JSONObject payload;
        try {
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
            connection.setRequestProperty("Accept","application/json"); connection.setRequestProperty("User-Agent","Interprete/0.4 documentary-research");
            int status=connection.getResponseCode(); if(status!=200) throw new IllegalStateException("Le connecteur documentaire est indisponible (HTTP "+status+").");
            try(java.io.InputStream stream=connection.getInputStream()) {payload=new JSONObject(new String(NativeApi.read(stream,2*1024*1024),StandardCharsets.UTF_8));}
        } finally {connection.disconnect();}
        JSONArray rows=provider.equals("crossref")?payload.optJSONObject("message")==null?null:payload.getJSONObject("message").optJSONArray("items"):payload.optJSONArray(provider.equals("data_gouv")?"data":"results");
        JSONArray results=new JSONArray();
        if(rows!=null) for(int i=0;i<Math.min(5,rows.length());i++) {
            JSONObject row=rows.optJSONObject(i); if(row==null) continue;
            String title,url,details;
            if(provider.equals("crossref")) {JSONArray names=row.optJSONArray("title"); title=names==null?"Publication":names.optString(0,"Publication"); url=row.optString("URL"); details="DOI : "+row.optString("DOI")+" · Éditeur : "+row.optString("publisher");}
            else if(provider.equals("data_gouv")) {title=row.optString("title");url=row.optString("page");details=row.optString("description").replaceAll("<[^>]+>"," ");}
            else {String siren=row.optString("siren");if(!siren.matches("[0-9]{9}"))continue;title=row.optString("nom_complet",row.optString("nom_raison_sociale","Entreprise"));url="https://annuaire-entreprises.data.gouv.fr/entreprise/"+siren;details="SIREN : "+siren+" · État administratif : "+row.optString("etat_administratif");}
            if(ClaimNormalizer.publicUrl(url).isEmpty() || !url.startsWith("https://")) continue;
            results.put(Json.object("title",title.substring(0,Math.min(500,title.length())),"url",url,"description",details.substring(0,Math.min(3000,details.length())),"provider",provider));
        }
        return Json.object("provider",provider,"query",query,"results",results,"retrieved_at",java.time.Instant.now().toString(),"cached",false,"notice","Résultats documentaires à examiner ; ils ne valident pas une affirmation.");
    }
}
