package dev.roadmap;

import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** HTTP for versions (006): the request and the response, nothing else. */
@RestController
@Validated
public class VersionController {

  private static final String SLUG = "^[a-z0-9][a-z0-9-]{0,62}$";
  private static final String BASE = "/api/roadmaps/{slug}/versions";

  private final VersionService service;

  VersionController(VersionService service) {
    this.service = service;
  }

  private static Teams teams(Jwt token) {
    return Teams.of(token.getClaimAsStringList("groups"));
  }

  /** The roadmap's versions, newest first. */
  @GetMapping(path = BASE, produces = MediaType.APPLICATION_JSON_VALUE)
  public List<VersionSummary> list(
      @PathVariable @Pattern(regexp = SLUG) String slug, @AuthenticationPrincipal Jwt token) {
    return service.list(slug, teams(token));
  }

  /** Restores an earlier version as a new one. */
  @PostMapping(path = BASE + "/{v}/restore", produces = MediaType.APPLICATION_JSON_VALUE)
  public VersionSummary restore(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String v,
      @AuthenticationPrincipal Jwt token) {
    return service.restore(slug, v, teams(token), ProposalController.actor(token));
  }

  /** The roadmap as it was in one version. */
  @GetMapping(path = BASE + "/{v}", produces = MediaType.APPLICATION_JSON_VALUE)
  public String document(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String v,
      @AuthenticationPrincipal Jwt token) {
    return service.document(slug, v, teams(token));
  }
}
