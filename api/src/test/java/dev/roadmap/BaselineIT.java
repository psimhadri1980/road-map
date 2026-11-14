package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
 * 006-T003 (FR-005, FR-006, SC-003): baselines name versions; reviewers only; unique; at most 50.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BaselineIT {

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

  private MockHttpServletResponse call(String user, String body) throws Exception {
    var req = body == null ? get(api()) : post(api()).contentType("application/json").content(body);
    return mvc.perform(req.header("Authorization", Services.bearer(user)))
        .andReturn()
        .getResponse();
  }

  private String api() {
    return "/api/roadmaps/" + slug + "/baselines";
  }

  @Test
  void aReviewerNamesTheCurrentVersionAndEveryMemberSeesIt() throws Exception {
    var r = call("carol", "{\"name\":\"Q1 plan\"}");
    assertEquals(201, r.getStatus(), r.getContentAsString());
    var b = JSON.readTree(r.getContentAsString());
    assertEquals(1, b.get("version").asInt());
    assertEquals("carol", b.get("by").asString());
    var list = JSON.readTree(call("dave", null).getContentAsString());
    assertEquals(1, list.size());
    assertEquals("Q1 plan", list.get(0).get("name").asString());
  }

  @Test
  void rulesAreCheckedInOrder() throws Exception {
    assertEquals(404, call("bob", "{\"name\":\"x\"}").getStatus());
    assertEquals(404, call("bob", null).getStatus());
    assertEquals(403, call("dave", "{\"name\":\"x\"}").getStatus());
    assertEquals(422, call("carol", "{\"name\":\"\"}").getStatus());
    assertEquals(422, call("carol", "{\"name\":\"" + "x".repeat(101) + "\"}").getStatus());
    assertEquals(422, call("carol", "{\"name\":\"x\",\"version\":9}").getStatus());
    assertEquals(201, call("carol", "{\"name\":\"x\",\"version\":1}").getStatus());
    assertEquals(409, call("carol", "{\"name\":\"x\"}").getStatus());
  }

  @Test
  void atMostFiftyBaselines() throws Exception {
    for (int i = 0; i < 50; i++) {
      assertEquals(201, call("carol", "{\"name\":\"b" + i + "\"}").getStatus());
    }
    assertEquals(422, call("carol", "{\"name\":\"one too many\"}").getStatus());
  }
}
