package fr.interprete.assistant;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AndroidSmokeTest {
    private String js(ActivityScenario<MainActivity> scenario, String code) throws Exception {
        AtomicReference<String> result = new AtomicReference<>(); CountDownLatch complete = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            // The content contains one frame, which contains the WebView.
            android.view.View root = ((android.widget.FrameLayout) activity.findViewById(android.R.id.content)).getChildAt(0);
            WebView web = (WebView) ((android.widget.FrameLayout) root).getChildAt(0);
            web.evaluateJavascript(code, value -> { result.set(value); complete.countDown(); });
        });
        assertTrue(complete.await(10, TimeUnit.SECONDS)); return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario, String condition) throws Exception {
        long end = SystemClock.elapsedRealtime() + 20000;
        while (SystemClock.elapsedRealtime() < end) { if ("true".equals(js(scenario, condition))) return; SystemClock.sleep(200); }
        fail("Condition non satisfaite : " + condition);
    }
    @Test public void keyEntryVerificationAndNativeRecordingWorkWithoutRealApiCalls() throws Exception {
        InterpreteApp app = (InterpreteApp) InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
        app.useTestApi(new NativeApi(app, app.vault) {
            @Override JSONObject verify(JSONObject value) {
                return Json.object("checks", Json.array(Json.object("claim", "Affirmation de test Android", "verdict", "Informations insuffisantes", "summary", "Exemple simulé.", "sources", new JSONArray(), "connections", new JSONArray())), "sources", new JSONArray(), "has_sources", false, "analysis", "");
            }
            @Override String transcribe(byte[] wav) { assertTrue(wav.length > 44); return "La dernière phrase enregistrée pour le test Android."; }
        });
        app.useTestAudio(() -> new MicrophoneEngine.Source() {
            volatile boolean active;
            public void start() { active = true; }
            public int read(byte[] data) {
                if (!active) return -1;
                SystemClock.sleep(100); java.util.Arrays.fill(data, (byte) 1); return data.length;
            }
            public void stop() { active = false; }
            public void release() { }
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(new Intent(app, MainActivity.class).putExtra("listen_on_open", true))) {
            until(scenario, "!!document.getElementById('settings-tray') && !document.getElementById('settings-tray').hidden");
            assertNull("Une Intent externe ne doit pas démarrer le micro.", app.service);
            js(scenario, "document.getElementById('api-key').value='fake-key-used-only-in-android-tests';document.getElementById('remember-key').checked=true;document.getElementById('key-form').requestSubmit();true");
            until(scenario, "document.getElementById('settings-status').textContent.includes('Clé configurée')");
            assertEquals("\"\"", js(scenario, "document.getElementById('api-key').value"));
            String stored = app.getSharedPreferences("api-vault", Context.MODE_PRIVATE).getString("ciphertext", "");
            assertFalse(stored.contains("fake-key-used-only")); assertFalse(stored.isEmpty());
            js(scenario, "document.getElementById('settings-button').click();document.getElementById('transcript').value='Une affirmation de test qui doit être vérifiée.';document.getElementById('transcript').dispatchEvent(new Event('input'));document.getElementById('composer').requestSubmit();true");
            until(scenario, "document.querySelectorAll('.result-card').length===1");
            assertEquals("true", js(scenario, "document.querySelector('.result-card').textContent.includes('Informations insuffisantes')"));
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(app.getPackageName(), Manifest.permission.RECORD_AUDIO);
            if (android.os.Build.VERSION.SDK_INT >= 33) InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(app.getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
            app.getSharedPreferences("MainActivity", Context.MODE_PRIVATE).edit().putBoolean("notification_asked", true).commit();
            js(scenario, "document.getElementById('microphone').click();true");
            until(scenario, "document.getElementById('companion').classList.contains('is-listening')");
            SystemClock.sleep(1100);
            js(scenario, "document.getElementById('microphone').click();true");
            until(scenario, "window.InterpreteArchive.snapshot().transcript.length>0");
            assertEquals("true", js(scenario, "window.InterpreteArchive.snapshot().transcript[0].text.includes('dernière phrase')"));
            // Replace only Android's document picker; the real archive bridge and writer run.
            java.io.File archive = new java.io.File(app.getFilesDir(), "test-interview.html");
            android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
            android.app.Instrumentation.ActivityMonitor picker = instrumentation.addMonitor(
                new android.content.IntentFilter(Intent.ACTION_CREATE_DOCUMENT),
                new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,
                    new Intent().setData(android.net.Uri.fromFile(archive))), true);
            try {
                js(scenario, "document.getElementById('archive-button').click();document.getElementById('export-html').click();true");
                until(scenario, "!document.getElementById('android-archive-preview').hidden");
                assertEquals(1, picker.getHits());
                String html = new String(java.nio.file.Files.readAllBytes(archive.toPath()), java.nio.charset.StandardCharsets.UTF_8);
                assertTrue(html.contains("dernière phrase enregistrée"));
                assertTrue(html.contains("Carte des connexions"));
                assertFalse(html.contains("fake-key-used-only"));
                assertEquals(html, app.lastArchive);
            } finally { instrumentation.removeMonitor(picker); archive.delete(); }
            js(scenario, "document.getElementById('archive-button').click();true");
            js(scenario, "document.getElementById('status').textContent='Démonstration · réponses simulées';document.getElementById('settings-button').click();true");
            InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, new java.io.FileOutputStream(new java.io.File(app.getExternalFilesDir(null), "android-demo.png")));
        } finally { app.stopService(new Intent(app, AssistantService.class)); }
    }
}
