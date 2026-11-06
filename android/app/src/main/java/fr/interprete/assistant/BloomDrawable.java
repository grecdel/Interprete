package fr.interprete.assistant;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RuntimeShader;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.SystemClock;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Overlay bubble. On Android 13 and later, the material is the same shader as the web bubble
 * (assets/web/orb.agsl, generated from static/orb.js): water, violet electricity, data or smoke.
 * Earlier versions keep the translucent ribbons, with gradients built once per size.
 */
final class BloomDrawable extends Drawable {
    /** Assistant state read on each frame: listening (0 or 1) and the microphone level (0 to 1). */
    interface State { boolean listening(); float level(); }
    private static final float LIFE = .7f;
    private static final long IDLE_FRAME_MS = 33; // About 30 images per second at rest.
    private final int[] colors;
    private final int base;
    private final int materialId;
    private final String material;
    private final State state;
    private final Path ribbon = new Path(), clip = new Path();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG), shaderPaint = new Paint();
    private final RadialGradient[] gradients = new RadialGradient[3];
    private final Object runtime; // RuntimeShader on API 33+, kept as Object so older devices never load the class.
    private final long origin = SystemClock.uptimeMillis();
    private final float seed = (float) (Math.random() * 50);
    private ValueAnimator animator;
    private float phase = .25f, amp, energy;
    private long lastFrame, lastInvalidate;

    BloomDrawable(Context context, String theme, State state) {
        material = theme; this.state = state;
        switch (theme) {
            case "dark": colors = new int[]{0xffc557ff, 0xff6135fa, 0xffff8bdd}; base = 0xff10041d; materialId = 1; break;
            case "matrix": colors = new int[]{0xff75ffbc, 0xff16a46e, 0xffd4ff93}; base = 0xff02130b; materialId = 2; break;
            case "investigation": colors = new int[]{0xffe9dccb, 0xff8f8292, 0xfff8e1cb}; base = 0xff211e28; materialId = 3; break;
            default: colors = new int[]{0xffa3f4ff, 0xff5198ec, 0xffd9d4ff}; base = 0xff102b48; materialId = 0;
        }
        runtime = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? loadShader(context) : null;
    }
    boolean usesShader() { return runtime != null; }

    @android.annotation.TargetApi(Build.VERSION_CODES.TIRAMISU)
    private static Object loadShader(Context context) {
        try (InputStream stream = context.getAssets().open("web/orb.agsl")) {
            return new RuntimeShader(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
        } catch (Exception | LinkageError ignored) { return null; } // The ribbons remain available.
    }

    void start() {
        if (!ValueAnimator.areAnimatorsEnabled() || animator != null) { invalidateSelf(); return; }
        animator = ValueAnimator.ofFloat(0, 1);
        animator.setDuration(material.equals("investigation") ? 24000 : material.equals("dark") ? 8000 : 14000);
        animator.setRepeatCount(ValueAnimator.INFINITE); animator.setInterpolator(new android.view.animation.LinearInterpolator());
        animator.addUpdateListener(value -> {
            phase = (float) value.getAnimatedValue();
            long now = SystemClock.uptimeMillis();
            boolean active = state != null && state.listening();
            if (active || amp > .02f || now - lastInvalidate >= IDLE_FRAME_MS) { lastInvalidate = now; invalidateSelf(); }
        });
        animator.start();
    }
    void stop() { if (animator != null) { animator.cancel(); animator = null; } }

    @Override protected void onBoundsChange(Rect bounds) {
        float cx = bounds.exactCenterX(), cy = bounds.exactCenterY(), radius = Math.min(bounds.width(), bounds.height()) / 2f;
        clip.reset(); if (radius > 0) clip.addCircle(cx, cy, radius, Path.Direction.CW);
        for (int i = 0; i < 3; i++) gradients[i] = radius > 0 ? new RadialGradient(cx, cy, radius, new int[]{Color.TRANSPARENT, colors[i], colors[(i + 1) % 3]}, new float[]{0, .7f, 1}, Shader.TileMode.CLAMP) : null;
    }

    @Override public void draw(Canvas canvas) {
        if (runtime != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) drawShader(canvas, (RuntimeShader) runtime);
        else drawRibbons(canvas);
    }

    @android.annotation.TargetApi(Build.VERSION_CODES.TIRAMISU)
    private void drawShader(Canvas canvas, RuntimeShader shader) {
        Rect bounds = getBounds(); if (bounds.isEmpty()) return;
        long now = SystemClock.uptimeMillis();
        float delta = lastFrame == 0 ? 0 : Math.min(.1f, (now - lastFrame) / 1000f); lastFrame = now;
        boolean listening = state != null && state.listening();
        float targetAmp = listening ? state.level() : 0, targetEnergy = listening ? .15f : 0;
        boolean still = !ValueAnimator.areAnimatorsEnabled();
        amp += (targetAmp - amp) * (still ? 1 : 1 - (float) Math.exp(-delta * (targetAmp > amp ? 14 : 5)));
        energy += (targetEnergy - energy) * (still ? 1 : 1 - (float) Math.exp(-delta * 2.5));
        shader.setFloatUniform("uRes", bounds.width(), bounds.height());
        shader.setFloatUniform("uTime", still ? 14f : (now - origin) / 1000f);
        shader.setFloatUniform("uAmp", amp); shader.setFloatUniform("uEnergy", energy); shader.setFloatUniform("uAlert", 0f);
        shader.setFloatUniform("uSeed", seed); shader.setFloatUniform("uLife", LIFE); shader.setIntUniform("uMat", materialId);
        shader.setFloatUniform("uLight", channels(colors[0])); shader.setFloatUniform("uMid", channels(colors[1]));
        shader.setFloatUniform("uHot", channels(colors[2])); shader.setFloatUniform("uBase", channels(base));
        shaderPaint.setShader(shader);
        canvas.save(); canvas.translate(bounds.left, bounds.top);
        canvas.drawRect(0, 0, bounds.width(), bounds.height(), shaderPaint);
        canvas.restore();
    }
    private static float[] channels(int color) { return new float[]{Color.red(color) / 255f, Color.green(color) / 255f, Color.blue(color) / 255f}; }

    private void drawRibbons(Canvas canvas) {
        Rect bounds = getBounds(); float cx = bounds.exactCenterX(), cy = bounds.exactCenterY(), radius = Math.min(bounds.width(), bounds.height()) / 2f;
        if (radius <= 0) return;
        paint.setStyle(Paint.Style.FILL); paint.setShader(null); paint.setAlpha(255); paint.setColor(base);
        canvas.drawCircle(cx, cy, radius, paint);
        canvas.save(); canvas.clipPath(clip);
        for (int i = 0; i < 6; i++) {
            float turn = (float) (phase * Math.PI * 2 + i * Math.PI / 3);
            float bend = (float) Math.sin(turn) * radius * .65f;
            canvas.save(); canvas.rotate(phase * 360 + i * 60, cx, cy);
            ribbon.reset(); ribbon.moveTo(cx, cy - radius);
            ribbon.cubicTo(cx + radius, cy - radius * .5f, cx + bend, cy + radius * .5f, cx, cy + radius);
            ribbon.cubicTo(cx - radius * .45f, cy + radius * .2f, cx - bend, cy - radius * .6f, cx, cy - radius);
            paint.setStyle(Paint.Style.FILL); paint.setAlpha(material.equals("investigation") ? 45 : 80);
            paint.setShader(gradients[i % 3]);
            canvas.drawPath(ribbon, paint); paint.setShader(null); paint.setColor(colors[(i + 2) % 3]);
            paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(radius * (material.equals("investigation") ? .09f : .018f)); paint.setAlpha(material.equals("investigation") ? 55 : 170);
            canvas.drawPath(ribbon, paint); canvas.restore();
        }
        if (material.equals("matrix")) {
            paint.setStyle(Paint.Style.FILL); paint.setColor(colors[0]); paint.setAlpha(180); paint.setTypeface(android.graphics.Typeface.MONOSPACE); paint.setTextSize(radius * .22f);
            for (int row = 0; row < 5; row++) canvas.drawText(row % 2 == 0 ? "01 10" : "10 01", cx - radius * .55f, cy - radius * .5f + ((row + phase * 2) % 5) * radius * .25f, paint);
        }
        paint.setShader(null); paint.setStyle(Paint.Style.FILL);
        for (int i = 0; i < 18; i++) {
            double angle = phase * Math.PI * 2 * (1 + i % 3 * .2) + i * Math.PI / 9;
            float distance = radius * (.55f + .3f * (float) Math.sin(angle * .6 + i));
            float x = cx + (float) Math.cos(angle) * distance, y = cy + (float) Math.sin(angle) * distance;
            paint.setColor(colors[i % 3]); paint.setAlpha(material.equals("investigation") ? 65 : 185);
            float size = radius * (material.equals("investigation") ? .045f : .025f);
            if (material.equals("matrix")) canvas.drawRect(x - size, y - size, x + size, y + size, paint);
            else canvas.drawCircle(x, y, size, paint);
        }
        canvas.restore(); paint.setShader(null); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(radius * .025f); paint.setColor(colors[0]); paint.setAlpha(200); canvas.drawCircle(cx, cy, radius * .98f, paint);
        paint.setStyle(Paint.Style.FILL); paint.setAlpha(255);
    }
    @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); shaderPaint.setAlpha(alpha); invalidateSelf(); }
    @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); shaderPaint.setColorFilter(filter); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
}
