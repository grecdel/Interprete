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
        until(scenario,condition,20000);
    }
    private void until(ActivityScenario<MainActivity> scenario,String condition,long timeout) throws Exception {
        long end = SystemClock.elapsedRealtime() + timeout;
        while (SystemClock.elapsedRealtime() < end) { if ("true".equals(js(scenario, condition))) return; SystemClock.sleep(200); }
        String state = js(scenario, "JSON.stringify({status:document.getElementById('status').textContent,error:document.getElementById('error-text').textContent,archive:document.getElementById('archive-status').textContent,exportDisabled:document.getElementById('export-html').disabled})");
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, new java.io.FileOutputStream(new java.io.File(context.getExternalFilesDir(null), "android-failure.png")));
        fail("Condition non satisfaite : " + condition + " ; état : " + state);
    }
    @Test public void keyEntryVerificationAndNativeRecordingWorkWithoutRealApiCalls() throws Exception {
        InterpreteApp app = (InterpreteApp) InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
        java.util.concurrent.atomic.AtomicInteger transcriptionCalls=new java.util.concurrent.atomic.AtomicInteger();
        app.useTestApi(new NativeApi(app, app.vault) {
            @Override JSONObject verify(JSONObject value) {
                return Json.object("checks", Json.array(Json.object("claim", "Affirmation de test Android", "verdict", "Informations insuffisantes", "summary", "Exemple simulé.", "sources", new JSONArray(), "connections", new JSONArray())), "sources", new JSONArray(), "has_sources", false, "analysis", "");
            }
            @Override String transcribe(byte[] wav) { transcriptionCalls.incrementAndGet(); assertTrue(wav.length > 44); return "La dernière phrase enregistrée pour le test Android."; }
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
            until(scenario,"window.InterpreteLauncher?.ready() && !document.getElementById('companion-launcher').hidden");
            js(scenario,"document.getElementById('launcher-complete').click();true");
            until(scenario,"document.getElementById('companion-launcher').hidden");
            js(scenario,"document.getElementById('bubble').click();document.querySelector('[data-action=panel]').click();true");
            until(scenario, "!!document.getElementById('settings-tray') && !document.getElementById('settings-tray').hidden");
            assertNull("Une Intent externe ne doit pas démarrer le micro.", app.service);
            until(scenario,"!!document.getElementById('evidence-files') && !document.getElementById('evidence-files').disabled");
            js(scenario, "document.getElementById('api-key').value='fake-key-used-only-in-android-tests';document.getElementById('remember-key').checked=true;document.getElementById('key-form').requestSubmit();true");
            until(scenario, "document.getElementById('settings-status').textContent.includes('Clé configurée')");
            assertEquals("\"\"", js(scenario, "document.getElementById('api-key').value"));
            String stored = app.getSharedPreferences("api-vault", Context.MODE_PRIVATE).getString("ciphertext", "");
            assertFalse(stored.contains("fake-key-used-only")); assertFalse(stored.isEmpty());
            String pdf="JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MDAgMjAwXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNTAgPj4Kc3RyZWFtCkJUIC9GMSAyNCBUZiAzMCAxMDAgVGQgKEJ1ZGdldCAxMjAgbWlsbGlvbnMpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAzMTEgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0MTEKJSVFT0Y=";
            js(scenario,"window.pdfResult=null;window.InterpreteDocuments.extract(new File([Uint8Array.from(atob("+JSONObject.quote(pdf)+"),c=>c.charCodeAt(0))],'test.pdf',{type:'application/pdf'})).then(r=>window.pdfResult=r.text).catch(e=>window.pdfResult='ERROR:'+e.message);true");
            until(scenario,"window.pdfResult!==null",90000);
            assertEquals("true",js(scenario,"window.pdfResult.includes('Budget 120 millions')"));
            js(scenario,"window.ocrResult=null;const testCanvas=document.createElement('canvas');testCanvas.width=900;testCanvas.height=160;const testContext=testCanvas.getContext('2d');testContext.fillStyle='white';testContext.fillRect(0,0,900,160);testContext.fillStyle='black';testContext.font='bold 48px Arial';testContext.fillText('BUDGET 120 MILLIONS',30,95);testCanvas.toBlob(b=>window.InterpreteDocuments.extract(new File([b],'ocr.png',{type:'image/png'})).then(r=>window.ocrResult=r.text).catch(e=>window.ocrResult='ERROR:'+e.message),'image/png');true");
            until(scenario,"window.ocrResult!==null",90000);
            assertEquals("OCR : "+js(scenario,"window.ocrResult"),"true",js(scenario,"window.ocrResult.includes('120')"));

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
            until(scenario, "!document.getElementById('companion').classList.contains('is-listening')");
            js(scenario, "document.getElementById('microphone').click();true");
            until(scenario, "document.getElementById('companion').classList.contains('is-listening')");
            SystemClock.sleep(1100);
            app.startService(new Intent(app, AssistantService.class).setAction(AssistantService.STOP));
            until(scenario, "window.InterpreteArchive.snapshot().transcript.length===2 && !document.getElementById('companion').classList.contains('is-listening')");
            assertEquals("true", js(scenario, "window.InterpreteArchive.snapshot().transcript.every(fragment=>!!fragment.audio_ref?.id)"));
            assertEquals("2", js(scenario, "window.InterpreteArchive.snapshot().audio.length"));
            assertTrue(app.audioStore.inventory().getJSONObject(0).getString("transcript").contains("dernière phrase"));
            // Replace only Android's document picker; the real archive bridge and writer run.
            java.io.File archive = new java.io.File(app.getFilesDir(), "test-interview.html");
            android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
            android.content.IntentFilter documentFilter = new android.content.IntentFilter(Intent.ACTION_CREATE_DOCUMENT);
            documentFilter.addCategory(Intent.CATEGORY_OPENABLE);
            documentFilter.addDataType("text/html");
            android.app.Instrumentation.ActivityMonitor picker = instrumentation.addMonitor(
                documentFilter,
                new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,
                    new Intent().setData(android.net.Uri.fromFile(archive))), true);
            try {
                until(scenario, "!document.getElementById('export-html').disabled");
                js(scenario, "document.getElementById('archive-button').click();document.getElementById('export-html').click();true");
                try { until(scenario, "!document.getElementById('android-archive-preview').hidden"); }
                catch (AssertionError error) { throw new AssertionError(error.getMessage() + " ; sélecteur appelé : " + picker.getHits() + " ; fichier présent : " + archive.exists() + " ; HTML en mémoire : " + app.lastArchive.length()); }
                assertEquals(1, picker.getHits());
                String html = new String(java.nio.file.Files.readAllBytes(archive.toPath()), java.nio.charset.StandardCharsets.UTF_8);
                assertTrue(html.contains("dernière phrase enregistrée"));
                assertTrue(html.contains("Carte des connexions"));
                assertFalse(html.contains("fake-key-used-only"));
                assertEquals(html, app.lastArchive);
            } finally { instrumentation.removeMonitor(picker); archive.delete(); }
            java.io.File zipFile=new java.io.File(app.getFilesDir(),"test-interview.zip");
            android.content.IntentFilter zipFilter=new android.content.IntentFilter(Intent.ACTION_CREATE_DOCUMENT);zipFilter.addCategory(Intent.CATEGORY_OPENABLE);zipFilter.addDataType("application/zip");
            android.app.Instrumentation.ActivityMonitor zipPicker=instrumentation.addMonitor(zipFilter,new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,new Intent().setData(android.net.Uri.fromFile(zipFile))),true);
            try {
                js(scenario,"document.getElementById('export-audio-bundle').click();true");
                until(scenario,"document.getElementById('archive-status').textContent.includes('Dossier ZIP exporté')");
                assertEquals(1,zipPicker.getHits());
                try(java.util.zip.ZipFile zip=new java.util.zip.ZipFile(zipFile)) {
                    assertNotNull(zip.getEntry("index.html"));assertNotNull(zip.getEntry("session.json"));
                    org.json.JSONObject session=new org.json.JSONObject(new String(NativeApi.read(zip.getInputStream(zip.getEntry("session.json")),1024*1024),java.nio.charset.StandardCharsets.UTF_8));
                    assertEquals(2,session.getJSONArray("audio").length());
                    for(int i=0;i<2;i++) {org.json.JSONObject clip=session.getJSONArray("audio").getJSONObject(i);java.util.zip.ZipEntry entry=zip.getEntry("audio/"+clip.getString("id")+".wav");assertNotNull(entry);byte[] bytes=NativeApi.read(zip.getInputStream(entry),1024*1024);assertEquals('R',bytes[0]);assertEquals(clip.getLong("size"),bytes.length);}
                }
            }finally{instrumentation.removeMonitor(zipPicker);zipFile.delete();}
            int callsBeforeOffline=transcriptionCalls.get();
            app.getSharedPreferences("api-vault",Context.MODE_PRIVATE).edit().clear().commit();app.vault.clearMemory();
            js(scenario,"document.getElementById('record-only').checked=true;document.getElementById('record-only').dispatchEvent(new Event('change'));window.refreshConfiguration();true");
            until(scenario,"configured===false");
            js(scenario,"document.getElementById('microphone').click();true");
            until(scenario,"document.getElementById('companion').classList.contains('is-listening')");SystemClock.sleep(1100);
            js(scenario,"document.getElementById('microphone').click();true");
            until(scenario,"window.InterpreteArchive.snapshot().audio.length===3 && !document.getElementById('companion').classList.contains('is-listening')");
            assertEquals(callsBeforeOffline,transcriptionCalls.get());
            js(scenario, "document.getElementById('archive-button').click();true");
            js(scenario, "document.getElementById('status').textContent='Démonstration · réponses simulées';document.getElementById('settings-button').click();true");
            InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, new java.io.FileOutputStream(new java.io.File(app.getExternalFilesDir(null), "android-demo.png")));
        } finally { app.stopService(new Intent(app, AssistantService.class)); }
    }
}
