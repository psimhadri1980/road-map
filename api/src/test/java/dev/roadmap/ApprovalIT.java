package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
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
import tools.jackson.databind.ObjectMapper;

/**
 * 005-T003 (FR-006, FR-007, FR-010, FR-013, SC-001, SC-003, SC-004): approval writes the roadmap
 * atomically, readers see it at once even through the cache, and a failed or repeated approval
 * changes nothing. Fixture roadmap of team beta (dave edits, carol reviews).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApprovalIT {

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

  private MockHttpServletResponse send(String method, String path, String auth, String body)
      throws Exception {
    var req = method.equals("POST") ? post(path) : get(path);
    req.header("Authorization", auth);
    if (body != null) {
      req.contentType("application/json").content(body);
    }
    return mvc.perform(req).andReturn().getResponse();
  }

  private String base() {
    return "/api/roadmaps/" + slug + "/proposals";
  }

  private String roadmap(String user) throws Exception {
    return send("GET", "/api/roadmaps/" + slug, Services.bearer(user), null).getContentAsString();
  }

  private String submitted(String change) throws Exception {
    String auth = Services.bearer("dave");
    var r = send("POST", base(), auth, "{\"name\":\"P\",\"changes\":[" + change + "]}");
    String id = JSON.readTree(r.getContentAsString()).get("id").asString();
    assertEquals(200, send("POST", base() + "/" + id + "/submit", auth, null).getStatus());
    return id;
  }

  private int approve(String id, String user) throws Exception {
    return send("POST", base() + "/" + id + "/approve", Services.bearer(user), null).getStatus();
  }

  private static String update(String task, String name) {
    return "{\"entity\":\"task\",\"op\":\"update\",\"id\":\""
        + task
        + "\",\"fields\":{\"name\":\""
        + name
        + "\"}}";
  }

  @Test
  void anApprovedChangeIsSeenAtOnceEvenAfterTheOldRoadmapWasCached() throws Exception {
    assertFalse(roadmap("dave").contains("Approved name")); // fills the cache under version 1
    String id = submitted(update("t2", "Approved name"));
    assertEquals(200, approve(id, "carol"));
    assertTrue(roadmap("dave").contains("Approved name"));
    assertTrue(roadmap("carol").contains("Approved name"));
    var p =
        JSON.readTree(
            send("GET", base() + "/" + id, Services.bearer("dave"), null).getContentAsString());
    assertEquals("approved", p.get("state").asString());
    assertEquals("carol", p.get("decidedBy").asString());
    assertTrue(p.get("decidedAt").isString());
  }

  @Test
  void changesThatNoLongerFitAreAConflictAndNothingChanges() throws Exception {
    String first = submitted("{\"entity\":\"task\",\"op\":\"delete\",\"id\":\"t3\"}");
    String second = submitted(update("t3", "Too late"));
    assertEquals(200, approve(first, "carol"));
    String before = roadmap("dave");
    assertEquals(409, approve(second, "carol"));
    assertEquals(before, roadmap("dave"));
    var p =
        JSON.readTree(
            send("GET", base() + "/" + second, Services.bearer("dave"), null).getContentAsString());
    assertEquals("submitted", p.get("state").asString());
  }

  @Test
  void onlyAReviewerOtherThanTheCreatorMayApprove() throws Exception {
    String id = submitted(update("t2", "Nope"));
    assertEquals(403, approve(id, "dave"));
    assertEquals(404, approve(id, "bob"));
    assertFalse(roadmap("dave").contains("Nope"));
  }

  @Test
  void aDraftCannotBeApproved() throws Exception {
    var r =
        send(
            "POST",
            base(),
            Services.bearer("dave"),
            "{\"name\":\"d\",\"changes\":[" + update("t2", "x") + "]}");
    String id = JSON.readTree(r.getContentAsString()).get("id").asString();
    assertEquals(409, approve(id, "carol"));
  }

  @Test
  void twoSimultaneousApprovalsGiveOneSuccess() throws Exception {
    String add =
        "{\"entity\":\"task\",\"op\":\"create\",\"id\":\"t77\",\"fields\":{\"name\":\"Once\",\"type\":\"task\",\"parent\":\"t1\",\"start\":\"2026-11-03\",\"duration\":2}}";
    String id = submitted(add);
    String auth = Services.bearer("carol");
    var pool = Executors.newFixedThreadPool(2);
    try {
      List<Callable<Integer>> both = new ArrayList<>();
      for (int i = 0; i < 2; i++) {
        both.add(() -> send("POST", base() + "/" + id + "/approve", auth, null).getStatus());
      }
      var results = pool.invokeAll(both);
      List<Integer> codes = new ArrayList<>();
      for (var f : results) {
        codes.add(f.get());
      }
      codes.sort(Integer::compare);
      assertEquals(List.of(200, 409), codes);
    } finally {
      pool.shutdown();
    }
    String doc = roadmap("dave");
    assertEquals(doc.indexOf("\"t77\""), doc.lastIndexOf("\"t77\""), "the task is there once");
  }
}
