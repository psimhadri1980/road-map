package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 003-T002 (FR-002, FR-003, FR-005, FR-006; SC-001, SC-003): who may open which roadmap, with real
 * tokens of the development users (alpha owns {@code sample}, beta owns {@code beta-plan}). The
 * refusal for a forbidden roadmap must be byte-for-byte the answer for one that does not exist.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AccessIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  @Autowired MockMvc mvc;

  private int code(String path, String user) throws Exception {
    return mvc.perform(get(path).header("Authorization", Services.bearer(user)))
        .andReturn()
        .getResponse()
        .getStatus();
  }

  private String answer(String path, String user) throws Exception {
    var r = mvc.perform(get(path).header("Authorization", Services.bearer(user))).andReturn();
    return r.getResponse().getStatus() + " " + r.getResponse().getContentAsString();
  }

  @Test
  void everyRoleMayViewItsTeamsRoadmap() throws Exception {
    // viewer, editor, reviewer of their own team's roadmap
    assertEquals(200, code("/api/roadmaps/sample", "bob")); // alpha viewer
    assertEquals(200, code("/api/roadmaps/sample", "alice")); // alpha editor
    assertEquals(200, code("/api/roadmaps/beta-plan", "carol")); // beta reviewer
  }

  @Test
  void aUserInBothTeamsSeesBothRoadmaps() throws Exception {
    assertEquals(200, code("/api/roadmaps/sample", "dave"));
    assertEquals(200, code("/api/roadmaps/beta-plan", "dave"));
  }

  @Test
  void anotherTeamsRoadmapIsRefusedExactlyLikeAnUnknownOne() throws Exception {
    String unknown = answer("/api/roadmaps/no-such-roadmap", "carol");
    assertEquals(404, code("/api/roadmaps/sample", "carol"));
    assertEquals(unknown, answer("/api/roadmaps/sample", "carol"));
    assertEquals(unknown, answer("/api/roadmaps/beta-plan", "bob"));
  }

  @Test
  void aUserInNoTeamIsRefusedEverything() throws Exception {
    String unknown = answer("/api/roadmaps/no-such-roadmap", "erin");
    assertEquals(unknown, answer("/api/roadmaps/sample", "erin"));
    assertEquals(unknown, answer("/api/roadmaps/beta-plan", "erin"));
  }

  @Test
  void aTeamHeaderOrParameterChangesNothing() throws Exception {
    mvc.perform(
            get("/api/roadmaps/sample")
                .header("Authorization", Services.bearer("carol"))
                .header("x-gantt-user", "alice")
                .header("x-team", "alpha")
                .header("x-groups", "/alpha/editor")
                .param("team", "alpha")
                .param("groups", "/alpha/editor"))
        .andExpect(status().isNotFound());
  }

  @Test
  void aRoadmapOfATeamNobodyIsInIsRefused() throws Exception {
    String slug = Services.insert(Services.sample(), "gamma");
    try {
      assertEquals(404, code("/api/roadmaps/" + slug, "dave"));
    } finally {
      Services.delete(slug);
    }
  }

  @Test
  void aBadSlugIsStillInvalidWhateverTheTeams() throws Exception {
    assertEquals(400, code("/api/roadmaps/Not_A_Slug", "erin"));
  }
}
