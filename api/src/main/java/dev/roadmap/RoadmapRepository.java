package dev.roadmap;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Data access for roadmaps (T017, 003-T002): reads only. The service's database account can only
 * read.
 */
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

  /** The team that owns the roadmap with this slug; empty when there is none. */
  public Optional<String> findTeam(String slug) {
    return jdbc.sql("SELECT team FROM roadmap WHERE slug = :slug")
        .param("slug", slug)
        .query(String.class)
        .optional();
  }

  /** A roadmap as listed, before the caller's role is attached. */
  public record Row(String slug, String name, String team) {}

  /**
   * The roadmaps owned by any of these teams, by name. The name is read from the stored document,
   * so a rename there shows here with no second copy to keep in step. The caller guarantees {@code
   * teams} is not empty ({@code IN ()} is not valid SQL).
   */
  public List<Row> findByTeams(Collection<String> teams) {
    return jdbc.sql(
            "SELECT slug, document->'roadmap'->>'name' AS name, team FROM roadmap"
                + " WHERE team IN (:teams) ORDER BY name, slug")
        .param("teams", teams)
        .query(Row.class)
        .list();
  }
}
