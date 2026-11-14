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

  /** The owning team and the version of a roadmap, read together and fresh (005, research R6). */
  public record Head(java.util.UUID id, String team, int version) {}

  /** The team that owns the roadmap and its version; empty when there is none. */
  public Optional<Head> findHead(String slug) {
    return jdbc.sql("SELECT id, team, version FROM roadmap WHERE slug = :slug")
        .param("slug", slug)
        .query(Head.class)
        .optional();
  }

  /** Locks the roadmap row until the transaction ends, and returns its document (approval). */
  public Optional<String> lockDocument(java.util.UUID id) {
    return jdbc.sql("SELECT document::text FROM roadmap WHERE id = :id FOR UPDATE")
        .param("id", id)
        .query(String.class)
        .optional();
  }

  /**
   * Stores a new document, raises the version and records it as a version in the same transaction
   * (006, FR-001). Every writer of a roadmap goes through here, so none can skip the history. The
   * caller holds the row lock ({@link #lockDocument}), so numbers come out in order with no gaps.
   * Returns the new version number.
   */
  public int replaceDocument(
      java.util.UUID id,
      String document,
      String byUser,
      String byName,
      java.util.UUID proposal,
      String note) {
    int version =
        jdbc.sql(
                "UPDATE roadmap SET document = CAST(:d AS jsonb), version = version + 1"
                    + " WHERE id = :id RETURNING version")
            .param("d", document)
            .param("id", id)
            .query(Integer.class)
            .single();
    jdbc.sql(
            "INSERT INTO roadmap_version (roadmap_id, version, document, by_name, by_user,"
                + " proposal_id, note) VALUES (:id, :v, CAST(:d AS jsonb), :bn, :bu, :p, :n)")
        .param("id", id)
        .param("v", version)
        .param("d", document)
        .param("bn", byName)
        .param("bu", byUser)
        .param("p", proposal)
        .param("n", note)
        .update();
    return version;
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
