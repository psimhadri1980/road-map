package dev.roadmap;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * The rules of the read path (003-T002, FR-005 to FR-007). Whether the caller may see a roadmap is
 * decided here, before any document is loaded and on every request: the owning team is read fresh
 * from the database, never from the cache. A roadmap that does not exist and one the caller's teams
 * do not own raise the same {@link ApiErrors.NotFound}, so a refusal never reveals which roadmaps
 * exist.
 */
@Service
public class RoadmapService {

  private final RoadmapRepository repository;
  private final RoadmapDocumentService documents;

  RoadmapService(RoadmapRepository repository, RoadmapDocumentService documents) {
    this.repository = repository;
    this.documents = documents;
  }

  /** The body of a create (012-T001). */
  public record NewRoadmap(String name, String team, String timeZone, String start) {}

  /**
   * Creates an empty roadmap for a team the caller edits or reviews (012-T001). Order of checks as
   * everywhere: membership (404), role (403), clash (409), input (422).
   */
  @org.springframework.transaction.annotation.Transactional
  public RoadmapSummary create(NewRoadmap in, Teams teams, ProposalService.Actor actor) {
    if (in == null || in.team() == null || !teams.has(in.team())) {
      throw new ApiErrors.NotFound("team");
    }
    String role = teams.role(in.team());
    if (!role.equals("editor") && !role.equals("reviewer")) {
      throw new ApiErrors.Denied();
    }
    String name = in.name() == null ? "" : in.name().strip();
    if (name.isEmpty() || name.length() > 200) {
      throw new ApiErrors.Invalid("The name must be 1 to 200 characters.");
    }
    if (in.timeZone() == null || !java.time.ZoneId.getAvailableZoneIds().contains(in.timeZone())) {
      throw new ApiErrors.Invalid(
          "The time zone must be an IANA zone name, such as Europe/Zurich.");
    }
    try {
      java.time.LocalDate.parse(in.start());
    } catch (RuntimeException e) {
      throw new ApiErrors.Invalid("The start must be a date, such as 2026-11-02.");
    }
    String slug =
        name.toLowerCase(java.util.Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
    slug = slug.substring(0, Math.min(63, slug.length())).replaceAll("-$", "");
    if (slug.isEmpty()) {
      throw new ApiErrors.Invalid("The name needs at least one letter or digit.");
    }
    String document =
        new tools.jackson.databind.ObjectMapper()
            .writeValueAsString(
                java.util.Map.of(
                    "contract", "gantt-roadmap/1",
                    "roadmap",
                        java.util.Map.of(
                            "id",
                            slug,
                            "name",
                            name,
                            "version",
                            1,
                            "timeZone",
                            in.timeZone(),
                            "start",
                            in.start()),
                    "tasks", java.util.List.of(),
                    "links", java.util.List.of()));
    if (!RoadmapSchema.validate(document).isEmpty()) {
      throw new ApiErrors.Invalid("The roadmap is not valid.");
    }
    if (!repository.create(slug, name, in.team(), document, actor.subject(), actor.name())) {
      throw new ApiErrors.Conflict("A roadmap with the address " + slug + " already exists.");
    }
    return new RoadmapSummary(slug, name, in.team(), role);
  }

  /** The roadmap document as JSON text, for a caller who holds a role in its owning team. */
  public String document(String slug, Teams teams) {
    var head = repository.findHead(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!teams.has(head.team())) {
      throw new ApiErrors.NotFound(slug);
    }
    return documents.document(slug, head.version());
  }

  /**
   * The roadmaps the caller may open, each with the caller's role in its team (003-T003, FR-004).
   * shortcut: no pagination, because a team owns a handful of roadmaps; add a page size when one
   * team's list stops fitting a picker.
   */
  public List<RoadmapSummary> list(Teams teams) {
    if (teams.names().isEmpty()) {
      return List.of();
    }
    return repository.findByTeams(teams.names()).stream()
        .map(r -> new RoadmapSummary(r.slug(), r.name(), r.team(), teams.role(r.team())))
        .toList();
  }
}
