package dev.roadmap;

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

  /** The roadmap document as JSON text, for a caller who holds a role in its owning team. */
  public String document(String slug, Teams teams) {
    String owner = repository.findTeam(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!teams.has(owner)) {
      throw new ApiErrors.NotFound(slug);
    }
    return documents.document(slug);
  }
}
