package dev.roadmap;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The rules of reading versions (006, FR-003, FR-007). As everywhere, whether the caller may know
 * the roadmap exists is decided first, from the owning team read fresh from the database: a
 * non-member gets the same {@link ApiErrors.NotFound} as for an absent roadmap, and so does an
 * absent or malformed version number.
 */
@Service
public class VersionService {

  private final RoadmapRepository roadmaps;
  private final VersionRepository versions;

  VersionService(RoadmapRepository roadmaps, VersionRepository versions) {
    this.roadmaps = roadmaps;
    this.versions = versions;
  }

  private RoadmapRepository.Head visible(String slug, Teams teams) {
    var head = roadmaps.findHead(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!teams.has(head.team())) {
      throw new ApiErrors.NotFound(slug);
    }
    return head;
  }

  /**
   * Makes the roadmap equal to version {@code v}, as a new version (006, FR-004, research R5).
   * Reviewers only. History is never rewritten: the old versions stay, and the restore is one more.
   */
  @Transactional
  public VersionSummary restore(String slug, String v, Teams teams, ProposalService.Actor actor) {
    var head = visible(slug, teams);
    if (!"reviewer".equals(teams.role(head.team()))) {
      throw new ApiErrors.Denied();
    }
    int number = number(slug, v);
    String document =
        versions.document(head.id(), number).orElseThrow(() -> new ApiErrors.NotFound(slug));
    roadmaps.lockDocument(head.id()); // numbers are given out under this lock
    int created =
        roadmaps.replaceDocument(
            head.id(), document, actor.subject(), actor.name(), null, "restore of " + number);
    return versions.find(head.id(), created).orElseThrow();
  }

  private static int number(String slug, String v) {
    try {
      return Integer.parseInt(v);
    } catch (NumberFormatException e) {
      throw new ApiErrors.NotFound(slug);
    }
  }

  /** The roadmap's versions, newest first. */
  public List<VersionSummary> list(String slug, Teams teams) {
    return versions.list(visible(slug, teams).id());
  }

  /** The roadmap as it was in version {@code v}, as JSON text. */
  public String document(String slug, String v, Teams teams) {
    var head = visible(slug, teams);
    return versions
        .document(head.id(), number(slug, v))
        .orElseThrow(() -> new ApiErrors.NotFound(slug));
  }
}
