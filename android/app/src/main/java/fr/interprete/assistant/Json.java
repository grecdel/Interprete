package fr.interprete.assistant;

import org.json.JSONArray;
import org.json.JSONObject;

final class Json {
    private Json() {}
    static JSONObject object(Object... pairs) {
        JSONObject result = new JSONObject();
        try { for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]); }
        catch (Exception error) { throw new IllegalArgumentException("Format interne incorrect.", error); }
        return result;
    }
    static JSONArray array(Object... values) { JSONArray result = new JSONArray(); for (Object value : values) result.put(value); return result; }
    static String string(JSONObject object, String name, int limit) {
        Object value = object.opt(name);
        if (!(value instanceof String)) return "";
        String text = (String) value; return text.substring(0, Math.min(limit, text.length()));
    }
}
