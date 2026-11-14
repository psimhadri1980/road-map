package dev.roadmap;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * The cached read of a roadmap's document (T017, FR-006 to FR-008), split out of {@link
 * RoadmapService} in 003-T002 because Spring's cache proxy does not apply to a call within the same
 * class (research R4). {@code @Cacheable} makes Redis the first place looked at, under the key
 * {@code roadmap::<slug>@<version>}: one copy for every user. The version comes from the database
 * on every request, so an approval (005) sends readers to a new key and the old entry is never
 * asked for again; the Redis account cannot delete keys, so entries simply expire (CacheConfig). It
 * knows nothing about who is asking; the caller has already decided that, so the cache never
 * decides access. A document only enters the cache after it passed the schema check, and a refused
 * document throws, which is never cached.
 */
@Service
public class RoadmapDocumentService {

  private final RoadmapRepository repository;

  RoadmapDocumentService(RoadmapRepository repository) {
    this.repository = repository;
  }

  /** The roadmap document as JSON text, as of {@code version}. */
  @Cacheable(value = "roadmap", key = "#slug + '@' + #version")
  public String document(String slug, int version) {
    String document = repository.findDocument(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!RoadmapSchema.validate(document).isEmpty()) {
      throw new ApiErrors.NonConforming(slug);
    }
    return document;
  }
}
