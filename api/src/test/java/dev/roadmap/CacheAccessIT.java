package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 003-T002 (FR-007, FR-008; SC-001, SC-005): the cache is shared and never decides access. A
 * roadmap warmed by a member is refused to a non-member, and many readers leave one entry.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CacheAccessIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  @Autowired MockMvc mvc;
  @Autowired StringRedisTemplate redis;

  private int status(String slug, String user) throws Exception {
    return mvc.perform(get("/api/roadmaps/" + slug).header("Authorization", Services.bearer(user)))
        .andReturn()
        .getResponse()
        .getStatus();
  }

  @Test
  void aWarmCacheDoesNotServeANonMember() throws Exception {
    String slug = Services.insert(Services.sample(), "beta");
    try {
      assertEquals(200, status(slug, "carol")); // a member warms the cache
      assertNotNull(redis.opsForValue().get("roadmap::" + slug + "@1"));
      assertEquals(404, status(slug, "bob")); // a non-member, cache warm
      assertEquals(404, status(slug, "erin"));
    } finally {
      Services.delete(slug);
    }
  }

  @Test
  void aChangedOwnerTakesEffectAtOnceEvenWithTheDocumentCached() throws Exception {
    String slug = Services.insert(Services.sample(), "beta");
    try {
      assertEquals(200, status(slug, "carol"));
      Services.setTeam(slug, "alpha"); // the owner is read from the database, not the cache
      assertEquals(404, status(slug, "carol"));
      assertEquals(200, status(slug, "bob"));
    } finally {
      Services.delete(slug);
    }
  }

  @Test
  void manyReadersShareTheOneEntryOfTheRoadmap() throws Exception {
    String slug = Services.insert(Services.sample(), "alpha");
    try {
      for (String user : new String[] {"sample", "alice", "bob", "dave"}) {
        assertEquals(200, status(slug, user));
      }
      // The service's Redis account may only GET and SET roadmap::*, so the keyspace cannot be
      // listed
      // here (and should not be widened for a test). The cached method takes no user argument, so
      // the
      // one key roadmap::<slug> is all four readers could have used; its presence is what is
      // checked.
      assertNotNull(
          redis.opsForValue().get("roadmap::" + slug + "@1")); // EXISTS is not allowed either
    } finally {
      Services.delete(slug);
    }
  }
}
