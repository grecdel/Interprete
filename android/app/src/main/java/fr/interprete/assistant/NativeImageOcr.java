package fr.interprete.assistant;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import org.json.JSONObject;
import java.util.function.Consumer;

final class NativeImageOcr {
    static void extract(byte[] bytes,Consumer<JSONObject> complete,Consumer<String> fail) {
        Bitmap bitmap=null;
        try {
            if(bytes.length==0||bytes.length>8*1024*1024)throw new IllegalArgumentException();
            BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
            if(bounds.outWidth<=0||bounds.outHeight<=0||(long)bounds.outWidth*bounds.outHeight>16000000)throw new IllegalArgumentException();
            BitmapFactory.Options sampling=new BitmapFactory.Options();sampling.inSampleSize=1;
            while((long)bounds.outWidth*bounds.outHeight/(sampling.inSampleSize*sampling.inSampleSize)>4000000)sampling.inSampleSize*=2;
            bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,sampling);if(bitmap==null)throw new IllegalArgumentException();
            final Bitmap image=bitmap;
            final com.google.mlkit.vision.text.TextRecognizer recognizer=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            recognizer.process(InputImage.fromBitmap(image,0)).addOnSuccessListener(result->{
                try {String text=result.getText();complete.accept(Json.object("text",text.substring(0,Math.min(200000,text.length())),"extraction_method","mlkit-android-local","extracted_at",java.time.Instant.now().toString(),"incomplete",text.length()>200000));}
                finally {recognizer.close();image.recycle();}
            }).addOnFailureListener(error->{recognizer.close();image.recycle();fail.accept("L’OCR local Android n’a pas pu lire cette image.");});
        }catch(Exception error){if(bitmap!=null)bitmap.recycle();fail.accept("Image invalide, supérieure à 8 Mio ou à 16 millions de pixels.");}
    }
}
