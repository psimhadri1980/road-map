package dev.roadmap;

import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP for Proposals (004-T002): the request and the response, nothing else. The caller and their
 * teams are taken from the verified token; no header names anyone (FR-008).
 */
@RestController
@Validated
public class ProposalController {

  private static final String SLUG = "^[a-z0-9][a-z0-9-]{0,62}$";
  private static final String BASE = "/api/roadmaps/{slug}/proposals";

  private final ProposalService service;

  ProposalController(ProposalService service) {
    this.service = service;
  }

  private static Teams teams(Jwt token) {
    return Teams.of(token.getClaimAsStringList("groups"));
  }

  private static ProposalService.Actor actor(Jwt token) {
    String subject = token.getSubject();
    String name = token.getClaimAsString("preferred_username");
    String shown = name == null || name.isBlank() ? subject : name;
    return new ProposalService.Actor(subject, shown.substring(0, Math.min(128, shown.length())));
  }

  /** A new draft Proposal, optionally with its first changes. */
  @PostMapping(path = BASE, produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public ProposalSummary create(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @RequestBody ProposalService.NewProposal body,
      @AuthenticationPrincipal Jwt token) {
    return service.create(slug, teams(token), actor(token), body);
  }

  /** The roadmap's Proposals, newest first. */
  @GetMapping(path = BASE, produces = MediaType.APPLICATION_JSON_VALUE)
  public List<ProposalSummary> list(
      @PathVariable @Pattern(regexp = SLUG) String slug, @AuthenticationPrincipal Jwt token) {
    return service.list(slug, teams(token));
  }

  /** One Proposal. */
  @GetMapping(path = BASE + "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
  public ProposalSummary get(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String id,
      @AuthenticationPrincipal Jwt token) {
    return service.get(slug, id, teams(token));
  }

  /** The roadmap as it would be with this Proposal's changes. */
  @GetMapping(path = BASE + "/{id}/document", produces = MediaType.APPLICATION_JSON_VALUE)
  public String document(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String id,
      @AuthenticationPrincipal Jwt token) {
    return service.document(slug, id, teams(token));
  }
}
