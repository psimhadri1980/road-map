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

  /** The roadmap's baselines, newest first. */
  public List<Baseline> baselines(UUID roadmap) {
    return jdbc.sql(
            "SELECT name, version, at, by_name AS by FROM baseline"
                + " WHERE roadmap_id = :r ORDER BY at DESC, name")
        .param("r", roadmap)
        .query(Baseline.class)
        .list();
  }

  /** Whether the roadmap already has a baseline of this name. */
  public boolean hasBaseline(UUID roadmap, String name) {
    return jdbc.sql("SELECT count(*) FROM baseline WHERE roadmap_id = :r AND name = :n")
            .param("r", roadmap)
            .param("n", name)
            .query(Integer.class)
            .single()
        > 0;
  }

  /** Records a baseline; the caller has checked the name is free and the version exists. */
  public void addBaseline(UUID roadmap, String name, int version, String byUser, String byName) {
    jdbc.sql(
            "INSERT INTO baseline (roadmap_id, name, version, by_user, by_name)"
                + " VALUES (:r, :n, :v, :u, :b)")
        .param("r", roadmap)
        .param("n", name)
        .param("v", version)
        .param("u", byUser)
        .param("b", byName)
        .update();
  }
}
