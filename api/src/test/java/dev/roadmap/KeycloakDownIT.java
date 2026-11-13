package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 002-T003, FR-010 (fail closed): when the service cannot reach Keycloak's signing keys it refuses
 * requests, even one that carries a perfectly good token. Never "accepted because the check could
 * not run".
 */
@SpringBootTest
@AutoConfigureMockMvc
class KeycloakDownIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
    registry.add(
        "spring.security.oauth2.resourceserver.jwt.jwk-set-uri",
        () -> Services.keys(Services.DOWN));
  }

  @Autowired MockMvc mvc;

  @Test
  void aGoodTokenIsRefusedWhenTheKeysCannotBeFetched() throws Exception {
    // Spring rethrows a key-fetch failure (it is not the caller's fault, so not a 401): the servlet
    // container answers it with a 5xx. What matters here is that it is never served.
    assertThrows(
        Exception.class,
        () -> mvc.perform(get("/api/roadmaps/sample").header("Authorization", Services.bearer())));
  }
}
