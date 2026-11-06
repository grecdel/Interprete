package fr.interprete.assistant;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

class NativeApi {
    private final Context context;
    private final KeyVault vault;
    NativeApi(Context context, KeyVault vault) { this.context = context.getApplicationContext(); this.vault = vault; }
    JSONObject verify(JSONObject input) throws Exception {
        Object value = input.opt("transcript");
        if (!(value instanceof String)) throw new IllegalArgumentException("Ajoutez une phrase, un article ou un lien.");
        String text = ((String) value).trim();
        if (text.length() < 10 || text.length() > 20000) throw new IllegalArgumentException("Saisissez entre 10 et 20 000 caractères.");
        String kind = "live".equals(input.optString("kind")) ? "live" : "text";
        if (!"live".equals(kind) && text.matches("(?i)^https?://\\S+$")) {
            if (ClaimNormalizer.publicUrl(text).isEmpty()) throw new IllegalArgumentException("Utilisez un lien HTTP(S) public sans identifiants.");
            kind = "url";
        }
        JSONArray prior = ClaimNormalizer.context(input.optJSONArray("context"));
        JSONObject prompts;
        try (InputStream stream = context.getAssets().open("web/prompts.json")) { prompts = new JSONObject(new String(read(stream, 100000), StandardCharsets.UTF_8)); }
        JSONObject preparation = ClaimNormalizer.preparation(input.optJSONObject("preparation"));
        if ("quick".equals(input.optString("mode"))) {
            // F4: provisional follow-up without web search, before the full verification.
            if ("url".equals(kind)) return Json.object("checks", new JSONArray(), "provisional", true, "checked_at", java.time.Instant.now().toString());
            JSONObject quickInput = Json.object("type_contenu", kind, "contenu_a_verifier", text, "propos_anterieurs", new JSONArray());
            if (preparation.length() > 0) quickInput.put("dossier_preparatoire", preparation);
            JSONObject quick = Json.object("model", "gpt-4.1-mini", "instructions", prompts.getString("quick_instructions"),
                    "input", quickInput.toString(), "max_output_tokens", 700, "store", false);
            return ClaimNormalizer.quick(send("responses", quick.toString().getBytes(StandardCharsets.UTF_8), "application/json", 30000));
        }
        JSONObject modelInput = Json.object("type_contenu", kind, "contenu_a_verifier", text, "propos_anterieurs", prior);
        if (preparation.length() > 0) modelInput.put("dossier_preparatoire", preparation);
        JSONObject payload = Json.object("model", "gpt-4.1-mini", "instructions", prompts.getString("instructions"),
                "input", modelInput.toString(),
                "tools", Json.array(Json.object("type", "web_search")), "include", Json.array("web_search_call.action.sources"),
                "tool_choice", "required", "max_output_tokens", 4000, "store", false);
        return ClaimNormalizer.parse(send("responses", payload.toString().getBytes(StandardCharsets.UTF_8), "application/json", 90000), kind, prior);
    }
    String transcribe(byte[] wav) throws Exception {
        String boundary = "Interprete" + UUID.randomUUID().toString().replace("-", "");
        ByteArrayOutputStream data = new ByteArrayOutputStream();
        for (String[] field : new String[][]{{"model", "gpt-4o-mini-transcribe"}, {"language", "fr"}, {"response_format", "json"}}) {
            data.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + field[0] + "\"\r\n\r\n" + field[1] + "\r\n").getBytes(StandardCharsets.UTF_8));
        }
        data.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"extrait.wav\"\r\nContent-Type: audio/wav\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        data.write(wav); data.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        Object text = send("audio/transcriptions", data.toByteArray(), "multipart/form-data; boundary=" + boundary, 60000).opt("text");
        if (!(text instanceof String)) throw new IllegalStateException("La transcription n’a pas pu être lue.");
        return ((String) text).trim();
    }
    private JSONObject send(String endpoint, byte[] body, String contentType, int timeout) throws Exception {
        String key = vault.get(); if (key.isEmpty()) throw new IllegalStateException("Ajoutez votre clé API dans les réglages d’Interprete.");
        HttpURLConnection connection = (HttpURLConnection) new URL("https://api.openai.com/v1/" + endpoint).openConnection();
        try {
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(timeout);
            connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setFixedLengthStreamingMode(body.length);
            connection.setRequestProperty("Authorization", "Bearer " + key); connection.setRequestProperty("Content-Type", contentType);
            connection.getOutputStream().write(body);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                if (status == 401) throw new IllegalStateException("La clé API a été refusée. Vérifiez-la dans les réglages.");
                if (status == 429) throw new IllegalStateException("Quota ou limite de débit API atteint. Vérifiez votre compte OpenAI.");
                throw new IllegalStateException("Le service OpenAI est indisponible (HTTP " + status + "). Réessayez plus tard.");
            }
            try (InputStream stream = connection.getInputStream()) { return new JSONObject(new String(read(stream, 3 * 1024 * 1024), StandardCharsets.UTF_8)); }
        } finally { connection.disconnect(); }
    }
    static byte[] read(InputStream stream, int max) throws Exception {
        ByteArrayOutputStream data = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count;
        while ((count = stream.read(buffer)) != -1) { if (data.size() + count > max) throw new IllegalStateException("Réponse trop volumineuse."); data.write(buffer, 0, count); }
        return data.toByteArray();
    }
}
