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
 * 004-T002 (FR-001 to FR-005, FR-008, FR-010, FR-011): create and read Proposals with real tokens
 * on a fixture roadmap of team alpha (sample and alice edit, bob views, carol is team beta, erin
 * has no team).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProposalIT {

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
    slug = Services.insert(Services.sample());
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

  private String create(String user, String name, String... changes) throws Exception {
    var r =
        send(
            "POST",
            base(),
            user,
            "{\"name\":\"" + name + "\",\"changes\":[" + String.join(",", changes) + "]}");
    assertEquals(201, r.getStatus(), r.getContentAsString());
    return JSON.readTree(r.getContentAsString()).get("id").asString();
  }

  @Test
  void anEditorCreatesAndReadsItsProposalAndTheResultShowsTheChange() throws Exception {
    String id = create("sample", "Rename", RENAME);
    var one = JSON.readTree(send("GET", base() + "/" + id, "sample", null).getContentAsString());
    assertEquals("Rename", one.get("name").asString());
    assertEquals("draft", one.get("state").asString());
    assertEquals("sample", one.get("owner").asString());
    assertEquals(1, one.get("changeCount").asInt());
    var doc = send("GET", base() + "/" + id + "/document", "bob", null).getContentAsString();
    assertTrue(doc.contains("Renamed"), "the proposal document shows the change");
    var list = JSON.readTree(send("GET", base(), "bob", null).getContentAsString());
    assertEquals(1, list.size());
  }

  @Test
  void theApprovedRoadmapIsNotChanged() throws Exception {
    var before = send("GET", "/api/roadmaps/" + slug, "sample", null).getContentAsString();
    create("sample", "Rename", RENAME);
    var after = send("GET", "/api/roadmaps/" + slug, "sample", null).getContentAsString();
    assertEquals(before, after);
    assertTrue(!after.contains("Renamed"));
  }

  @Test
  void aViewerAndAReviewerMayReadButNotCreate() throws Exception {
    Services.setTeam(slug, "alpha");
    assertEquals(403, send("POST", base(), "bob", "{\"name\":\"x\"}").getStatus());
    String id = create("alice", "Mine");
    assertEquals(200, send("GET", base() + "/" + id, "bob", null).getStatus());
    Services.setTeam(slug, "beta"); // carol is a reviewer in beta
    assertEquals(403, send("POST", base(), "carol", "{\"name\":\"x\"}").getStatus());
    assertEquals(200, send("GET", base(), "carol", null).getStatus());
  }

  @Test
  void anOutsiderGetsTheSameAnswerAsForAnAbsentRoadmap() throws Exception {
    String id = create("sample", "Hidden");
    String absent = "/api/roadmaps/no-such-roadmap/proposals";
    for (String user : new String[] {"carol", "erin"}) {
      var outside = send("GET", base(), user, null);
      assertEquals(404, outside.getStatus());
      assertEquals(
          send("GET", absent, user, null).getContentAsString(), outside.getContentAsString());
      assertEquals(404, send("GET", base() + "/" + id, user, null).getStatus());
      assertEquals(404, send("GET", base() + "/" + id + "/document", user, null).getStatus());
      assertEquals(404, send("POST", base(), user, "{\"name\":\"x\"}").getStatus());
    }
  }

  @Test
  void aForgedUserHeaderNamesNoone() throws Exception {
    var r =
        mvc.perform(
                post(base())
                    .header("Authorization", Services.bearer("bob"))
                    .header("x-gantt-user", "sample")
                    .contentType("application/json")
                    .content("{\"name\":\"x\"}"))
            .andReturn()
            .getResponse();
    assertEquals(403, r.getStatus());
  }

  @Test
  void anInvalidRequestIsRefusedWithNothingStored() throws Exception {
    String bad =
        "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"nope\",\"fields\":{\"name\":\"x\"}}";
    var r = send("POST", base(), "sample", "{\"name\":\"Bad\",\"changes\":[" + bad + "]}");
    assertEquals(422, r.getStatus());
    assertTrue(r.getContentAsString().contains("\"code\":\"invalid\""));
    assertEquals(422, send("POST", base(), "sample", "{\"name\":\"\"}").getStatus());
    assertEquals(422, send("POST", base(), "sample", "not json").getStatus());
    assertEquals("[]", send("GET", base(), "sample", null).getContentAsString());
  }

  @Test
  void aMalformedProposalIdIsNotFound() throws Exception {
    assertEquals(404, send("GET", base() + "/not-a-uuid", "sample", null).getStatus());
  }
}
