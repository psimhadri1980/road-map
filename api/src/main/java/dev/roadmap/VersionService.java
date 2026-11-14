package dev.roadmap;

import java.util.List;
import org.springframework.stereotype.Service;

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

  /** The roadmap's versions, newest first. */
  public List<VersionSummary> list(String slug, Teams teams) {
    return versions.list(visible(slug, teams).id());
  }

  /** The roadmap as it was in version {@code v}, as JSON text. */
  public String document(String slug, String v, Teams teams) {
    var head = visible(slug, teams);
    int number;
    try {
      number = Integer.parseInt(v);
    } catch (NumberFormatException e) {
      throw new ApiErrors.NotFound(slug);
    }
    return versions.document(head.id(), number).orElseThrow(() -> new ApiErrors.NotFound(slug));
  }
}
