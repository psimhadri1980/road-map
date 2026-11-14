package dev.roadmap;

import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP for roadmaps (T017): nothing but the request and the response; the rules are in the service.
 */
@RestController
@Validated
public class RoadmapController {

  private final RoadmapService service;

  RoadmapController(RoadmapService service) {
    this.service = service;
  }

  /** The roadmaps the signed-in user's teams own, with the user's role in each. */
  @GetMapping(path = "/api/roadmaps", produces = MediaType.APPLICATION_JSON_VALUE)
  public List<RoadmapSummary> list(@AuthenticationPrincipal Jwt token) {
    return service.list(Teams.of(token.getClaimAsStringList("groups")));
  }

  /** The roadmap in the gantt-roadmap/1 format; the document is passed through as stored. */
  @GetMapping(path = "/api/roadmaps/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
  public String get(
      @PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{0,62}$") String slug,
      @AuthenticationPrincipal Jwt token) {
    return service.document(slug, Teams.of(token.getClaimAsStringList("groups")));
  }
}
