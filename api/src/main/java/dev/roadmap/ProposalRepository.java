package dev.roadmap;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Data access for Proposals and their changes (004-T002): SQL only, no rules. Everything here runs
 * as the service's database account, which may insert and update these two tables and read them,
 * never touch {@code roadmap}.
 */
@Repository
public class ProposalRepository {

  /** The owning roadmap's id and team; the team is what access is decided on. */
  public record RoadmapRef(UUID id, String team) {}

  /** A stored Proposal with the creator's subject, which the API never shows. */
  public record Row(
      UUID id,
      String name,
      String state,
      String owner,
      String ownerName,
      int changeCount,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {

    ProposalSummary summary() {
      return new ProposalSummary(id, name, state, ownerName, createdAt, updatedAt, changeCount);
    }
  }

  /** A stored change, with {@code fields} as JSON text. */
  public record Stored(String entity, String op, String id, String fields) {}

  private static final String COLUMNS =
      "id, name, state, owner, owner_name, change_count, created_at, updated_at";

  private final JdbcClient jdbc;

  ProposalRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** The roadmap with this slug, read fresh from the database. */
  public Optional<RoadmapRef> findRoadmap(String slug) {
    return jdbc.sql("SELECT id, team FROM roadmap WHERE slug = :slug")
        .param("slug", slug)
        .query(RoadmapRef.class)
        .optional();
  }

  /** How many open Proposals this owner has on the roadmap (the limit of FR-012). */
  public int countOpen(UUID roadmap, String owner) {
    return jdbc.sql(
            "SELECT count(*) FROM proposal WHERE roadmap_id = :r AND owner = :o AND state = 'draft'")
        .param("r", roadmap)
        .param("o", owner)
        .query(Integer.class)
        .single();
  }

  /** Stores a new draft Proposal; its changes go in with {@link #addChanges}. */
  public Row insert(UUID roadmap, String name, String owner, String ownerName, int changeCount) {
    return jdbc.sql(
            "INSERT INTO proposal (roadmap_id, name, owner, owner_name, change_count)"
                + " VALUES (:r, :n, :o, :on, :c) RETURNING "
                + COLUMNS)
        .param("r", roadmap)
        .param("n", name)
        .param("o", owner)
        .param("on", ownerName)
        .param("c", changeCount)
        .query(Row.class)
        .single();
  }

  /** Appends changes after the ones already stored, numbering them in order. */
  public void addChanges(UUID proposal, int firstSeq, List<Stored> changes, String by) {
    int seq = firstSeq;
    for (Stored c : changes) {
      jdbc.sql(
              "INSERT INTO proposal_change (proposal_id, seq, entity, op, entity_id, fields, by_user)"
                  + " VALUES (:p, :s, :e, :op, :i, CAST(:f AS jsonb), :b)")
          .param("p", proposal)
          .param("s", seq++)
          .param("e", c.entity())
          .param("op", c.op())
          .param("i", c.id())
          .param("f", c.fields())
          .param("b", by)
          .update();
    }
  }

  /** The roadmap's Proposals, newest first. */
  public List<Row> list(UUID roadmap) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + " FROM proposal WHERE roadmap_id = :r ORDER BY created_at DESC, id")
        .param("r", roadmap)
        .query(Row.class)
        .list();
  }

  /** The Proposal with this id on this roadmap; a Proposal of another roadmap is not found. */
  public Optional<Row> find(UUID roadmap, UUID id) {
    return jdbc.sql("SELECT " + COLUMNS + " FROM proposal WHERE id = :i AND roadmap_id = :r")
        .param("i", id)
        .param("r", roadmap)
        .query(Row.class)
        .optional();
  }

  /** The Proposal's changes in the order they were made. */
  public List<Stored> changes(UUID proposal) {
    return jdbc.sql(
            "SELECT entity, op, entity_id AS id, fields::text AS fields"
                + " FROM proposal_change WHERE proposal_id = :p ORDER BY seq")
        .param("p", proposal)
        .query(Stored.class)
        .list();
  }
}
