package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
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
 * 012-T001 (FR-001 to FR-006): an editor or reviewer creates an empty roadmap for their team; it
 * starts at version 1, is listed for that team only, and refusals follow the usual order (outsider
 * 404, viewer 403, clash 409, input 422). bob views alpha, dave edits beta, carol reviews beta.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CreateRoadmapIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  private static final ObjectMapper JSON = new ObjectMapper();

  @Autowired MockMvc mvc;
  private final String name = "Create IT " + UUID.randomUUID().toString().substring(0, 8);
  private final String slug = name.toLowerCase(java.util.Locale.ROOT).replace(' ', '-');

  @AfterEach
  void clean() throws Exception {
    Services.clearVersions(slug);
    Services.delete(slug);
  }

  private MockHttpServletResponse call(String user, String path, String body) throws Exception {
    var req = body == null ? get(path) : post(path).contentType("application/json").content(body);
    return mvc.perform(req.header("Authorization", Services.bearer(user)))
        .andReturn()
        .getResponse();
  }

  private String body(String team, String zone, String start) {
    return "{\"name\":\""
        + name
        + "\",\"team\":\""
        + team
        + "\",\"timeZone\":\""
        + zone
        + "\",\"start\":\""
        + start
        + "\"}";
  }

  @Test
  void anEditorCreatesAnEmptyRoadmapAtVersionOneListedForTheirTeamOnly() throws Exception {
    var r = call("dave", "/api/roadmaps", body("beta", "Europe/Zurich", "2026-11-02"));
    assertEquals(201, r.getStatus());
    JsonNode made = JSON.readTree(r.getContentAsString());
    assertEquals(slug, made.get("slug").asString());
    assertEquals("editor", made.get("role").asString());

    JsonNode doc = JSON.readTree(call("dave", "/api/roadmaps/" + slug, null).getContentAsString());
    assertEquals(0, doc.get("tasks").size());
    assertEquals("Europe/Zurich", doc.get("roadmap").get("timeZone").asString());
    JsonNode versions =
        JSON.readTree(
            call("dave", "/api/roadmaps/" + slug + "/versions", null).getContentAsString());
    assertEquals(1, versions.size());
    assertEquals(1, versions.get(0).get("version").asInt());

    assertEquals(200, call("carol", "/api/roadmaps/" + slug, null).getStatus());
    assertEquals(404, call("bob", "/api/roadmaps/" + slug, null).getStatus());
  }

  @Test
  void refusalsFollowTheUsualOrder() throws Exception {
    assertEquals(
        404, call("bob", "/api/roadmaps", body("beta", "Europe/Zurich", "2026-11-02")).getStatus());
    assertEquals(
        403,
        call("bob", "/api/roadmaps", body("alpha", "Europe/Zurich", "2026-11-02")).getStatus());
    assertEquals(
        422, call("dave", "/api/roadmaps", body("beta", "Nowhere/Land", "2026-11-02")).getStatus());
    assertEquals(
        422, call("dave", "/api/roadmaps", body("beta", "Europe/Zurich", "soon")).getStatus());
    assertEquals(
        422,
        call(
                "dave",
                "/api/roadmaps",
                "{\"name\":\"  \",\"team\":\"beta\",\"timeZone\":\"UTC\",\"start\":\"2026-11-02\"}")
            .getStatus());
    assertEquals(
        201, call("carol", "/api/roadmaps", body("beta", "UTC", "2026-11-02")).getStatus());
    assertEquals(409, call("dave", "/api/roadmaps", body("beta", "UTC", "2026-11-02")).getStatus());
  }
}
