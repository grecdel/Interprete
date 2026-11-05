package fr.interprete.assistant;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.ImageView;

public final class AssistantService extends Service {
    static final String START_MIC = "start_microphone", OVERLAY = "overlay", PAUSE = "pause", STOP = "stop";
    private static final String CHANNEL = "interview";
    private InterpreteApp app;
    private MicrophoneEngine engine;
    private WindowManager windows;
    private ImageView bubble;
    private WindowManager.LayoutParams position;
    private PowerManager.WakeLock wakeLock;
    private final Handler main = new Handler(Looper.getMainLooper());
    private String startRequest;
    private volatile boolean destroyed;
    private static final class BubbleView extends ImageView {
        BubbleView(android.content.Context context) { super(context); }
        @Override public boolean performClick() { super.performClick(); return true; }
    }
    @Override public void onCreate() {
        super.onCreate(); app = (InterpreteApp) getApplication(); app.service = this;
        windows = (WindowManager) getSystemService(WINDOW_SERVICE);
        NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "Assistant d’interview", NotificationManager.IMPORTANCE_LOW));
        wakeLock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Interprete:microphone");
        wakeLock.setReferenceCounted(false);
        foreground(false);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (START_MIC.equals(intent.getAction())) begin(intent.getStringExtra("request_id"));
        else if (PAUSE.equals(intent.getAction())) stopMic(() -> app.emit(Json.object("event", "stopped", "message", "Écoute arrêtée depuis la notification.")));
        else if (STOP.equals(intent.getAction())) {
            getSharedPreferences("preferences", MODE_PRIVATE).edit().putBoolean("overlay", false).apply();
            removeBubble();
            stopMic(() -> {
                app.emit(Json.object("event", "stopped", "message", "Interprete a été arrêté depuis la notification."));
                stopSelf();
            });
        } else refreshBubble();
        return START_NOT_STICKY;
    }
    private void begin(String requestId) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { app.reject(requestId, "Le micro n’a pas été autorisé."); stopIfIdle(); return; }
        if (engine != null && engine.isBusy()) { app.reject(requestId, "La dernière transcription est encore en cours. Réessayez dans un instant."); return; }
        startRequest = requestId;
        try { foreground(true); } catch (SecurityException error) { app.reject(requestId, "Ouvrez Interprete avant de démarrer le micro."); stopIfIdle(); return; }
        wakeLock.acquire(60 * 60 * 1000L);
        engine = new MicrophoneEngine(app.audioFactory(), app.api(), new MicrophoneEngine.Listener() {
            public void started() { if (!destroyed) app.resolve(startRequest, Json.object("started", true)); }
            public void text(String text) { if (!destroyed) { if (wakeLock.isHeld()) wakeLock.acquire(60 * 60 * 1000L); app.emit(Json.object("event", "text", "text", text)); } }
            public void error(String message) { if (!destroyed) { app.reject(startRequest, message); app.emit(Json.object("event", "microphoneError", "message", message)); } }
            public void drained() { main.post(() -> { if (!destroyed) { releaseWakeLock(); foreground(false); stopIfIdle(); } }); }
        });
        engine.start();
    }
    void stopMic(Runnable complete) {
        if (engine == null) { complete.run(); stopIfIdle(); return; }
        engine.stop(() -> main.post(complete));
        releaseWakeLock(); foreground(false);
    }
    private void releaseWakeLock() { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); }
    boolean overlayEnabled() { return getSharedPreferences("preferences", MODE_PRIVATE).getBoolean("overlay", false); }
    void refreshBubble() {
        boolean visible = overlayEnabled() && Settings.canDrawOverlays(this) && !app.activityVisible;
        if (visible && bubble == null) {
            bubble = new BubbleView(this); bubble.setImageResource(R.drawable.ic_notification); bubble.setContentDescription("Ouvrir Interprete et écouter");
            bubble.setOnClickListener(view -> {
                Intent open = new Intent(AssistantService.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                open.putExtra("listen_on_open", engine == null || !engine.isRecording()); open.putExtra("listen_token", app.launchToken); startActivity(open);
            });
            GradientDrawable background = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{Color.rgb(214,199,235), Color.rgb(130,107,174)});
            background.setShape(GradientDrawable.OVAL); bubble.setBackground(background); bubble.setPadding(dp(16), dp(16), dp(16), dp(16)); bubble.setElevation(dp(6));
            position = new WindowManager.LayoutParams(dp(62), dp(62), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
            position.gravity = Gravity.TOP | Gravity.START;
            position.x = getResources().getDisplayMetrics().widthPixels - dp(78); position.y = getResources().getDisplayMetrics().heightPixels / 2;
            bubble.setOnTouchListener(new View.OnTouchListener() {
                float downX, downY; int x, y; boolean dragged;
                @Override public boolean onTouch(View view, MotionEvent event) {
                    if (event.getAction() == MotionEvent.ACTION_DOWN) { downX = event.getRawX(); downY = event.getRawY(); x = position.x; y = position.y; dragged = false; return true; }
                    if (event.getAction() == MotionEvent.ACTION_MOVE) {
                        float dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                        if (Math.abs(dx) + Math.abs(dy) > ViewConfiguration.get(AssistantService.this).getScaledTouchSlop()) dragged = true;
                        if (dragged) { position.x = Math.max(0, Math.min(getResources().getDisplayMetrics().widthPixels - dp(62), x + (int) dx)); position.y = Math.max(0, Math.min(getResources().getDisplayMetrics().heightPixels - dp(100), y + (int) dy)); windows.updateViewLayout(view, position); }
                        return true;
                    }
                    if (event.getAction() == MotionEvent.ACTION_UP) {
                        if (!dragged) view.performClick();
                        return true;
                    }
                    return false;
                }
            });
            try { windows.addView(bubble, position); } catch (SecurityException error) { bubble = null; }
        } else if (!visible && bubble != null) removeBubble();
        stopIfIdle();
    }
    private void removeBubble() { if (bubble != null) { try { windows.removeView(bubble); } catch (IllegalArgumentException ignored) { } bubble = null; } }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void stopIfIdle() { if (!overlayEnabled() && (engine == null || !engine.isBusy())) stopSelf(); }
    private void foreground(boolean microphone) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent pause = PendingIntent.getService(this, 2, new Intent(this, AssistantService.class).setAction(PAUSE), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 3, new Intent(this, AssistantService.class).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle(microphone ? "Interprete · écoute active" : "Interprete · assistant actif")
                .setContentText(microphone ? "Le micro est actif. Appuyez pour revenir à l’interview." : "Bulle ou transcription en cours. Vous pouvez arrêter à tout moment.")
                .setContentIntent(content).setOngoing(true).setVisibility(Notification.VISIBILITY_PRIVATE).setOnlyAlertOnce(true)
                .addAction(new Notification.Action.Builder(null, "Arrêter", stop).build());
        if (microphone) builder.addAction(new Notification.Action.Builder(null, "Pause micro", pause).build());
        int types = 0;
        if (Build.VERSION.SDK_INT >= 34) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
        if (microphone && Build.VERSION.SDK_INT >= 30) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, builder.build(), types); else startForeground(1, builder.build());
    }
    @Override public void onDestroy() {
        destroyed = true; removeBubble(); releaseWakeLock(); if (engine != null) engine.close();
        if (app.service == this) app.service = null; super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
