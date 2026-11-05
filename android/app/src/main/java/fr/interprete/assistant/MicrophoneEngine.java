package fr.interprete.assistant;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

final class MicrophoneEngine {
    interface Source { void start(); int read(byte[] buffer); void stop(); void release(); }
    interface Factory { Source create(); }
    interface Listener { void started(); void text(String text); void error(String message); void drained(); }
    private final Factory factory;
    private final NativeApi api;
    private final Listener listener;
    private final ThreadPoolExecutor network = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(3));
    private final List<Runnable> waiters = new ArrayList<>();
    private volatile boolean recording;
    private volatile Source source;
    private boolean recorderDone = true;
    private int pending;
    MicrophoneEngine(Factory factory, NativeApi api, Listener listener) { this.factory = factory; this.api = api; this.listener = listener; }
    void start() {
        synchronized (this) { if (!recorderDone || recording) throw new IllegalStateException("Le micro est déjà actif."); recording = true; recorderDone = false; }
        new Thread(() -> {
            ByteArrayOutputStream current = new ByteArrayOutputStream();
            try {
                source = factory.create(); source.start(); listener.started();
                byte[] buffer = new byte[4096];
                while (recording) {
                    int count = source.read(buffer);
                    if (count <= 0) { if (recording) throw new IllegalStateException("Le micro a interrompu l’enregistrement."); break; }
                    current.write(buffer, 0, count);
                    if (current.size() >= 16000 * 2 * 12) { submit(current.toByteArray()); current.reset(); }
                }
            } catch (Exception ignored) { if (recording) listener.error("Le micro est indisponible. Vérifiez les permissions et l’entrée audio."); }
            finally {
                recording = false;
                Source captured = source; if (captured != null) { try { captured.stop(); } catch (Exception ignored) {} captured.release(); } source = null;
                if (current.size() >= 6400) submit(current.toByteArray());
                synchronized (this) { recorderDone = true; }
                finishIfDrained();
            }
        }, "InterpreteMicrophone").start();
    }
    void stop(Runnable complete) {
        synchronized (this) { waiters.add(complete); recording = false; }
        Source captured = source; if (captured != null) try { captured.stop(); } catch (Exception ignored) { }
        finishIfDrained();
    }
    boolean isRecording() { return recording; }
    boolean isBusy() { synchronized (this) { return !recorderDone || pending > 0; } }
    private void submit(byte[] pcm) {
        boolean nonzero = false; for (byte value : pcm) if (value != 0) { nonzero = true; break; }
        if (!nonzero) return;
        synchronized (this) { pending++; }
        try {
            network.execute(() -> {
                try { String text = api.transcribe(wav(pcm)); if (!text.isEmpty()) listener.text(text); }
                catch (Exception error) { recording = false; listener.error("Un extrait n’a pas pu être transcrit. " + safeMessage(error)); Source captured = source; if (captured != null) try { captured.stop(); } catch (Exception ignored) { } }
                finally { java.util.Arrays.fill(pcm, (byte) 0); synchronized (this) { pending--; } finishIfDrained(); }
            });
        } catch (java.util.concurrent.RejectedExecutionException ignored) {
            synchronized (this) { pending--; } recording = false; listener.error("La transcription prend du retard. L’écoute est en pause. Un extrait n’a pas pu être envoyé.");
            java.util.Arrays.fill(pcm, (byte) 0);
        }
    }
    private void finishIfDrained() {
        List<Runnable> ready;
        synchronized (this) { if (!recorderDone || pending != 0) return; ready = new ArrayList<>(waiters); waiters.clear(); }
        for (Runnable waiter : ready) waiter.run(); listener.drained();
    }
    void close() { recording = false; Source captured = source; if (captured != null) try { captured.stop(); } catch (Exception ignored) { } network.shutdown(); }
    static String safeMessage(Exception error) {
        return error instanceof IllegalStateException || error instanceof IllegalArgumentException ? error.getMessage() : "Vérifiez la connexion et réessayez.";
    }
    static byte[] wav(byte[] pcm) {
        ByteBuffer out = ByteBuffer.allocate(44 + pcm.length).order(ByteOrder.LITTLE_ENDIAN);
        out.put(new byte[]{'R','I','F','F'}).putInt(36 + pcm.length).put(new byte[]{'W','A','V','E','f','m','t',' '});
        out.putInt(16).putShort((short) 1).putShort((short) 1).putInt(16000).putInt(32000).putShort((short) 2).putShort((short) 16);
        out.put(new byte[]{'d','a','t','a'}).putInt(pcm.length).put(pcm); return out.array();
    }
    @SuppressLint("MissingPermission") // The visible Activity and foreground service check RECORD_AUDIO before creating this source.
    static Source androidSource() {
        int size = Math.max(4096, AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT));
        AudioRecord recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size);
        if (recorder.getState() != AudioRecord.STATE_INITIALIZED) { recorder.release(); throw new IllegalStateException("Micro non initialisé."); }
        return new Source() {
            public void start() { recorder.startRecording(); }
            public int read(byte[] buffer) { return recorder.read(buffer, 0, buffer.length); }
            public void stop() { recorder.stop(); }
            public void release() { recorder.release(); }
        };
    }
}
