package fr.interprete.assistant;

import android.animation.ValueAnimator;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;

/** Small local animation: soft petals, no flashes, honors the system animation setting. */
final class BloomDrawable extends Drawable {
    private final int[] colors;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private ValueAnimator animator;
    private float phase=.25f;
    BloomDrawable(String theme) {
        switch(theme) {
            case "dark":colors=new int[]{0xffb497ff,0xff3cbbd4,0xff4c428e};break;
            case "matrix":colors=new int[]{0xffc1ff98,0xff21ba78,0xff095d3b};break;
            case "investigation":colors=new int[]{0xffe8c789,0xffb56c51,0xff883b44};break;
            default:colors=new int[]{0xffefb9d6,0xff889ee8,0xffb19ad8};
        }
    }
    void start() {
        if(!ValueAnimator.areAnimatorsEnabled()||animator!=null)return;
        animator=ValueAnimator.ofFloat(0,1);animator.setDuration(9000);animator.setRepeatCount(ValueAnimator.INFINITE);animator.setInterpolator(new android.view.animation.LinearInterpolator());
        animator.addUpdateListener(value->{phase=(float)value.getAnimatedValue();invalidateSelf();});animator.start();
    }
    void stop() {if(animator!=null){animator.cancel();animator=null;}}
    @Override public void draw(Canvas canvas) {
        Rect bounds=getBounds();float cx=bounds.exactCenterX(),cy=bounds.exactCenterY(),radius=Math.min(bounds.width(),bounds.height())/2f;
        if(radius<=0)return;
        paint.setShader(new RadialGradient(cx-radius*.3f,cy-radius*.3f,radius*1.4f,colors,new float[]{0,.55f,1},Shader.TileMode.CLAMP));paint.setAlpha(255);canvas.drawCircle(cx,cy,radius,paint);
        canvas.save();canvas.rotate(phase*360,cx,cy);
        for(int i=0;i<7;i++) {
            float bloom=(float)(.8+.12*Math.sin(phase*Math.PI*2+i));canvas.save();canvas.rotate(i*360f/7,cx,cy);
            paint.setShader(new RadialGradient(cx,cy-radius*.28f,radius,new int[]{Color.argb(115,255,255,255),colors[i%3],Color.TRANSPARENT},new float[]{0,.5f,1},Shader.TileMode.CLAMP));paint.setAlpha(130);
            canvas.drawOval(cx-radius*.3f,cy-radius*.85f*bloom,cx+radius*.3f,cy+radius*.4f,paint);canvas.restore();
        }
        canvas.restore();paint.setAlpha(255);paint.setShader(null);
    }
    @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
