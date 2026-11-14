package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 003-T003 (FR-004, SC-002): the list each development user gets, from real tokens. Names are "Beta
 * roadmap" (beta-plan) and "Platform migration" (sample), so name order puts beta first.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ListIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  @Autowired MockMvc mvc;

  private String list(String user) throws Exception {
    var r = mvc.perform(get("/api/roadmaps").header("Authorization", Services.bearer(user)));
    var out = r.andReturn().getResponse();
    assertEquals(200, out.getStatus());
    return out.getContentAsString();
  }

  private static final String SAMPLE_ALPHA =
      "{\"slug\":\"sample\",\"name\":\"Platform migration\",\"team\":\"alpha\",\"role\":\"%s\"}";
  private static final String BETA =
      "{\"slug\":\"beta-plan\",\"name\":\"Beta roadmap\",\"team\":\"beta\",\"role\":\"%s\"}";

  @Test
  void oneTeamSeesOnlyItsRoadmapWithItsRole() throws Exception {
    assertEquals("[" + SAMPLE_ALPHA.formatted("viewer") + "]", list("bob"));
    assertEquals("[" + BETA.formatted("reviewer") + "]", list("carol"));
  }

  @Test
  void twoTeamsSeeBothOrderedByNameWithTheRoleOfEach() throws Exception {
    assertEquals(
        "[" + BETA.formatted("editor") + "," + SAMPLE_ALPHA.formatted("viewer") + "]",
        list("dave"));
  }

  @Test
  void noTeamSeesNothing() throws Exception {
    assertEquals("[]", list("erin"));
  }

  @Test
  void aTokenIsRequired() throws Exception {
    assertEquals(401, mvc.perform(get("/api/roadmaps")).andReturn().getResponse().getStatus());
  }
}
