package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.List;
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
 * 008-T002 (FR-003, FR-005, FR-006): every write that changes what members see sends one event
 * after it commits, with ids and names only; a refused action sends none. dave edits beta, carol
 * reviews beta and watches the stream.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LivePublishIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String RENAME =
      "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t2\",\"fields\":{\"name\":\"Renamed\"}}";

  @Autowired MockMvc mvc;
  private String slug;
  private MockHttpServletResponse stream;

  @BeforeEach
  void fixture() throws Exception {
    slug = Services.insert(Services.sample(), "beta");
    Services.addFirstVersion(slug);
    stream =
        mvc.perform(
                get("/api/roadmaps/" + slug + "/events")
                    .header("Accept", "text/event-stream, application/json")
                    .header("Authorization", Services.bearer("carol")))
            .andReturn()
            .getResponse();
    assertEquals(200, stream.getStatus());
  }

  @AfterEach
  void clean() throws Exception {
    Services.clearProposals(slug);
    Services.clearVersions(slug);
    Services.delete(slug);
  }

  private MockHttpServletResponse send(String path, String user, String body) throws Exception {
    var req = post("/api/roadmaps/" + slug + path).header("Authorization", Services.bearer(user));
    if (body != null) {
      req.contentType("application/json").content(body);
    }
    return mvc.perform(req).andReturn().getResponse();
  }

  private List<String> kinds() throws Exception {
    var out = new ArrayList<String>();
    for (String line : stream.getContentAsString().lines().toList()) {
      if (line.startsWith("data:")) {
        out.add(JSON.readTree(line.substring(5)).get("kind").asString());
      }
    }
    return out;
  }

  private String draft() throws Exception {
    var r = send("/proposals", "dave", "{\"name\":\"P\",\"changes\":[" + RENAME + "]}");
    JsonNode made = JSON.readTree(r.getContentAsString());
    return made.get("id").asString();
  }

  @Test
  void eachWriteSendsOneEventAfterItsCommit() throws Exception {
    String id = draft();
    send("/proposals/" + id + "/changes", "dave", "{\"changes\":[" + RENAME + "]}");
    send("/proposals/" + id + "/submit", "dave", null);
    send("/proposals/" + id + "/return", "carol", "{\"note\":\"again\"}");
    send("/proposals/" + id + "/submit", "dave", null);
    send("/proposals/" + id + "/withdraw", "dave", null);
    send("/proposals/" + id + "/discard", "dave", null);
    String second = draft();
    send("/proposals/" + second + "/submit", "dave", null);
    send("/proposals/" + second + "/approve", "carol", null);
    String third = draft();
    send("/proposals/" + third + "/submit", "dave", null);
    send("/proposals/" + third + "/reject", "carol", "{\"note\":\"no\"}");
    send("/versions/1/restore", "carol", null);
    send("/baselines", "carol", "{\"name\":\"b1\"}");
    assertEquals(
        List.of(
            "proposalCreated",
            "proposalChanged",
            "proposalSubmitted",
            "proposalReturned",
            "proposalSubmitted",
            "proposalWithdrawn",
            "proposalDiscarded",
            "proposalCreated",
            "proposalSubmitted",
            "proposalApproved",
            "currentChanged",
            "proposalCreated",
            "proposalSubmitted",
            "proposalRejected",
            "currentChanged",
            "baselineSaved"),
        kinds());
    String text = stream.getContentAsString();
    assertFalse(text.contains("\"tasks\""), "events carry no document");
    assertTrue(text.contains("\"actor\":\"dave\""), text);
  }

  @Test
  void aRefusedActionSendsNothing() throws Exception {
    String id = draft();
    assertEquals(409, send("/proposals/" + id + "/approve", "carol", null).getStatus());
    assertEquals(409, send("/proposals/" + id + "/withdraw", "dave", null).getStatus());
    assertEquals(List.of("proposalCreated"), kinds());
  }
}
