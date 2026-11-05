package fr.interprete.assistant;

import android.content.Context;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.UUID;

final class AudioStore {
    private final File directory;
    AudioStore(Context context) {directory=new File(context.getFilesDir(),"interview-audio");directory.mkdirs();}
    synchronized JSONObject save(byte[] wav,long start,long duration,String recordingId) throws Exception {
        long used=0;File[] files=directory.listFiles();if(files!=null)for(File file:files)used+=file.length();
        if(used+wav.length>512L*1024*1024||directory.getUsableSpace()<16L*1024*1024)throw new IllegalStateException("Stockage audio plein. Exportez et supprimez les enregistrements précédents.");
        String id="clip_"+UUID.randomUUID().toString();File file=file(id);
        try(FileOutputStream output=new FileOutputStream(file)){output.write(wav);output.getFD().sync();}
        StringBuilder hash=new StringBuilder();for(byte value:MessageDigest.getInstance("SHA-256").digest(wav))hash.append(String.format(java.util.Locale.ROOT,"%02x",value&255));
        JSONObject metadata=Json.object("id",id,"recording_id",recordingId,"start_ms",start,"duration_ms",duration,"captured_at",java.time.Instant.now().minusMillis(duration).toString(),"sha256",hash.toString(),"mime_type","audio/wav","size",wav.length);
        try(FileOutputStream output=new FileOutputStream(new File(directory,id+".json"))){output.write(metadata.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        return metadata;
    }
    synchronized void transcript(String id,String text) throws Exception {
        file(id);android.util.AtomicFile sidecar=new android.util.AtomicFile(new File(directory,id+".json"));
        JSONObject value;
        try(FileInputStream input=sidecar.openRead()){value=new JSONObject(new String(NativeApi.read(input,100000),java.nio.charset.StandardCharsets.UTF_8));}
        value.put("transcript",text.substring(0,Math.min(20000,text.length())));value.put("transcribed_at",java.time.Instant.now().toString());
        FileOutputStream output=sidecar.startWrite();
        try{output.write(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));sidecar.finishWrite(output);}catch(Exception error){sidecar.failWrite(output);throw error;}
    }
    File file(String id) {
        if(id==null||!id.matches("clip_[0-9a-f-]{36}"))throw new IllegalArgumentException("Extrait audio invalide.");
        return new File(directory,id+".wav");
    }
    synchronized org.json.JSONArray inventory() throws Exception {
        org.json.JSONArray result=new org.json.JSONArray();File[] files=directory.listFiles();
        if(files!=null)for(File file:files)if(file.getName().endsWith(".json"))try(FileInputStream stream=new FileInputStream(file)){result.put(new JSONObject(new String(NativeApi.read(stream,10000),java.nio.charset.StandardCharsets.UTF_8)));}
        return result;
    }
    synchronized void clear() {File[] files=directory.listFiles();if(files!=null)for(File file:files)file.delete();}
}
