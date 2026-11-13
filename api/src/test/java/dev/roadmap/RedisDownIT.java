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
import tools.jackson.databind.ObjectMapper;

/** T018 (FR-008): Redis down: the roadmap comes from the database. */
@SpringBootTest
@AutoConfigureMockMvc
class RedisDownIT {
  private static final ObjectMapper JSON = new ObjectMapper();

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.DOWN);
  }

  @Autowired MockMvc mvc;

  @Test
  void theRoadmapIsServedFromTheDatabase() throws Exception {
    var body =
        mvc.perform(get("/api/roadmaps/sample"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertEquals(JSON.readTree(Services.sample()), JSON.readTree(body));
  }
}
