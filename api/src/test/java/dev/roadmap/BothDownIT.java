package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** T018 (FR-008): Both down: 503 with a plain message and nothing internal. */
@SpringBootTest
@AutoConfigureMockMvc
class BothDownIT {
  private static final ObjectMapper JSON = new ObjectMapper();

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.DOWN, Services.DOWN);
  }

  @Autowired MockMvc mvc;

  @Test
  void theAnswerIsAPlainUnavailable() throws Exception {
    var body =
        mvc.perform(get("/api/roadmaps/sample"))
            .andExpect(status().isServiceUnavailable())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertEquals("unavailable", JSON.readTree(body).path("code").asString());
    for (String internal :
        new String[] {"jdbc", "postgres", "redis", "Exception", "hikari", "127.0.0.1"}) {
      assertFalse(
          body.toLowerCase(Locale.ROOT).contains(internal.toLowerCase(Locale.ROOT)),
          "the error leaks '" + internal + "': " + body);
    }
  }
}
