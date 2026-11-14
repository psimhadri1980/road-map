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
 * 006-T001 (FR-001 to FR-003, FR-007, SC-002): versions are recorded by approval and readable by
 * the team. Fixture roadmap of team beta (dave edits, carol reviews, bob is outside).
 */
@SpringBootTest
@AutoConfigureMockMvc
class VersionIT {

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

  private void approveRename(String name) throws Exception {
    String change =
        "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t2\",\"fields\":{\"name\":\""
            + name
            + "\"}}";
    var r =
        send("POST", api() + "/proposals", "dave", "{\"name\":\"P\",\"changes\":[" + change + "]}");
    String id = JSON.readTree(r.getContentAsString()).get("id").asString();
    assertEquals(
        200, send("POST", api() + "/proposals/" + id + "/submit", "dave", null).getStatus());
    assertEquals(
        200, send("POST", api() + "/proposals/" + id + "/approve", "carol", null).getStatus());
  }

  private JsonNode versions(String user) throws Exception {
    return JSON.readTree(send("GET", api() + "/versions", user, null).getContentAsString());
  }

  @Test
  void anApprovalAddsExactlyOneVersionEqualToTheRoadmapAfterIt() throws Exception {
    // The fixture was inserted without a version row (the backfill ran before it).
    Services.addFirstVersion(slug);
    assertEquals(1, versions("dave").size());
    approveRename("Second");
    var list = versions("carol");
    assertEquals(2, list.size());
    assertEquals(2, list.get(0).get("version").asInt());
    assertEquals("carol", list.get(0).get("by").asString());
    assertTrue(list.get(0).get("proposalId").isString());
    String now = send("GET", api(), "dave", null).getContentAsString();
    assertEquals(
        JSON.readTree(now),
        JSON.readTree(send("GET", api() + "/versions/2", "dave", null).getContentAsString()));
    assertTrue(
        send("GET", api() + "/versions/1", "dave", null)
            .getContentAsString()
            .contains("Requirements"));
  }

  @Test
  void outsidersAndBadNumbersGetTheNotFoundAnswer() throws Exception {
    Services.addFirstVersion(slug);
    String absent =
        send("GET", "/api/roadmaps/no-such-roadmap/versions", "bob", null).getContentAsString();
    for (String user : new String[] {"bob", "erin"}) {
      var r = send("GET", api() + "/versions", user, null);
      assertEquals(404, r.getStatus());
      assertEquals(absent, r.getContentAsString());
      assertEquals(404, send("GET", api() + "/versions/1", user, null).getStatus());
    }
    assertEquals(404, send("GET", api() + "/versions/99", "dave", null).getStatus());
    assertEquals(404, send("GET", api() + "/versions/abc", "dave", null).getStatus());
  }
}
