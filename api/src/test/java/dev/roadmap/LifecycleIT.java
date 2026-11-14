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
 * 005-T002 (FR-001 to FR-005, FR-008 to FR-012, SC-002, SC-005): the lifecycle moves with real
 * tokens on a fixture roadmap of team beta (dave edits, carol reviews, bob is outside beta).
 */
@SpringBootTest
@AutoConfigureMockMvc
class LifecycleIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String RENAME =
      "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t2\",\"fields\":{\"name\":\"Renamed\"}}";

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

  private String base() {
    return "/api/roadmaps/" + slug + "/proposals";
  }

  /** A draft of dave with one change. */
  private String draft() throws Exception {
    var r = send("POST", base(), "dave", "{\"name\":\"P\",\"changes\":[" + RENAME + "]}");
    assertEquals(201, r.getStatus(), r.getContentAsString());
    return JSON.readTree(r.getContentAsString()).get("id").asString();
  }

  private int act(String user, String id, String action, String note) throws Exception {
    return send(
            "POST",
            base() + "/" + id + "/" + action,
            user,
            note == null ? null : "{\"note\":\"" + note + "\"}")
        .getStatus();
  }

  private JsonNode read(String id) throws Exception {
    return JSON.readTree(send("GET", base() + "/" + id, "dave", null).getContentAsString());
  }

  @Test
  void submitReturnEditSubmitWithdrawDiscard() throws Exception {
    String id = draft();
    assertEquals(200, act("dave", id, "submit", null));
    assertEquals("submitted", read(id).get("state").asString());
    assertEquals(200, act("carol", id, "return", "please split this"));
    var back = read(id);
    assertEquals("draft", back.get("state").asString());
    assertEquals("please split this", back.get("note").asString());
    assertEquals("carol", back.get("noteBy").asString());
    var more =
        send("POST", base() + "/" + id + "/changes", "dave", "{\"changes\":[" + RENAME + "]}");
    assertEquals(200, more.getStatus());
    assertEquals(200, act("dave", id, "submit", null));
    assertEquals(200, act("dave", id, "withdraw", null));
    assertEquals(200, act("dave", id, "discard", null));
    assertEquals("discarded", read(id).get("state").asString());
  }

  @Test
  void rejectIsFinalAndNeedsANote() throws Exception {
    String id = draft();
    act("dave", id, "submit", null);
    assertEquals(422, act("carol", id, "reject", null));
    assertEquals(200, act("carol", id, "reject", "not now"));
    assertEquals("rejected", read(id).get("state").asString());
    for (String a : new String[] {"submit", "withdraw", "discard"}) {
      assertEquals(409, act("dave", id, a, null), a);
    }
    assertEquals(409, act("carol", id, "return", "x"), "return from rejected");
  }

  @Test
  void rolesAndOwnershipAreEnforcedFromTheToken() throws Exception {
    String id = draft();
    assertEquals(403, act("carol", id, "submit", null)); // a reviewer is not the creator
    act("dave", id, "submit", null);
    assertEquals(403, act("dave", id, "return", "mine")); // an editor does not review
    assertEquals(403, act("dave", id, "reject", "mine"));
    assertEquals(404, act("bob", id, "withdraw", null)); // outside the team
    assertEquals(404, act("erin", id, "withdraw", null));
    var forged =
        mvc.perform(
                post(base() + "/" + id + "/return")
                    .header("Authorization", Services.bearer("dave"))
                    .header("x-gantt-user", "carol")
                    .contentType("application/json")
                    .content("{\"note\":\"x\"}"))
            .andReturn()
            .getResponse();
    assertEquals(403, forged.getStatus());
    assertEquals("submitted", read(id).get("state").asString());
  }

  @Test
  void illegalMovesAreConflictsAndNothingChanges() throws Exception {
    String id = draft();
    assertEquals(409, act("dave", id, "withdraw", null)); // a draft is not submitted
    assertEquals(409, act("carol", id, "return", "x")); // nor can it be returned
    act("dave", id, "submit", null);
    assertEquals(409, act("dave", id, "submit", null));
    assertEquals(409, act("dave", id, "discard", null));
    var changes =
        send("POST", base() + "/" + id + "/changes", "dave", "{\"changes\":[" + RENAME + "]}");
    assertEquals(409, changes.getStatus());
    assertTrue(changes.getContentAsString().contains("\"code\":\"conflict\""));
    assertEquals("submitted", read(id).get("state").asString());
    assertEquals(1, read(id).get("changeCount").asInt());
  }

  @Test
  void anEmptyDraftCannotBeSubmittedAndUnknownActionsAreNotFound() throws Exception {
    var r = send("POST", base(), "dave", "{\"name\":\"empty\"}");
    String id = JSON.readTree(r.getContentAsString()).get("id").asString();
    assertEquals(422, act("dave", id, "submit", null));
    assertEquals(404, act("dave", id, "destroy", null));
  }
}
