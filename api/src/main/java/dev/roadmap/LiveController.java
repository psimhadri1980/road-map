package dev.roadmap;

import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** The live event stream of one roadmap (008-T001); HTTP only. */
@RestController
@Validated
public class LiveController {

  private final LiveService service;

  LiveController(LiveService service) {
    this.service = service;
  }

  /**
   * Server-sent events until the token expires. The mapping declares no {@code produces}, so a
   * refusal can still be the usual JSON error; the emitter sets the stream's own content type.
   */
  @GetMapping("/api/roadmaps/{slug}/events")
  public SseEmitter events(
      @PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{0,62}$") String slug,
      @AuthenticationPrincipal Jwt token) {
    var teams = Teams.of(token.getClaimAsStringList("groups"));
    var life = Duration.between(Instant.now(), token.getExpiresAt());
    return service.open(slug, teams, token.getSubject(), life);
  }
}
