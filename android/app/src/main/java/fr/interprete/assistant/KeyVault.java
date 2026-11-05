package fr.interprete.assistant;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class KeyVault {
    private static final String ALIAS = "InterpreteApiKey";
    private final SharedPreferences preferences;
    private volatile String memoryKey = "";
    KeyVault(Context context) { preferences = context.getSharedPreferences("api-vault", Context.MODE_PRIVATE); }
    private SecretKey secret() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
    }
    boolean available() { try { secret(); return true; } catch (Exception ignored) { return false; } }
    boolean remembered() { return preferences.contains("ciphertext"); }
    synchronized String get() {
        if (!memoryKey.isEmpty()) return memoryKey;
        try {
            String stored = preferences.getString("ciphertext", "");
            if (stored.isEmpty()) return "";
            String[] fields = stored.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secret(), new GCMParameterSpec(128, Base64.decode(fields[0], Base64.NO_WRAP)));
            memoryKey = new String(cipher.doFinal(Base64.decode(fields[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
            return memoryKey;
        } catch (Exception ignored) { return ""; }
    }
    synchronized void save(String value, boolean remember) throws Exception {
        String key = value.trim();
        if (key.length() < 16 || key.length() > 1024 || !key.matches("[A-Za-z0-9_-]+")) throw new IllegalArgumentException("Collez la clé seule, sans espaces.");
        if (remember) {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, secret());
            String data = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(key.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!preferences.edit().putString("ciphertext", data).commit()) throw new IllegalStateException("La clé n’a pas pu être mémorisée.");
        } else preferences.edit().remove("ciphertext").apply();
        memoryKey = key;
    }
    synchronized void clearMemory() { memoryKey = ""; }
}
