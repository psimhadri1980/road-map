package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 002-T003, the service's side of the token rules (FR-008, FR-009, FR-010, FR-011, SC-003): every
 * kind of bad token is refused with 401 and one body, a good one is served, and the user header
 * names nobody. Tokens come from the real Keycloak, the keys are fetched from it over verified TLS,
 * and the database and cache are the real ones, so what passes here is what the running service
 * does.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class TokenIT {

  private static final String SAMPLE = "/api/roadmaps/sample";

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  @Autowired MockMvc mvc;

  private ResultActions call(String authorization) throws Exception {
    var request = get(SAMPLE);
    if (authorization != null) {
      request = request.header("Authorization", authorization);
    }
    return mvc.perform(request);
  }

  /** The one refusal: 401, a Bearer challenge, and a body that does not say which check failed. */
  private static void refused(ResultActions result) throws Exception {
    result
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("WWW-Authenticate", "Bearer"))
        .andExpect(jsonPath("$.code").value("unauthenticated"))
        .andExpect(jsonPath("$.error").value("Sign in to continue."));
  }

  @Test
  void aValidTokenIsServed() throws Exception {
    call(Services.bearer()).andExpect(status().isOk());
  }

  @Test
  void noTokenIsRefused() throws Exception {
    refused(call(null));
  }

  @Test
  void theUserHeaderAloneNamesNobody() throws Exception {
    refused(mvc.perform(get(SAMPLE).header("x-gantt-user", "someone-else")));
  }

  @Test
  void aValidTokenIgnoresTheUserHeader() throws Exception {
    mvc.perform(get(SAMPLE).header("Authorization", Services.bearer()).header("x-gantt-user", "x"))
        .andExpect(status().isOk());
  }

  @Test
  void aTamperedSignatureIsRefused() throws Exception {
    String token = Services.token("road-map-test");
    int middle =
        token.lastIndexOf('.') + 20; // inside the signature, clear of its last (padding) character
    char changed = token.charAt(middle) == 'A' ? 'B' : 'A';
    refused(call("Bearer " + token.substring(0, middle) + changed + token.substring(middle + 1)));
  }

  @Test
  void aTokenForAnotherAudienceIsRefused() throws Exception {
    refused(call("Bearer " + Services.token("road-map-test-other-audience")));
  }

  @Test
  void aTokenTheRealmDidNotIssueIsRefused() throws Exception {
    // header.payload.signature of a made-up token: the key id is unknown to Keycloak, so it cannot
    // verify.
    String made =
        java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                    "{\"alg\":\"RS256\",\"kid\":\"x\"}"
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            + "."
            + java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                    "{\"iss\":\"https://evil.example/realms/road-map\",\"aud\":\"road-map-api\",\"sub\":\"x\",\"exp\":9999999999}"
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            + ".c2lnbmF0dXJl";
    refused(call("Bearer " + made));
  }

  @Test
  void anExpiredTokenIsRefused() throws Exception {
    String token =
        Services.token("road-map-test"); // lives 5 s; the service allows 5 s of clock skew
    Thread.sleep(11_000);
    refused(call("Bearer " + token));
  }

  @Test
  void aMalformedHeaderIsRefusedWithoutEchoingIt(CapturedOutput output) throws Exception {
    String junk = "x".repeat(4000);
    var body = call("Bearer " + junk).andReturn().getResponse().getContentAsString();
    assertFalse(body.contains("xxxx"));
    assertFalse(output.getAll().contains("xxxxxxxxxxxxxxxx"));
  }

  @Test
  void healthStaysOpenWithoutAToken() throws Exception {
    mvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
  }

  @Test
  void noTokenReachesTheLog(CapturedOutput output) throws Exception {
    String token = Services.token("road-map-test");
    call("Bearer " + token + "tampered");
    call(null);
    assertFalse(output.getAll().contains(token.substring(token.lastIndexOf('.') + 1)));
  }
}
