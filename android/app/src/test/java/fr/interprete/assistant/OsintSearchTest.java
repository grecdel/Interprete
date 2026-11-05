package fr.interprete.assistant;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
public class OsintSearchTest {
    @Test public void additionalProvidersProduceDocumentaryNotices() throws Exception {
        String[][] fixtures={
            {"europe_pmc","{\"resultList\":{\"result\":[{\"id\":\"123\",\"source\":\"MED\",\"title\":\"Study\"}]}}"},
            {"wikidata","{\"search\":[{\"id\":\"Q42\",\"label\":\"Example\"}]}"},
            {"wayback","{\"archived_snapshots\":{\"closest\":{\"available\":true,\"url\":\"http://web.archive.org/web/2020/https://example.org\",\"timestamp\":\"2020\"}}}"},
            {"gdelt","{\"articles\":[{\"title\":\"Article\",\"url\":\"https://example.org/news\"}]}"},
            {"openlibrary","{\"docs\":[{\"key\":\"/works/OL123W\",\"title\":\"Book\"}]}"}
        };
        for(String[] fixture:fixtures){JSONObject result=OsintSearch.normalize(fixture[0],"test",new JSONObject(fixture[1]));assertEquals(1,result.getJSONArray("results").length());assertFalse(result.getJSONArray("results").getJSONObject(0).has("verdict"));}
    }
    @Test public void unsafeIdentifiersAreNotLinks() throws Exception {
        assertEquals(0,OsintSearch.normalize("wikidata","test",new JSONObject("{\"search\":[{\"id\":\"../../secret\"}]}" )).getJSONArray("results").length());
        assertEquals("",ClaimNormalizer.publicUrl("https://0177.0.0.1"));
        assertEquals("",ClaimNormalizer.publicUrl("https://127.1"));
        assertEquals("",ClaimNormalizer.publicUrl("https://service.internal"));
        assertEquals(0,OsintSearch.normalize("gdelt","test",new JSONObject("{\"articles\":[{\"url\":\"https://example.org:80\"}]}" )).getJSONArray("results").length());
    }
}
