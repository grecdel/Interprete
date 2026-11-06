package fr.interprete.assistant;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class ClaimNormalizerTest {
    private JSONObject response(JSONObject analysis, JSONObject... sources) {
        return Json.object("status", "completed", "output", Json.array(
                Json.object("type", "web_search_call", "status", "completed", "action", Json.object("sources", Json.array((Object[]) sources))),
                Json.object("type", "message", "content", Json.array(Json.object("type", "output_text", "text", analysis.toString(), "annotations", new JSONArray())))));
    }
    @Test public void retrievesSourcesEvenWhenJsonTextHasNoCitationAnnotations() throws Exception {
        String url = "https://www.insee.fr/fr/statistiques";
        JSONObject analysis = Json.object("checks", Json.array(Json.object("claim", "Une affirmation", "verdict", "À nuancer", "summary", "Le périmètre est à préciser.", "source_urls", Json.array(url))));
        JSONObject result = ClaimNormalizer.parse(response(analysis, Json.object("url", url, "title", "INSEE")), "text", new JSONArray());
        assertEquals(1, result.getJSONArray("sources").length());
        JSONObject check = result.getJSONArray("checks").getJSONObject(0);
        assertEquals("À nuancer", check.getString("verdict")); assertEquals(1, check.getJSONArray("sources").length());
        assertTrue(check.getBoolean("review_required"));
        assertEquals("Un seul site cité : le recoupement reste à compléter.", check.getJSONArray("limitations").getString(0));
    }
    @Test public void fabricatedLinksAndPastStatementsCannotBecomeEvidence() throws Exception {
        JSONObject analysis = Json.object("checks", Json.array(Json.object("claim", "Une affirmation", "verdict", "Confirmé", "source_urls", Json.array("https://invented.example/"),
                "connections", Json.array(Json.object("target_id", "invented", "relation", "contradiction_potentielle", "explanation", "Sans propos d’origine.")))));
        JSONObject check = ClaimNormalizer.parse(response(analysis), "live", new JSONArray()).getJSONArray("checks").getJSONObject(0);
        assertEquals("Informations insuffisantes", check.getString("verdict"));
        assertEquals(0, check.getJSONArray("connections").length()); assertEquals(0, check.getJSONArray("sources").length());
    }
    @Test public void unreadableArticleIsNotReplacedWithAnInventedVerification() throws Exception {
        JSONObject result = ClaimNormalizer.parse(response(Json.object("input_accessible", false, "checks", new JSONArray())), "url", new JSONArray());
        assertEquals("Informations insuffisantes", result.getJSONArray("checks").getJSONObject(0).getString("verdict"));
    }
    @Test public void malformedOutputFailsClosed() {
        try { ClaimNormalizer.parse(Json.object("status", "completed", "output", new JSONArray()), "text", new JSONArray()); fail(); }
        catch (Exception expected) { assertTrue(expected.getMessage().contains("inexploitable")); }
    }
    @Test public void localAndCredentialUrlsAreRejected() {
        for (String value : new String[]{"javascript:alert(1)", "http://127.0.0.1/", "https://user:password@example.com", "http://192.168.1.1/", "http://localhost/", "file:///data/data/private"}) assertEquals(value, "", ClaimNormalizer.publicUrl(value));
    }
    @Test public void priorContextIsBoundedAndIdentifiersAreValidated() {
        JSONArray source = new JSONArray();
        for (int i = 0; i < 40; i++) source.put(Json.object("id", "claim_" + i, "claim", "Un propos passé."));
        assertEquals(24, ClaimNormalizer.context(source).length());
        assertEquals(0, ClaimNormalizer.context(Json.array(Json.object("id", "<script>", "claim", "Du texte"))).length());
    }
    @Test public void voiceLevelFollowsLoudness() {
        byte[] silence = new byte[3200], loud = new byte[3200];
        for (int i = 0; i < loud.length; i += 2) { short sample = (short) (i % 4 == 0 ? 16000 : -16000); loud[i] = (byte) sample; loud[i + 1] = (byte) (sample >> 8); }
        assertEquals(0f, MicrophoneEngine.level(silence, silence.length), 0.001f);
        assertTrue(MicrophoneEngine.level(loud, loud.length) > .9f);
    }
    @Test public void waveHeaderMatchesTheAudioActuallyCaptured() {
        byte[] pcm = new byte[]{1, 2, 3, 4}; byte[] wav = MicrophoneEngine.wav(pcm);
        assertEquals(48, wav.length); assertEquals('R', wav[0]); assertEquals('W', wav[8]); assertEquals('d', wav[36]);
        assertEquals(4, java.nio.ByteBuffer.wrap(wav, 40, 4).order(java.nio.ByteOrder.LITTLE_ENDIAN).getInt());
        assertArrayEquals(pcm, java.util.Arrays.copyOfRange(wav, 44, wav.length));
    }
}
