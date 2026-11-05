package fr.interprete.assistant;

import android.animation.ValueAnimator;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;

/** Local translucent ribbons; material follows the theme and system animation setting. */
final class BloomDrawable extends Drawable {
    private final int[] colors;
    private final String material;
    private final Path ribbon=new Path();
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private ValueAnimator animator;
    private float phase=.25f;
    BloomDrawable(String theme) {
        material=theme;
        switch(theme) {
            case "dark":colors=new int[]{0xffc557ff,0xff6135fa,0xffff8bdd};break;
            case "matrix":colors=new int[]{0xffc1ff98,0xff21ba78,0xff095d3b};break;
            case "investigation":colors=new int[]{0xffd1c1af,0xff827889,0xfff8e1cb};break;
            default:colors=new int[]{0xffa3f4ff,0xff5198ec,0xffd9d4ff};
        }
    }
    void start() {
        if(!ValueAnimator.areAnimatorsEnabled()||animator!=null)return;
        animator=ValueAnimator.ofFloat(0,1);animator.setDuration(material.equals("investigation")?24000:material.equals("dark")?8000:14000);animator.setRepeatCount(ValueAnimator.INFINITE);animator.setInterpolator(new android.view.animation.LinearInterpolator());
        animator.addUpdateListener(value->{phase=(float)value.getAnimatedValue();invalidateSelf();});animator.start();
    }
    void stop() {if(animator!=null){animator.cancel();animator=null;}}
    @Override public void draw(Canvas canvas) {
        Rect bounds=getBounds();float cx=bounds.exactCenterX(),cy=bounds.exactCenterY(),radius=Math.min(bounds.width(),bounds.height())/2f;
        if(radius<=0)return;
        paint.setStyle(Paint.Style.FILL);paint.setShader(null);paint.setAlpha(255);
        paint.setColor(material.equals("matrix")?0xff02130b:material.equals("investigation")?0xff211e28:material.equals("dark")?0xff10041d:0xff102b48);
        canvas.drawCircle(cx,cy,radius,paint);
        canvas.save();Path clip=new Path();clip.addCircle(cx,cy,radius,Path.Direction.CW);canvas.clipPath(clip);
        for(int i=0;i<6;i++) {
            float turn=(float)(phase*Math.PI*2+i*Math.PI/3);
            float bend=(float)Math.sin(turn)*radius*.65f;
            canvas.save();canvas.rotate(phase*360+i*60,cx,cy);
            ribbon.reset();ribbon.moveTo(cx,cy-radius);
            ribbon.cubicTo(cx+radius,cy-radius*.5f,cx+bend,cy+radius*.5f,cx,cy+radius);
            ribbon.cubicTo(cx-radius*.45f,cy+radius*.2f,cx-bend,cy-radius*.6f,cx,cy-radius);
            paint.setStyle(Paint.Style.FILL);paint.setAlpha(material.equals("investigation")?45:80);
            paint.setShader(new RadialGradient(cx,cy,radius,new int[]{Color.TRANSPARENT,colors[i%3],colors[(i+1)%3]},new float[]{0,.7f,1},Shader.TileMode.CLAMP));
            canvas.drawPath(ribbon,paint);paint.setShader(null);paint.setColor(colors[(i+2)%3]);
            paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(radius*(material.equals("investigation")?.09f:.018f));paint.setAlpha(material.equals("investigation")?55:170);
            canvas.drawPath(ribbon,paint);canvas.restore();
        }
        if(material.equals("matrix")) {
            paint.setStyle(Paint.Style.FILL);paint.setColor(colors[0]);paint.setAlpha(180);paint.setTypeface(android.graphics.Typeface.MONOSPACE);paint.setTextSize(radius*.22f);
            for(int row=0;row<5;row++)canvas.drawText(row%2==0?"01 10":"10 01",cx-radius*.55f,cy-radius*.5f+((row+phase*2)%5)*radius*.25f,paint);
        }
        canvas.restore();paint.setShader(null);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(radius*.025f);paint.setColor(colors[0]);paint.setAlpha(200);canvas.drawCircle(cx,cy,radius*.98f,paint);
        paint.setStyle(Paint.Style.FILL);paint.setAlpha(255);

    }
    @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
