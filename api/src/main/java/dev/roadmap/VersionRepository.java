package dev.roadmap;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Data access for versions (006): reads only; versions are written by {@link RoadmapRepository}.
 */
@Repository
public class VersionRepository {

  private final JdbcClient jdbc;

  VersionRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** The roadmap's versions, newest first. */
  public List<VersionSummary> list(UUID roadmap) {
    return jdbc.sql(
            "SELECT version, at, by_name AS by, proposal_id, note FROM roadmap_version"
                + " WHERE roadmap_id = :r ORDER BY version DESC")
        .param("r", roadmap)
        .query(VersionSummary.class)
        .list();
  }

  /** One version's summary; empty when there is no such version. */
  public Optional<VersionSummary> find(UUID roadmap, int version) {
    return jdbc.sql(
            "SELECT version, at, by_name AS by, proposal_id, note FROM roadmap_version"
                + " WHERE roadmap_id = :r AND version = :v")
        .param("r", roadmap)
        .param("v", version)
        .query(VersionSummary.class)
        .optional();
  }

  /** The document of one version as JSON text; empty when there is no such version. */
  public Optional<String> document(UUID roadmap, int version) {
    return jdbc.sql(
            "SELECT document::text FROM roadmap_version WHERE roadmap_id = :r AND version = :v")
        .param("r", roadmap)
        .param("v", version)
        .query(String.class)
        .optional();
  }
}
