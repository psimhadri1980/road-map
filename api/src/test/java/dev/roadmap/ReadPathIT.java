package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * T018, everything up (FR-006, FR-007, FR-024): the roadmap is served and equals the gantt sample;
 * a second read comes from Redis even after the row changed; a stored document that does not match
 * the format is refused. Real PostgreSQL and Redis, over verified TLS. Each test uses its own slug,
 * so its cache entry starts empty (the service account cannot delete keys, by design).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ReadPathIT {

  private static final ObjectMapper JSON = new ObjectMapper();

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  @Autowired MockMvc mvc;
  @Autowired StringRedisTemplate redis;

  private String slug;

  @AfterEach
  void removeFixture() throws Exception {
    if (slug != null) {
      Services.delete(slug);
    }
  }

  private String body(String path) throws Exception {
    return mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  }

  @Test
  void theSeededSampleIsServedAndEqualsTheGanttSample() throws Exception {
    assertEquals(JSON.readTree(Services.sample()), JSON.readTree(body("/api/roadmaps/sample")));
  }

  @Test
  void aSecondReadIsServedFromTheCache() throws Exception {
    slug = Services.insert(Services.sample());
    var first = JSON.readTree(body("/api/roadmaps/" + slug));
    // The service wrote the document under roadmap::<slug>.
    assertNotNull(redis.opsForValue().get("roadmap::" + slug));
    // Change the row directly: only the cache can still answer with the old content.
    Services.update(slug, Services.sample().replace("\"Platform migration\"", "\"Changed in the database\""));
    assertEquals(first, JSON.readTree(body("/api/roadmaps/" + slug)));
  }

  @Test
  void aStoredDocumentThatDoesNotMatchTheFormatIsRefusedAndNotCached() throws Exception {
    slug = Services.insert("{\"contract\":\"gantt-roadmap/1\"}");
    mvc.perform(get("/api/roadmaps/" + slug)).andExpect(status().isUnprocessableContent());
    assertEquals(null, redis.opsForValue().get("roadmap::" + slug));
  }

  @Test
  void anUnknownRoadmapIsNotFoundAndABadSlugIsInvalid() throws Exception {
    mvc.perform(get("/api/roadmaps/no-such-roadmap")).andExpect(status().isNotFound());
    mvc.perform(get("/api/roadmaps/Not_A_Slug")).andExpect(status().isBadRequest());
  }
}
