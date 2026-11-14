package dev.roadmap;

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

/**
 * T018 (FR-008), changed by 003-T002: database down, roadmap already cached. Spec 001 served it
 * from the cache; since 003 the owning team must be read from the database on every request
 * (research R3), so without the database nobody can be authorised and the answer is "unavailable".
 * Failing closed is the point: a cached copy must never decide who may see a roadmap.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DatabaseDownIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.DOWN, Services.REDIS);
  }

  @Autowired MockMvc mvc;
  @Autowired StringRedisTemplate redis;

  @Test
  void aCachedRoadmapIsNotServedWithoutTheDatabase() throws Exception {
    redis.opsForValue().set("roadmap::cached-while-database-down", Services.sample());
    mvc.perform(
            get("/api/roadmaps/cached-while-database-down")
                .header("Authorization", Services.bearer()))
        .andExpect(status().isServiceUnavailable());
  }
}
