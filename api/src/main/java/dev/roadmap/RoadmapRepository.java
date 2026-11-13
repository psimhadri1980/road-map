package dev.roadmap;

import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Data access for roadmaps (T017): one query. The service's database account can only read. */
@Repository
public class RoadmapRepository {

  private final JdbcClient jdbc;

  RoadmapRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** The stored document of the roadmap with this slug, as JSON text; empty when there is none. */
  public Optional<String> findDocument(String slug) {
    return jdbc.sql("SELECT document::text FROM roadmap WHERE slug = :slug")
        .param("slug", slug)
        .query(String.class)
        .optional();
  }
}
