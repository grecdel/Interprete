package fr.interprete.assistant;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PersistableBundle;
import android.provider.Settings;
import android.view.WindowInsets;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public final class MainActivity extends Activity implements InterpreteApp.EventSink {
    private static final String ORIGIN = "https://app.interprete.local/";
    private static final int MICROPHONE = 10, ARCHIVE = 20, IMPORT = 21;
    private InterpreteApp app;
    private WebView web;
    private boolean ready, startOnOpen, unsaved, activationOnOpen;
    private String microphoneRequest;
    private JSONObject microphoneOptions=new JSONObject();
    private JSONObject archiveRequest;
    private String archiveId;
    private ValueCallback<Uri[]> filePicker;
    private final ExecutorService network = Executors.newFixedThreadPool(2);
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); app = (InterpreteApp) getApplication();
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(243,241,248));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom); return insets;
            });
        }
        web = new WebView(this); web.setBackgroundColor(Color.rgb(243,241,248));
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Bridge(), "InterpreteNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !"app.interprete.local".equals(uri.getHost())) return blocked();
                String filename = uri.getPath(); if (filename == null || filename.equals("/")) filename = "index.html"; else filename = filename.substring(1);
                if (!java.util.Arrays.asList("index.html", "style.css", "app.js", "archive.js", "capture.js", "workspace.js", "documents.js", "analysis-tools.js", "launcher.js", "orb.js", "panel.js", "android.js", "android.css").contains(filename) && !(filename.startsWith("vendor/") && !filename.contains("..") && filename.matches("[A-Za-z0-9_./-]+"))) return blocked();
                try {
                    String mime = (filename.endsWith(".js") || filename.endsWith(".mjs")) ? "text/javascript" : filename.endsWith(".css") ? "text/css" : filename.endsWith(".wasm") ? "application/wasm" : filename.endsWith(".html") ? "text/html" : "application/octet-stream";
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'");
                    headers.put("X-Content-Type-Options", "nosniff");
                    // Emulated GPUs (gfxstream, SwiftShader) can freeze the whole device on a WebGL shader:
                    // on an emulator the living bubble is not served and the CSS bubble stays.
                    if ("orb.js".equals(filename) && emulatedGpu()) return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers,
                            new java.io.ByteArrayInputStream("/* Emulated GPU: CSS bubble. */".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, getAssets().open("web/" + filename));
                } catch (Exception ignored) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.getUrl().toString().startsWith(ORIGIN)) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl()); return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); } // Audio is captured by the foreground Android service, not the WebView.
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePicker != null) filePicker.onReceiveValue(null); filePicker = callback;
                Intent choose = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(java.util.Arrays.asList(params.getAcceptTypes()).contains("application/json") ? "application/json" : "*/*");
                choose.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(choose, IMPORT); } catch (Exception ignored) { filePicker.onReceiveValue(null); filePicker = null; }
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1)); setContentView(root);
        startOnOpen = consumeListenIntent(getIntent());
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::back);
        web.loadUrl(ORIGIN);
    }
    private static WebResourceResponse blocked() { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0])); }
    private void openExternal(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); startOnOpen = consumeListenIntent(intent); if (ready) opened(); }
    @Override protected void onResume() {
        super.onResume(); app.activityVisible = true;
        boolean requested = getPreferences(MODE_PRIVATE).getBoolean("overlay_requested", false);
        if (requested) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("overlay_requested", false).apply();
            boolean enabled = Settings.canDrawOverlays(this);
            getSharedPreferences("preferences", MODE_PRIVATE).edit().putBoolean("overlay", enabled).apply();
            if (enabled) startForegroundService(new Intent(this, AssistantService.class).setAction(AssistantService.OVERLAY));
            app.emit(Json.object("event", "overlay", "enabled", enabled));
        }
        if (app.service != null) app.service.refreshBubble();
        if (ready) opened();
    }
    private boolean consumeListenIntent(Intent intent) {
        activationOnOpen = app.launchToken.equals(intent.getStringExtra("listen_token"));
        boolean listen = intent.getBooleanExtra("listen_on_open", false) && app.launchToken.equals(intent.getStringExtra("listen_token"));
        intent.removeExtra("listen_on_open"); intent.removeExtra("listen_token"); return listen;
    }
    private void opened() {
        app.emit(Json.object("event", "open", "listen", startOnOpen,"activation",activationOnOpen)); startOnOpen = false;activationOnOpen=false;
    }
    @Override protected void onStop() { app.activityVisible = false; if (app.service != null) app.service.refreshBubble(); super.onStop(); }
    @Override protected void onDestroy() { app.detach(this); if (filePicker != null) filePicker.onReceiveValue(null); web.removeJavascriptInterface("InterpreteNative"); web.destroy(); network.shutdown(); super.onDestroy(); }
    private void back() { if (ready) web.evaluateJavascript("document.getElementById('companion').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))", null); else moveTaskToBack(true); }
    // API 33+ uses the native gesture callback above. Older releases send key events.
    @Override public boolean onKeyDown(int code, KeyEvent event) {
        if (Build.VERSION.SDK_INT < 33 && code == KeyEvent.KEYCODE_BACK) { event.startTracking(); return true; }
        return super.onKeyDown(code, event);
    }
    @Override public boolean onKeyUp(int code, KeyEvent event) {
        if (Build.VERSION.SDK_INT < 33 && code == KeyEvent.KEYCODE_BACK && !event.isCanceled()) { back(); return true; }
        return super.onKeyUp(code, event);
    }
    @Override public void receive(JSONObject event) {
        if (!ready || isDestroyed()) return;
        web.evaluateJavascript("window.InterpreteAndroidReceive(" + JSONObject.quote(event.toString()) + ")", null);
    }
    static boolean emulatedGpu() {
        String hardware = Build.HARDWARE == null ? "" : Build.HARDWARE.toLowerCase(java.util.Locale.ROOT);
        String product = Build.PRODUCT == null ? "" : Build.PRODUCT.toLowerCase(java.util.Locale.ROOT);
        String fingerprint = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT;
        return hardware.contains("ranchu") || hardware.contains("goldfish") || product.contains("sdk_gphone") || product.contains("emulator")
                || fingerprint.startsWith("generic") || fingerprint.contains("emulator") || fingerprint.contains("sdk_gphone");
    }
    public final class Bridge {
        /** Emulated GPUs (gfxstream, SwiftShader) can kill the WebView renderer: the page then keeps the CSS bubble. */
        @JavascriptInterface public boolean emulatedGpu() { return MainActivity.emulatedGpu(); }
        @JavascriptInterface public void postMessage(String raw) {
            if (raw == null || raw.length() > 16 * 1024 * 1024) return;
            try {
                JSONObject call = new JSONObject(raw); String id = call.optString("id");
                if (!id.matches("[A-Za-z0-9_]{1,100}")) return;
                runOnUiThread(() -> {
                    if (web.getUrl() == null || !web.getUrl().startsWith(ORIGIN) || isDestroyed()) return;
                    try { dispatch(id, call.optString("action"), call.optJSONObject("data") == null ? new JSONObject() : call.optJSONObject("data")); }
                    catch (Exception error) { app.reject(id, MicrophoneEngine.safeMessage(error)); }
                });
            } catch (Exception ignored) { }
        }
    }
    private void dispatch(String id, String action, JSONObject data) throws Exception {
        switch (action) {
            case "ready": ready = true; app.attach(this); app.resolve(id, new JSONObject()); opened(); break;
            case "request":
                String apiPath = data.optString("path");
                if ("/api/status".equals(apiPath)) app.resolve(id, Json.object("ok", true, "status", 200, "body", Json.object("configured", !app.vault.get().isEmpty())));
                else if ("/api/osint".equals(apiPath) && data.optJSONObject("body") != null && data.toString().length() <= 4096) {
                    network.execute(() -> { try { app.resolve(id,Json.object("ok",true,"status",200,"body",OsintSearch.search(data.getJSONObject("body")))); }
                        catch(Exception error) { app.resolve(id,Json.object("ok",false,"status",502,"body",Json.object("error",MicrophoneEngine.safeMessage(error)))); } });
                }
                else if ("/api/verify".equals(apiPath) && data.optJSONObject("body") != null && data.toString().length() <= 260000) {
                    network.execute(() -> { try { app.resolve(id, Json.object("ok", true, "status", 200, "body", app.api().verify(data.optJSONObject("body")))); }
                        catch (Exception error) { app.resolve(id, Json.object("ok", false, "status", 502, "body", Json.object("error", MicrophoneEngine.safeMessage(error)))); } });
                } else app.reject(id, "Requête refusée.");
                break;
            case "launcher": app.resolve(id,new JSONObject());break;
            case "onboard":
                String onboardingTheme=data.optString("theme");if(!java.util.Arrays.asList("pastel","dark","matrix","investigation","fire").contains(onboardingTheme)){app.reject(id,"Thème inconnu.");break;}
                getSharedPreferences("preferences",MODE_PRIVATE).edit().putBoolean("onboardingComplete",true).putString("theme",onboardingTheme).apply();app.resolve(id,new JSONObject());break;
            case "theme":
                String theme=data.optString("theme");if(!java.util.Arrays.asList("pastel","dark","matrix","investigation","fire").contains(theme)){app.reject(id,"Thème inconnu.");break;}
                getSharedPreferences("preferences",MODE_PRIVATE).edit().putString("theme",theme).apply();
                int background=Color.parseColor(theme.equals("dark")?"#10131d":theme.equals("matrix")?"#030c08":theme.equals("investigation")?"#e9dfca":theme.equals("fire")?"#140c0a":"#f3eff9");
                web.setBackgroundColor(background);((android.view.View)web.getParent()).setBackgroundColor(background);
                if(Build.VERSION.SDK_INT>=30&&getWindow().getInsetsController()!=null) {int light=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;getWindow().getInsetsController().setSystemBarsAppearance(theme.equals("dark")||theme.equals("matrix")?0:light,light);}
                app.resolve(id,new JSONObject());break;
            case "settings": app.resolve(id, Json.object("onboardingComplete",getSharedPreferences("preferences",MODE_PRIVATE).getBoolean("onboardingComplete",false),"theme",getSharedPreferences("preferences",MODE_PRIVATE).getString("theme","pastel"),"canRemember", app.vault.available(), "hasSavedKey", app.vault.remembered(), "overlayEnabled", getSharedPreferences("preferences", MODE_PRIVATE).getBoolean("overlay", false) && Settings.canDrawOverlays(this))); break;
            case "saveKey": network.execute(() -> { try { app.vault.save(data.optString("key"), data.optBoolean("remember")); app.resolve(id, Json.object("configured", true)); } catch (Exception error) { app.reject(id, MicrophoneEngine.safeMessage(error)); } }); break;
            case "startMic": microphoneOptions=data; requestMicrophone(id); break;
            case "extractImage":
                network.execute(()->{try {byte[] bytes=android.util.Base64.decode(data.optString("base64"),android.util.Base64.DEFAULT);NativeImageOcr.extract(bytes,value->app.resolve(id,value),message->app.reject(id,message));}catch(Exception error){app.reject(id,"Image illisible.");}});break;
            case "audioInventory": network.execute(()->{try{app.resolve(id,Json.object("clips",app.audioStore.inventory()));}catch(Exception error){app.reject(id,"Inventaire indisponible.");}});break;
            case "clearAudio": if(app.service!=null){app.reject(id,"Arrêtez l’assistant avant de supprimer les audios.");break;} app.audioStore.clear();app.resolve(id,new JSONObject());break;
            case "stopMic": if (app.service != null) app.service.stopMic(() -> app.resolve(id, new JSONObject())); else app.resolve(id, new JSONObject()); break;
            case "panel": if (!data.optBoolean("open")) moveTaskToBack(true); app.resolve(id, new JSONObject()); break;
            case "unsaved": unsaved = data.optBoolean("value"); app.resolve(id, new JSONObject()); break;
            case "overlay": setOverlay(id, data.optBoolean("enable")); break;
            case "audioBundle":
            case "archive":
                if (archiveRequest != null) { app.reject(id, "Un enregistrement est déjà en cours."); break; }
                String ext = action.equals("audioBundle")?"zip":data.optString("extension");
                data.put("extension",ext);
                if (!ext.equals("html") && !ext.equals("json") && !ext.equals("zip")) { app.reject(id, "Format d’archive refusé."); break; }
                archiveRequest = data; archiveId = id;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(ext.equals("html") ? "text/html" : ext.equals("zip")?"application/zip":"application/json");
                save.putExtra(Intent.EXTRA_TITLE, "interprete-" + java.time.LocalDate.now() + "." + ext); startActivityForResult(save, ARCHIVE); break;
            case "viewArchive": showArchive(); app.resolve(id, new JSONObject()); break;
            case "copy":
                String text = Json.string(data, "text", 10000); ClipData clip = ClipData.newPlainText("Interprete", text);
                PersistableBundle privateClip = new PersistableBundle(); privateClip.putBoolean("android.content.extra.IS_SENSITIVE", true); clip.getDescription().setExtras(privateClip);
                ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(clip); app.resolve(id, new JSONObject()); break;
            case "quit": confirmQuit(); app.resolve(id, new JSONObject()); break;
            default: app.reject(id, "Commande refusée.");
        }
    }
    private void requestMicrophone(String id) {
        if(microphoneOptions.optBoolean("record_only")&&!microphoneOptions.optBoolean("retain_audio",true)){app.reject(id,"Activez la conservation audio pour enregistrer hors ligne.");return;}
        if (app.vault.get().isEmpty() && !microphoneOptions.optBoolean("record_only")) { app.reject(id, "Ajoutez votre clé API dans les réglages."); return; }
        if (microphoneRequest != null) { app.reject(id, "Une autorisation du micro est déjà en cours."); return; }
        boolean notification = Build.VERSION.SDK_INT >= 33 && !getPreferences(MODE_PRIVATE).getBoolean("notification_asked", false);
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED || notification) {
            microphoneRequest = id;
            if (notification) { getPreferences(MODE_PRIVATE).edit().putBoolean("notification_asked", true).apply(); requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS}, MICROPHONE); }
            else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE);
        } else beginMicrophone(id);
    }
    private void beginMicrophone(String id) {
        try { startForegroundService(new Intent(this, AssistantService.class).setAction(AssistantService.START_MIC).putExtra("request_id", id).putExtra("retain_audio",microphoneOptions.optBoolean("retain_audio",true)).putExtra("record_only",microphoneOptions.optBoolean("record_only")).putExtra("duration_ms",microphoneOptions.optLong("duration_ms",180*60*1000L))); }
        catch (RuntimeException error) { app.reject(id, "Gardez Interprete ouvert pour démarrer le micro."); }
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == MICROPHONE && microphoneRequest != null) {
            String id = microphoneRequest; microphoneRequest = null;
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) beginMicrophone(id);
            else app.reject(id, "Le micro n’a pas été autorisé. Vous pouvez toujours saisir un texte.");
        }
    }
    private void setOverlay(String id, boolean enable) {
        if (!enable) {
            getSharedPreferences("preferences", MODE_PRIVATE).edit().putBoolean("overlay", false).apply(); if (app.service != null) app.service.refreshBubble();
            app.resolve(id, Json.object("enabled", false));
        } else if (!Settings.canDrawOverlays(this)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("overlay_requested", true).apply();
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))); app.resolve(id, Json.object("enabled", false, "pending", true));
        } else {
            getSharedPreferences("preferences", MODE_PRIVATE).edit().putBoolean("overlay", true).apply();
            startForegroundService(new Intent(this, AssistantService.class).setAction(AssistantService.OVERLAY)); app.resolve(id, Json.object("enabled", true));
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == IMPORT && filePicker != null) {
            Uri[] selected = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = Math.min(32, data.getClipData().getItemCount()); selected = new Uri[count];
                    for (int i=0;i<count;i++) selected[i]=data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) selected = new Uri[]{data.getData()};
            }
            filePicker.onReceiveValue(selected); filePicker = null;
        }
        if (requestCode == ARCHIVE && archiveRequest != null) {
            JSONObject saved = archiveRequest; String id = archiveId; archiveRequest = null; archiveId = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) { app.resolve(id, Json.object("saved", false)); return; }
            Uri destination = data.getData();
            network.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                    if (output == null) throw new IllegalStateException("Fichier indisponible.");
                    if("zip".equals(saved.optString("extension"))) {
                        org.json.JSONArray clips=saved.optJSONArray("clips");
                        if(clips==null||clips.length()>10000)throw new IllegalArgumentException("Inventaire audio invalide.");
                        try(java.util.zip.ZipOutputStream zip=new java.util.zip.ZipOutputStream(output)) {
                            zip.putNextEntry(new java.util.zip.ZipEntry("index.html"));zip.write(saved.optString("content").getBytes(StandardCharsets.UTF_8));zip.closeEntry();
                            zip.putNextEntry(new java.util.zip.ZipEntry("session.json"));zip.write(saved.optString("session").getBytes(StandardCharsets.UTF_8));zip.closeEntry();
                            java.util.HashSet<String> seen=new java.util.HashSet<>();
                            for(int i=0;i<clips.length();i++) {String clip=clips.getString(i);if(!seen.add(clip))continue;java.io.File source=app.audioStore.file(clip);if(!source.isFile())throw new IllegalStateException("Extrait audio manquant.");zip.putNextEntry(new java.util.zip.ZipEntry("audio/"+clip+".wav"));try(java.io.FileInputStream stream=new java.io.FileInputStream(source)){byte[] buffer=new byte[32768];int count;while((count=stream.read(buffer))!=-1)zip.write(buffer,0,count);}zip.closeEntry();}
                        }
                        app.lastArchive=saved.optString("content");
                    } else output.write(saved.optString("content").getBytes(StandardCharsets.UTF_8));
                    if ("html".equals(saved.optString("extension"))) app.lastArchive = saved.optString("content");
                    app.resolve(id, Json.object("saved", true));
                } catch (Exception ignored) { app.reject(id, "L’archive n’a pas pu être enregistrée. La session reste disponible."); }
            });
        }
    }
    private void showArchive() {
        if (app.lastArchive.isEmpty()) throw new IllegalStateException("Exportez d’abord un compte rendu HTML.");
        android.app.Dialog dialog = new android.app.Dialog(this, android.R.style.Theme_Material_Light_NoActionBar);
        android.widget.LinearLayout root = new android.widget.LinearLayout(this); root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(247,246,249));
        WebView viewer = new WebView(this); viewer.setWebChromeClient(web.getWebChromeClient()); viewer.getSettings().setJavaScriptEnabled(true); viewer.getSettings().setAllowFileAccess(false); viewer.getSettings().setAllowContentAccess(false);
        viewer.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        viewer.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { if (request.getUrl().toString().startsWith("https://archive.interprete.local/#")) return false; openExternal(request.getUrl()); return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();String path=uri.getPath();
                if("https".equals(uri.getScheme())&&"archive.interprete.local".equals(uri.getHost())&&path!=null&&path.startsWith("/audio/")&&path.endsWith(".wav"))try {
                    java.io.File audio=app.audioStore.file(path.substring(7,path.length()-4));
                    return new WebResourceResponse("audio/wav",null,new java.io.FileInputStream(audio));
                }catch(Exception ignored){}
                return blocked();
            }
        });
        String html = app.lastArchive.replace("<head>", "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src 'self';\"><style>#print{display:none}</style>");
        viewer.loadDataWithBaseURL("https://archive.interprete.local/", html, "text/html", "UTF-8", null);
        root.addView(viewer, new android.widget.LinearLayout.LayoutParams(-1, 0, 1));
        android.widget.Button close = new android.widget.Button(this); close.setText(R.string.close_archive); close.setOnClickListener(view -> dialog.dismiss()); root.addView(close);
        dialog.setContentView(root); dialog.setOnDismissListener(ignored -> viewer.destroy()); dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setLayout(-1, -1);
            if (Build.VERSION.SDK_INT >= 30) { dialog.getWindow().setDecorFitsSystemWindows(false); root.setOnApplyWindowInsetsListener((view, insets) -> { android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()); view.setPadding(safe.left, safe.top, safe.right, safe.bottom); return insets; }); root.requestApplyInsets(); }
        }
    }
    private void confirmQuit() {
        Runnable exit = () -> { stopService(new Intent(this, AssistantService.class)); app.vault.clearMemory(); finishAndRemoveTask(); };
        if (unsaved) new AlertDialog.Builder(this).setTitle("Conserver l’interview").setMessage("Cette session n’a pas été exportée.").setNegativeButton("Continuer", null).setPositiveButton("Quitter sans exporter", (dialog, which) -> exit.run()).show();
        else exit.run();
    }
}
