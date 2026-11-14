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
 * 006-T002 (FR-004, FR-009, SC-001, SC-004): restore adds a version, keeps history and is seen at
 * once. Fixture roadmap of team beta (dave edits, carol reviews, bob is outside).
 */
@SpringBootTest
@AutoConfigureMockMvc
class RestoreIT {

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

  private MockHttpServletResponse send(String method, String path, String auth, String body)
      throws Exception {
    var req = method.equals("POST") ? post(path) : get(path);
    req.header("Authorization", auth);
    if (body != null) {
      req.contentType("application/json").content(body);
    }
    return mvc.perform(req).andReturn().getResponse();
  }

  private String api() {
    return "/api/roadmaps/" + slug;
  }

  private String roadmap() throws Exception {
    return send("GET", api(), Services.bearer("dave"), null).getContentAsString();
  }

  private void approveRename(String name) throws Exception {
    String auth = Services.bearer("dave");
    String change =
        "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t2\",\"fields\":{\"name\":\""
            + name
            + "\"}}";
    var r =
        send("POST", api() + "/proposals", auth, "{\"name\":\"P\",\"changes\":[" + change + "]}");
    String id = JSON.readTree(r.getContentAsString()).get("id").asString();
    send("POST", api() + "/proposals/" + id + "/submit", auth, null);
    assertEquals(
        200,
        send("POST", api() + "/proposals/" + id + "/approve", Services.bearer("carol"), null)
            .getStatus());
  }

  @Test
  void aRestoreMakesTheOldContentCurrentAsANewVersionAndKeepsHistory() throws Exception {
    approveRename("Changed name");
    assertTrue(roadmap().contains("Changed name")); // fills the cache under version 2
    var r = send("POST", api() + "/versions/1/restore", Services.bearer("carol"), null);
    assertEquals(200, r.getStatus(), r.getContentAsString());
    var created = JSON.readTree(r.getContentAsString());
    assertEquals(3, created.get("version").asInt());
    assertEquals("restore of 1", created.get("note").asString());
    assertEquals("carol", created.get("by").asString());
    String now = roadmap();
    assertFalse(now.contains("Changed name"));
    assertTrue(now.contains("Requirements"));
    var list =
        JSON.readTree(
            send("GET", api() + "/versions", Services.bearer("dave"), null).getContentAsString());
    assertEquals(3, list.size());
    assertTrue(
        send("GET", api() + "/versions/2", Services.bearer("dave"), null)
            .getContentAsString()
            .contains("Changed name"));
  }

  @Test
  void onlyReviewersRestoreAndOutsidersAreNotTold() throws Exception {
    assertEquals(
        403,
        send("POST", api() + "/versions/1/restore", Services.bearer("dave"), null).getStatus());
    assertEquals(
        404, send("POST", api() + "/versions/1/restore", Services.bearer("bob"), null).getStatus());
    assertEquals(
        404,
        send("POST", api() + "/versions/9/restore", Services.bearer("carol"), null).getStatus());
    assertEquals(
        404,
        send("POST", api() + "/versions/x/restore", Services.bearer("carol"), null).getStatus());
  }

  @Test
  void restoringTheCurrentVersionStillAddsOne() throws Exception {
    assertEquals(
        200,
        send("POST", api() + "/versions/1/restore", Services.bearer("carol"), null).getStatus());
    var list =
        JSON.readTree(
            send("GET", api() + "/versions", Services.bearer("carol"), null).getContentAsString());
    assertEquals(2, list.size());
  }

  @Test
  void simultaneousRestoresGetDistinctNumbers() throws Exception {
    String auth = Services.bearer("carol");
    var pool = Executors.newFixedThreadPool(3);
    try {
      List<Callable<Integer>> all = new ArrayList<>();
      for (int i = 0; i < 3; i++) {
        all.add(() -> {
          var r = send("POST", api() + "/versions/1/restore", auth, null);
          return r.getStatus() == 200
              ? JSON.readTree(r.getContentAsString()).get("version").asInt()
              : -1;
        });
      }
      List<Integer> numbers = new ArrayList<>();
      for (var f : pool.invokeAll(all)) {
        numbers.add(f.get());
      }
      numbers.sort(Integer::compare);
      assertEquals(List.of(2, 3, 4), numbers);
    } finally {
      pool.shutdown();
    }
  }
}
