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

  /** The caller as a stored actor: the token's subject and the name to show for it. */
  static ProposalService.Actor actor(Jwt token) {
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

  /** More changes for the caller's own Proposal. */
  @PostMapping(path = BASE + "/{id}/changes", produces = MediaType.APPLICATION_JSON_VALUE)
  public ProposalSummary addChanges(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String id,
      @RequestBody ProposalService.NewChanges body,
      @AuthenticationPrincipal Jwt token) {
    return service.addChanges(slug, id, teams(token), actor(token), body.changes());
  }

  /** The body of return and reject; the other actions take none. */
  public record Note(String note) {}

  /** A lifecycle action: submit, withdraw, discard, return, reject (approve follows in T003). */
  @PostMapping(path = BASE + "/{id}/{action}", produces = MediaType.APPLICATION_JSON_VALUE)
  public ProposalSummary act(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String id,
      @PathVariable String action,
      @RequestBody(required = false) Note body,
      @AuthenticationPrincipal Jwt token) {
    return service.act(
        slug, id, action, teams(token), actor(token), body == null ? null : body.note());
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

  /** The changes of this Proposal that collide with what changed since it was made. */
  @GetMapping(path = BASE + "/{id}/conflicts", produces = MediaType.APPLICATION_JSON_VALUE)
  public List<Conflict> conflicts(
      @PathVariable @Pattern(regexp = SLUG) String slug,
      @PathVariable String id,
      @AuthenticationPrincipal Jwt token) {
    return service.conflicts(slug, id, teams(token));
  }
}
