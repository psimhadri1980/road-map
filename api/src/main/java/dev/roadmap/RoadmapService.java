package dev.roadmap;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * The read path (T017, FR-006 to FR-008). {@code @Cacheable} makes Redis the first place looked at,
 * under the key {@code roadmap::<slug>} (cache name, then slug); on a miss the database answers and
 * the result is cached. A document only enters the cache after it passed the schema check, and a
 * refused document throws, which Spring never caches.
 */
@Service
public class RoadmapService {

  private final RoadmapRepository repository;

  RoadmapService(RoadmapRepository repository) {
    this.repository = repository;
  }

  /** The roadmap document as JSON text. */
  @Cacheable("roadmap")
  public String document(String slug) {
    String document = repository.findDocument(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!RoadmapSchema.validate(document).isEmpty()) {
      throw new ApiErrors.NonConforming(slug);
    }
    return document;
  }
}
