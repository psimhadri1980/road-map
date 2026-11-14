package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
 * 007-T002 (FR-004 to FR-006, FR-008, SC-002): refresh onto the current version with a pick for
 * each conflict, and undo. Fixture roadmap of team beta (dave edits, carol reviews, bob is
 * outside); only the creator may refresh.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RefreshIT {

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

  private String draft(String... changes) throws Exception {
    var r =
        send(
            "POST",
            api(),
            "dave",
            "{\"name\":\"P\",\"changes\":[" + String.join(",", changes) + "]}");
    return JSON.readTree(r.getContentAsString()).get("id").asString();
  }

  /** Approves a rename of t2 by another draft, so the roadmap moves to the next version. */
  private void approveRename(String name) throws Exception {
    String id = draft(rename("t2", name));
    send("POST", api() + "/" + id + "/submit", "dave", null);
    assertEquals(200, send("POST", api() + "/" + id + "/approve", "carol", null).getStatus());
  }

  private JsonNode read(String id) throws Exception {
    return JSON.readTree(send("GET", api() + "/" + id, "dave", null).getContentAsString());
  }

  private MockHttpServletResponse act(String id, String what, String user, String body)
      throws Exception {
    return send("POST", api() + "/" + id + "/" + what, user, body);
  }

  @Test
  void dropTakesTheConflictOutAndMovesTheBase() throws Exception {
    String id = draft(rename("t3", "Mine"), rename("t2", "Also mine"));
    approveRename("Theirs");
    var r = act(id, "refresh", "dave", "{\"picks\":{\"2\":\"drop\"}}");
    assertEquals(200, r.getStatus(), r.getContentAsString());
    var p = read(id);
    assertEquals(2, p.get("baseVersion").asInt());
    assertFalse(p.get("stale").asBoolean());
    assertEquals(1, p.get("changeCount").asInt());
    var doc = send("GET", api() + "/" + id + "/document", "dave", null).getContentAsString();
    assertEquals(
        true, doc.contains("Theirs") && doc.contains("Mine") && !doc.contains("Also mine"));
  }

  @Test
  void keepLeavesTheChangeAndItWinsOverTheNewerOne() throws Exception {
    String id = draft(rename("t2", "Mine"));
    approveRename("Theirs");
    assertEquals(200, act(id, "refresh", "dave", "{\"picks\":{\"1\":\"keep\"}}").getStatus());
    assertEquals(1, read(id).get("changeCount").asInt());
    assertEquals(
        0,
        JSON.readTree(
                send("GET", api() + "/" + id + "/conflicts", "dave", null).getContentAsString())
            .size());
  }

  @Test
  void picksAreRequiredAndMustNameConflicts() throws Exception {
    String id = draft(rename("t3", "Mine"), rename("t2", "Also mine"));
    approveRename("Theirs");
    assertEquals(422, act(id, "refresh", "dave", null).getStatus());
    assertEquals(422, act(id, "refresh", "dave", "{\"picks\":{\"2\":\"maybe\"}}").getStatus());
    assertEquals(
        422, act(id, "refresh", "dave", "{\"picks\":{\"1\":\"keep\",\"2\":\"keep\"}}").getStatus());
    assertEquals(1, read(id).get("baseVersion").asInt()); // nothing changed
  }

  @Test
  void undoGivesBackTheBaseAndTheDroppedChanges() throws Exception {
    String id = draft(rename("t3", "Mine"), rename("t2", "Also mine"));
    approveRename("Theirs");
    act(id, "refresh", "dave", "{\"picks\":{\"2\":\"drop\"}}");
    assertEquals(200, act(id, "undo-refresh", "dave", null).getStatus());
    var p = read(id);
    assertEquals(1, p.get("baseVersion").asInt());
    assertEquals(2, p.get("changeCount").asInt());
    assertEquals(409, act(id, "undo-refresh", "dave", null).getStatus());
  }

  @Test
  void onlyTheCreatorOfADraftRefreshes() throws Exception {
    String id = draft(rename("t2", "A"));
    assertEquals(403, act(id, "refresh", "carol", null).getStatus());
    assertEquals(404, act(id, "refresh", "bob", null).getStatus());
    assertEquals(404, act(id, "undo-refresh", "bob", null).getStatus());
    send("POST", api() + "/" + id + "/submit", "dave", null);
    assertEquals(409, act(id, "refresh", "dave", null).getStatus());
    assertEquals(409, act(id, "undo-refresh", "dave", null).getStatus());
  }

  @Test
  void aFreshProposalMayBeRefreshedAndNothingChanges() throws Exception {
    String id = draft(rename("t2", "A"));
    assertEquals(200, act(id, "refresh", "dave", null).getStatus());
    assertEquals(1, read(id).get("changeCount").asInt());
  }
}
