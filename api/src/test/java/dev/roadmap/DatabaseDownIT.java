package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** T018 (FR-008): Database down, roadmap already cached: still served. */
@SpringBootTest
@AutoConfigureMockMvc
class DatabaseDownIT {
  private static final ObjectMapper JSON = new ObjectMapper();

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.DOWN, Services.REDIS);
  }

  @Autowired MockMvc mvc;
  @Autowired StringRedisTemplate redis;

  @Test
  void aCachedRoadmapIsStillServed() throws Exception {
    // The entry the service writes on a miss (ReadPathIT checks the format): the document text.
    String key = "roadmap::cached-while-database-down";
    redis.opsForValue().set(key, Services.sample());
    var body =
        mvc.perform(get("/api/roadmaps/cached-while-database-down"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertEquals(JSON.readTree(Services.sample()), JSON.readTree(body));
  }
}
