package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 011-T001 (FR-001, FR-012): the comparison endpoints return added, removed, moved and changed, an
 * empty diff is {@code []}, outsiders get the 404 of an absent roadmap, and nothing is written.
 * Fixture roadmap of team beta (dave edits, carol reviews, bob is outside).
 */
@SpringBootTest
@AutoConfigureMockMvc
class DiffIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  private static final ObjectMapper JSON = new ObjectMapper();

  @Autowired MockMvc mvc;
  String slug;

  @BeforeEach
  void fixture() throws Exception {
    slug = Services.insert(Services.sample(), "beta");
  }

  @AfterEach
  void clean() throws Exception {
    Services.clearProposals(slug);
    Services.delete(slug);
  }

  private MockHttpServletResponse send(String method, String path, String user, String body)
      throws Exception {
    var req = method.equals("POST") ? post(path) : get(path);
    req.header("Authorization", Services.bearer(user));
    if (body != null) {
      req.contentType("application/json").content(body);
    }
    return mvc.perform(req).andReturn().getResponse();
  }

  private String api() {
    return "/api/roadmaps/" + slug;
  }

  private static final String CHANGES =
      "[{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t2\",\"fields\":{\"name\":\"Renamed\"}},"
          + "{\"entity\":\"task\",\"op\":\"create\",\"id\":\"t99\",\"fields\":{\"name\":\"New\","
          + "\"type\":\"task\",\"parent\":\"t1\",\"start\":\"2026-11-03\",\"duration\":2}},"
          + "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t3\",\"fields\":{\"parent\":null}},"
          + "{\"entity\":\"link\",\"op\":\"delete\",\"id\":\"l1\"}]";

  private String propose() throws Exception {
    var r =
        send("POST", api() + "/proposals", "dave", "{\"name\":\"P\",\"changes\":" + CHANGES + "}");
    return JSON.readTree(r.getContentAsString()).get("id").asString();
  }

  private static String kinds(JsonNode diff) {
    var out = new java.util.TreeSet<String>();
    for (JsonNode d : diff) {
      out.add(
          d.get("entity").asString()
              + " "
              + d.get("id").asString()
              + " "
              + d.get("kind").asString());
    }
    return out.toString();
  }

  @Test
  void eachKindOfDifferenceIsReturnedAndAnEmptyDiffIsAnEmptyList() throws Exception {
    Services.addFirstVersion(slug);
    String id = propose();
    send("POST", api() + "/proposals/" + id + "/submit", "dave", null);
    assertEquals(
        200, send("POST", api() + "/proposals/" + id + "/approve", "carol", null).getStatus());
    var diff =
        JSON.readTree(send("GET", api() + "/diff?from=1&to=2", "dave", null).getContentAsString());
    assertEquals("[link l1 removed, task t2 changed, task t3 moved, task t99 added]", kinds(diff));
    for (JsonNode d : diff) {
      if (d.get("kind").asString().equals("added")) {
        assertTrue(d.has("new") && !d.has("old"));
      }
    }
    assertEquals("[]", send("GET", api() + "/diff?from=2&to=2", "dave", null).getContentAsString());
  }

  @Test
  void aProposalIsComparedWithTheCurrentVersionAndNothingIsWritten() throws Exception {
    Services.addFirstVersion(slug);
    String id = propose();
    var diff =
        JSON.readTree(
            send("GET", api() + "/proposals/" + id + "/diff", "dave", null).getContentAsString());
    assertEquals("[link l1 removed, task t2 changed, task t3 moved, task t99 added]", kinds(diff));
    assertEquals(
        1,
        JSON.readTree(send("GET", api() + "/versions", "dave", null).getContentAsString()).size());
  }

  @Test
  void outsidersAndUnknownVersionsGetTheNotFoundAnswer() throws Exception {
    Services.addFirstVersion(slug);
    String absent =
        send("GET", "/api/roadmaps/no-such-roadmap/diff?from=1&to=1", "bob", null)
            .getContentAsString();
    var r = send("GET", api() + "/diff?from=1&to=1", "bob", null);
    assertEquals(404, r.getStatus());
    assertEquals(absent, r.getContentAsString());
    assertEquals(404, send("GET", api() + "/diff?from=1&to=99", "dave", null).getStatus());
    assertEquals(404, send("GET", api() + "/diff?from=x&to=1", "dave", null).getStatus());
  }
}
