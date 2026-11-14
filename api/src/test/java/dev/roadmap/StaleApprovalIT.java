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
import tools.jackson.databind.ObjectMapper;

/**
 * 007-T003 (FR-007, SC-003): approval refuses a stale Proposal whose changes collide, and still
 * approves one that is merely stale. Fixture roadmap of team beta (dave edits, carol reviews).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StaleApprovalIT {

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

  private String submitted(String task, String name) throws Exception {
    String change =
        "{\"entity\":\"task\",\"op\":\"update\",\"id\":\""
            + task
            + "\",\"fields\":{\"name\":\""
            + name
            + "\"}}";
    var r = send("POST", api(), "dave", "{\"name\":\"P\",\"changes\":[" + change + "]}");
    String id = JSON.readTree(r.getContentAsString()).get("id").asString();
    send("POST", api() + "/" + id + "/submit", "dave", null);
    return id;
  }

  private int act(String id, String what, String user, String body) throws Exception {
    return send("POST", api() + "/" + id + "/" + what, user, body).getStatus();
  }

  private String roadmap() throws Exception {
    return send("GET", "/api/roadmaps/" + slug, "dave", null).getContentAsString();
  }

  @Test
  void aStaleProposalWithoutConflictsIsApproved() throws Exception {
    String first = submitted("t2", "Two");
    String second = submitted("t3", "Three");
    assertEquals(200, act(second, "approve", "carol", null));
    assertEquals(200, act(first, "approve", "carol", null));
    String doc = roadmap();
    assertTrue(doc.contains("Two") && doc.contains("Three"));
  }

  @Test
  void aCollidingProposalIsRefusedUntilItIsRefreshed() throws Exception {
    String mine = submitted("t2", "Mine");
    String theirs = submitted("t2", "Theirs");
    assertEquals(200, act(theirs, "approve", "carol", null));
    assertEquals(409, act(mine, "approve", "carol", null));
    assertTrue(roadmap().contains("Theirs") && !roadmap().contains("Mine")); // nothing was lost
    assertEquals(200, act(mine, "return", "carol", "{\"note\":\"refresh please\"}"));
    assertEquals(200, act(mine, "refresh", "dave", "{\"picks\":{\"1\":\"keep\"}}"));
    assertEquals(200, act(mine, "submit", "dave", null));
    assertEquals(200, act(mine, "approve", "carol", null));
    assertTrue(roadmap().contains("Mine"));
  }
}
