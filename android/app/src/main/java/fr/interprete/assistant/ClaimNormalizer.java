package fr.interprete.assistant;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class ClaimNormalizer {
    private static final Set<String> VERDICTS = new HashSet<>(Arrays.asList("Confirmé", "Contredit", "À nuancer", "Informations insuffisantes"));
    private static final Set<String> RELATIONS = new HashSet<>(Arrays.asList("contradiction_potentielle", "concordance", "nuance", "contexte"));
    static String publicUrl(String value) {
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (host == null || uri.getUserInfo() != null || !("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) return "";
            host = host.toLowerCase(Locale.ROOT);
            if (host.equals("localhost") || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal") || host.indexOf('.') < 0 || host.contains(":")) return "";
            if (host.matches("[0-9.]+")) {
                String[] p = host.split("\\."); if (p.length != 4) return "";
                for(String octet:p)if(!octet.matches("0|[1-9][0-9]{0,2}")||Integer.parseInt(octet)>255)return "";
                int a = Integer.parseInt(p[0]), b = Integer.parseInt(p[1]);
                if (a == 0 || a == 10 || a == 127 || a >= 224 || (a == 169 && b == 254) || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168) || (a == 100 && b >= 64 && b <= 127)) return "";
            }
            if (uri.getPort() != -1 && uri.getPort() != 80 && uri.getPort() != 443) return "";
            return value;
        } catch (Exception ignored) { return ""; }
    }
    static String key(String value) {
        try {
            URI uri = new URI(value);
            String path = uri.getRawPath(); if (path == null) path = "";
            while (path.endsWith("/")) path = path.substring(0, path.length() - 1);
            StringBuilder query = new StringBuilder();
            if (uri.getRawQuery() != null) for (String part : uri.getRawQuery().split("&")) if (!part.toLowerCase(Locale.ROOT).startsWith("utm_")) { if (query.length() > 0) query.append('&'); query.append(part); }
            return uri.getHost().toLowerCase(Locale.ROOT) + path + "?" + query;
        } catch (Exception ignored) { return ""; }
    }
    static JSONArray context(JSONArray values) {
        JSONArray result = new JSONArray(); Set<String> seen = new HashSet<>();
        if (values == null) return result;
        for (int i = 0; i < Math.min(values.length(), 24); i++) {
            JSONObject item = values.optJSONObject(i); if (item == null) continue;
            String id = Json.string(item, "id", 101), claim = Json.string(item, "claim", 600);
            if (!id.matches("[A-Za-z0-9_-]{1,100}") || claim.trim().isEmpty() || !seen.add(id)) continue;
            JSONObject normalized = Json.object("id", id, "claim", claim);
            for (String field : new String[]{"summary", "original_text", "at", "session_title"}) {
                String text = Json.string(item, field, field.equals("original_text") ? 1000 : 800);
                try { normalized.put(field, text); } catch (Exception ignored) { }
            }
            result.put(normalized);
        }
        return result;
    }
    static JSONObject parse(JSONObject response, String inputType, JSONArray context) throws Exception {
        if (!"completed".equals(response.optString("status"))) throw new IllegalStateException("La recherche est incomplète. Réessayez avec un extrait plus court.");
        Map<String, JSONObject> sources = new LinkedHashMap<>();
        StringBuilder text = new StringBuilder();
        JSONArray output = response.optJSONArray("output");
        if (output != null) for (int i = 0; i < output.length(); i++) {
            JSONObject item = output.optJSONObject(i); if (item == null) continue;
            if ("web_search_call".equals(item.optString("type"))) {
                JSONObject action = item.optJSONObject("action");
                JSONArray found = action == null ? null : action.optJSONArray("sources");
                if (found != null) for (int n = 0; n < found.length(); n++) addSource(sources, found.optJSONObject(n));
            }
            if (!"message".equals(item.optString("type"))) continue;
            JSONArray content = item.optJSONArray("content"); if (content == null) continue;
            for (int n = 0; n < content.length(); n++) {
                JSONObject part = content.optJSONObject(n); if (part == null || !"output_text".equals(part.optString("type"))) continue;
                text.append(part.optString("text", ""));
                JSONArray annotations = part.optJSONArray("annotations");
                if (annotations != null) for (int a = 0; a < annotations.length(); a++) {
                    JSONObject annotation = annotations.optJSONObject(a);
                    if (annotation != null && "url_citation".equals(annotation.optString("type"))) addSource(sources, annotation);
                }
            }
        }
        String raw = text.toString().trim().replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        JSONObject analysis;
        try { analysis = new JSONObject(raw); } catch (Exception ignored) { throw new IllegalStateException("Le service a retourné une analyse inexploitable. Réessayez."); }
        JSONArray checks = new JSONArray();
        if ("url".equals(inputType) && !analysis.optBoolean("input_accessible", false)) {
            checks.put(Json.object("claim", "Le contenu de cet article est inaccessible", "verdict", "Informations insuffisantes", "summary", "Collez le texte de l’article pour en vérifier les affirmations.", "sources", new JSONArray()));
        } else {
            JSONArray values = analysis.optJSONArray("checks");
            Set<String> knownIds = new HashSet<>();
            for (int i = 0; i < context.length(); i++) knownIds.add(context.optJSONObject(i).optString("id"));
            if (values != null) for (int i = 0; i < Math.min(3, values.length()); i++) {
                JSONObject check = values.optJSONObject(i); if (check == null || Json.string(check, "claim", 500).isEmpty()) continue;
                JSONArray attached = new JSONArray(); Set<String> attachedKeys = new HashSet<>();
                JSONArray links = check.optJSONArray("source_urls");
                if (links != null) for (int n = 0; n < links.length(); n++) {
                    String sourceKey = key(links.optString(n)); JSONObject source = sources.get(sourceKey);
                    if (source != null && attachedKeys.add(sourceKey)) attached.put(source);
                }
                String verdict = Json.string(check, "verdict", 100); if (!VERDICTS.contains(verdict)) verdict = "Informations insuffisantes";
                String summary = Json.string(check, "summary", 3000), followUp = Json.string(check, "follow_up", 1500);
                JSONArray evidence = strings(check.optJSONArray("evidence"), 3, 1500);
                if (attached.length() == 0) {
                    if (!"Informations insuffisantes".equals(verdict)) summary = "Cette conclusion n’a pas de source web associée et ne peut pas être retenue sans vérification.";
                    verdict = "Informations insuffisantes"; evidence = new JSONArray();
                    followUp = "Pouvez-vous préciser la source, la date et le périmètre de cette affirmation ?";
                }
                JSONArray limitations = strings(check.optJSONArray("limitations"), 3, 1000);
                Set<String> hosts = new HashSet<>();
                for (int n = 0; n < attached.length(); n++) hosts.add(URI.create(attached.optJSONObject(n).optString("url")).getHost());
                if (hosts.size() == 1) {
                    JSONArray withWarning = Json.array("Un seul site cité : le recoupement reste à compléter.");
                    for (int n = 0; n < limitations.length(); n++) withWarning.put(limitations.opt(n));
                    limitations = withWarning;
                }
                JSONObject origin = check.optJSONObject("common_origin");
                String commonOrigin = origin != null && Boolean.TRUE.equals(origin.opt("detected")) && attached.length() >= 2 ? Json.string(origin, "explanation", 600).trim() : "";
                if (!commonOrigin.isEmpty()) {
                    JSONArray withOrigin = Json.array("Origine commune probable : " + commonOrigin);
                    for (int n = 0; n < limitations.length(); n++) withOrigin.put(limitations.opt(n));
                    limitations = withOrigin;
                }
                JSONArray connections = new JSONArray(), proposed = check.optJSONArray("connections");
                if (proposed != null) for (int n = 0; n < Math.min(4, proposed.length()); n++) {
                    JSONObject link = proposed.optJSONObject(n); if (link == null || !knownIds.contains(link.optString("target_id")) || !RELATIONS.contains(link.optString("relation"))) continue;
                    connections.put(Json.object("target_id", link.optString("target_id"), "relation", link.optString("relation"), "explanation", Json.string(link, "explanation", 2000)));
                }
                JSONArray excerpts = new JSONArray(), proposedExcerpts = check.optJSONArray("source_excerpts");
                if (proposedExcerpts != null) for (int n = 0; n < Math.min(4, proposedExcerpts.length()); n++) {
                    JSONObject excerpt = proposedExcerpts.optJSONObject(n); if (excerpt == null || !attachedKeys.contains(key(excerpt.optString("url")))) continue;
                    String quote = Json.string(excerpt, "quote", 1200); if (quote.isEmpty()) continue;
                    String date = Json.string(excerpt, "published_at", 10); if (!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) date = "";
                    excerpts.put(Json.object("url", sources.get(key(excerpt.optString("url"))).optString("url"), "quote", quote, "published_at", date, "verified_against_document", false));
                }
                checks.put(Json.object("claim", Json.string(check, "claim", 500), "verdict", verdict, "summary", summary,
                        "reasoning", Json.string(check, "reasoning", 5000), "evidence", evidence, "sources", attached,
                        "connections", connections, "follow_up", followUp, "source_excerpts", excerpts,
                        "limitations", limitations, "review_required", true));
                if (!commonOrigin.isEmpty()) checks.getJSONObject(checks.length() - 1).put("common_origin", commonOrigin);
            }
        }
        JSONArray allSources = new JSONArray(); for (JSONObject source : sources.values()) allSources.put(source);
        String message = Json.string(analysis, "message", 3000);
        if (message.isEmpty()) message = "Aucune affirmation vérifiable n’a été identifiée.";
        return Json.object("checks", checks, "sources", allSources, "has_sources", !sources.isEmpty(), "analysis", message, "input_type", inputType, "checked_at", java.time.Instant.now().toString());
    }
    /** F3: the journalist's preparation, bounded; context for the model, never evidence. */
    static JSONObject preparation(JSONObject value) {
        JSONObject result = new JSONObject(); if (value == null) return result;
        try {
            for (String[] field : new String[][]{{"interlocuteur", "200"}, {"fonction", "200"}, {"sujet", "400"}, {"date", "40"}}) {
                String text = Json.string(value, field[0], Integer.parseInt(field[1])).trim(); if (!text.isEmpty()) result.put(field[0], text);
            }
            JSONArray pieces = value.optJSONArray("pieces"), kept = new JSONArray();
            if (pieces != null) for (int i = 0; i < Math.min(3, pieces.length()); i++) {
                JSONObject piece = pieces.optJSONObject(i); if (piece == null) continue;
                String excerpt = Json.string(piece, "extrait", 1500).trim(); if (excerpt.isEmpty()) continue;
                kept.put(Json.object("nom", Json.string(piece, "nom", 200).trim(), "extrait", excerpt));
            }
            if (kept.length() > 0) result.put("pieces", kept);
        } catch (Exception ignored) { return new JSONObject(); }
        return result;
    }
    /** F4: provisional follow-ups, never presented as verified. */
    static JSONObject quick(JSONObject response) throws Exception {
        if (!"completed".equals(response.optString("status"))) throw new IllegalStateException("La relance rapide est incomplète.");
        StringBuilder text = new StringBuilder(); JSONArray output = response.optJSONArray("output");
        if (output != null) for (int i = 0; i < output.length(); i++) {
            JSONObject item = output.optJSONObject(i); if (item == null || !"message".equals(item.optString("type"))) continue;
            JSONArray content = item.optJSONArray("content"); if (content == null) continue;
            for (int n = 0; n < content.length(); n++) { JSONObject part = content.optJSONObject(n); if (part != null && "output_text".equals(part.optString("type"))) text.append(part.optString("text", "")); }
        }
        JSONObject analysis;
        try { analysis = new JSONObject(text.toString().trim().replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "")); }
        catch (Exception ignored) { throw new IllegalStateException("La relance rapide est inexploitable."); }
        JSONArray values = analysis.optJSONArray("checks"), checks = new JSONArray();
        if (values != null) for (int i = 0; i < Math.min(6, values.length()) && checks.length() < 2; i++) {
            JSONObject check = values.optJSONObject(i); if (check == null) continue;
            String claim = Json.string(check, "claim", 500), followUp = Json.string(check, "follow_up", 600);
            if (claim.trim().isEmpty() || followUp.trim().isEmpty()) continue;
            String why = Json.string(check, "why", 600); if (why.trim().isEmpty()) why = "Relance proposée avant toute recherche : rien n’est encore vérifié.";
            checks.put(Json.object("claim", claim, "verdict", "Piste provisoire", "provisional", true, "summary", why, "follow_up", followUp,
                    "sources", new JSONArray(), "evidence", new JSONArray(), "connections", new JSONArray()));
        }
        return Json.object("checks", checks, "provisional", true, "checked_at", java.time.Instant.now().toString());
    }
    private static JSONArray strings(JSONArray values, int count, int max) {
        JSONArray result = new JSONArray(); if (values == null) return result;
        for (int i = 0; i < values.length() && result.length() < count; i++) if (values.opt(i) instanceof String) { String value = values.optString(i); result.put(value.substring(0, Math.min(value.length(), max))); }
        return result;
    }
    private static void addSource(Map<String, JSONObject> sources, JSONObject value) {
        if (value == null) return; String url = publicUrl(value.optString("url")); if (url.isEmpty()) return;
        String title = Json.string(value, "title", 500); if (title.isEmpty()) title = URI.create(url).getHost();
        sources.put(key(url), Json.object("url", url, "title", title));
    }
}
