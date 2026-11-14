package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
 * 007-T001 (FR-001 to FR-003, SC-001): a Proposal knows its base version, is stale once the roadmap
 * moves, and lists the changes that touch what changed. Fixture roadmap of team beta (dave edits,
 * carol reviews, bob is outside).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ConflictIT {

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
    Services.addFirstVersion(slug);
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
    return "/api/roadmaps/" + slug + "/proposals";
  }

  private static String rename(String task, String name) {
    return "{\"entity\":\"task\",\"op\":\"update\",\"id\":\""
        + task
        + "\",\"fields\":{\"name\":\""
        + name
        + "\"}}";
  }

  private String draft(String user, String... changes) throws Exception {
    var r =
        send(
            "POST",
            api(),
            user,
            "{\"name\":\"P\",\"changes\":[" + String.join(",", changes) + "]}");
    assertEquals(201, r.getStatus(), r.getContentAsString());
    return JSON.readTree(r.getContentAsString()).get("id").asString();
  }

  private void approveRename(String task, String name) throws Exception {
    String id = draft("dave", rename(task, name));
    send("POST", api() + "/" + id + "/submit", "dave", null);
    assertEquals(200, send("POST", api() + "/" + id + "/approve", "carol", null).getStatus());
  }

  private JsonNode read(String id) throws Exception {
    return JSON.readTree(send("GET", api() + "/" + id, "dave", null).getContentAsString());
  }

  private JsonNode conflicts(String id, String user) throws Exception {
    var r = send("GET", api() + "/" + id + "/conflicts", user, null);
    assertEquals(200, r.getStatus(), r.getContentAsString());
    return JSON.readTree(r.getContentAsString());
  }

  @Test
  void aFreshProposalIsNotStale() throws Exception {
    String id = draft("dave", rename("t2", "A"));
    var p = read(id);
    assertEquals(1, p.get("baseVersion").asInt());
    assertEquals(1, p.get("headVersion").asInt());
    assertFalse(p.get("stale").asBoolean());
    assertEquals(0, conflicts(id, "carol").size());
  }

  @Test
  void aProposalGoesStaleAndNamesOnlyTheChangesThatCollide() throws Exception {
    String id = draft("dave", rename("t3", "Mine"), rename("t2", "Also mine"));
    approveRename("t2", "Theirs");
    var p = read(id);
    assertEquals(1, p.get("baseVersion").asInt());
    assertEquals(2, p.get("headVersion").asInt());
    assertTrue(p.get("stale").asBoolean());
    var found = conflicts(id, "carol");
    assertEquals(1, found.size());
    assertEquals(2, found.get(0).get("position").asInt());
    assertEquals("t2", found.get(0).get("id").asString());
  }

  @Test
  void aCreateOfAnIdThatNowExistsCollides() throws Exception {
    String create =
        "{\"entity\":\"task\",\"op\":\"create\",\"id\":\"tnew\",\"fields\":{\"name\":\"N\","
            + "\"type\":\"task\",\"parent\":\"t1\",\"start\":\"2026-11-03\",\"duration\":2}}";
    String id = draft("dave", create);
    String other = draft("dave", create);
    send("POST", api() + "/" + other + "/submit", "dave", null);
    assertEquals(200, send("POST", api() + "/" + other + "/approve", "carol", null).getStatus());
    assertEquals(1, conflicts(id, "dave").size());
  }

  @Test
  void outsidersAreNotTold() throws Exception {
    String id = draft("dave", rename("t2", "A"));
    assertEquals(404, send("GET", api() + "/" + id + "/conflicts", "bob", null).getStatus());
    assertEquals(404, send("GET", api() + "/nope/conflicts", "dave", null).getStatus());
  }
}
