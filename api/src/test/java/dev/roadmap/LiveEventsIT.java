package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 008-T001 (FR-001, FR-002, FR-008): a member's stream gets the events of its own roadmap only; an
 * outsider is refused as if the roadmap did not exist; the sixth open stream of one person is
 * refused. dave edits beta, carol reviews beta, bob views alpha.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LiveEventsIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  @Autowired MockMvc mvc;
  @Autowired LiveEvents live;
  private final String name = "Live IT " + UUID.randomUUID().toString().substring(0, 8);
  private final String slug = name.toLowerCase(Locale.ROOT).replace(' ', '-');

  @BeforeEach
  void create() throws Exception {
    String body =
        "{\"name\":\""
            + name
            + "\",\"team\":\"beta\",\"timeZone\":\"Europe/Zurich\",\"start\":\"2026-11-02\"}";
    assertEquals(
        201,
        mvc.perform(
                post("/api/roadmaps")
                    .contentType("application/json")
                    .content(body)
                    .header("Authorization", Services.bearer("dave")))
            .andReturn()
            .getResponse()
            .getStatus());
  }

  @AfterEach
  void clean() throws Exception {
    Services.clearVersions(slug);
    Services.delete(slug);
  }

  private MockHttpServletResponse open(String user, String path) throws Exception {
    return mvc.perform(
            get(path)
                .header("Accept", "text/event-stream, application/json")
                .header("Authorization", Services.bearer(user)))
        .andReturn()
        .getResponse();
  }

  @Test
  void aMemberGetsItsOwnRoadmapsEventsOnly() throws Exception {
    var stream = open("carol", "/api/roadmaps/" + slug + "/events");
    assertEquals(200, stream.getStatus());
    live.publish(slug, LiveEvents.Event.of("currentChanged", null, 2, null, "dave"));
    live.publish("another-roadmap", LiveEvents.Event.of("baselineSaved", null, null, "b", "x"));
    String text = stream.getContentAsString();
    assertTrue(text.contains("\"kind\":\"currentChanged\""), text);
    assertFalse(text.contains("baselineSaved"), text);
  }

  @Test
  void anOutsiderIsRefusedAsNotFound() throws Exception {
    assertEquals(404, open("bob", "/api/roadmaps/" + slug + "/events").getStatus());
    assertEquals(404, open("carol", "/api/roadmaps/no-such-roadmap/events").getStatus());
  }

  @Test
  void theSixthOpenStreamOfOnePersonIsRefused() throws Exception {
    for (int i = 0; i < LiveEvents.MAX_PER_USER; i++) {
      assertEquals(200, open("dave", "/api/roadmaps/" + slug + "/events").getStatus());
    }
    var sixth = open("dave", "/api/roadmaps/" + slug + "/events");
    assertEquals(429, sixth.getStatus());
    assertTrue(sixth.getContentAsString().contains("tooManyStreams"));
  }
}
