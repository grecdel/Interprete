package fr.interprete.assistant;

import android.app.Application;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.util.ArrayDeque;

public final class InterpreteApp extends Application {
    interface EventSink { void receive(JSONObject event); }
    KeyVault vault;
    private NativeApi api;
    private MicrophoneEngine.Factory audioFactory = MicrophoneEngine::androidSource;
    volatile AssistantService service;
    volatile boolean activityVisible;
    private EventSink sink;
    private final ArrayDeque<JSONObject> pending = new ArrayDeque<>();
    private final Handler main = new Handler(Looper.getMainLooper());
    @Override public void onCreate() { super.onCreate(); vault = new KeyVault(this); api = new NativeApi(this, vault); }
    NativeApi api() { return api; }
    MicrophoneEngine.Factory audioFactory() { return audioFactory; }
    void useTestAudio(MicrophoneEngine.Factory replacement) { if (!BuildConfig.DEBUG) throw new SecurityException(); audioFactory = replacement; }
    void useTestApi(NativeApi replacement) { if (!BuildConfig.DEBUG) throw new SecurityException(); api = replacement; }
    void attach(EventSink value) {
        sink = value;
        while (!pending.isEmpty()) value.receive(pending.removeFirst());
    }
    void detach(EventSink value) { if (sink == value) sink = null; }
    void emit(JSONObject value) {
        main.post(() -> {
            if (sink != null) sink.receive(value);
            else {
                if (pending.size() == 500) pending.removeFirst();
                pending.addLast(value);
            }
        });
    }
    void resolve(String id, JSONObject value) { emit(Json.object("id", id, "result", value)); }
    void reject(String id, String message) { emit(Json.object("id", id, "error", message)); }
}
