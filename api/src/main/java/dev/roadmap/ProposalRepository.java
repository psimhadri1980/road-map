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
      OffsetDateTime updatedAt,
      String note,
      String noteBy,
      String decidedBy,
      OffsetDateTime decidedAt) {

    ProposalSummary summary() {
      return new ProposalSummary(
          id,
          name,
          state,
          ownerName,
          createdAt,
          updatedAt,
          changeCount,
          note,
          noteBy,
          decidedBy,
          decidedAt);
    }
  }

  /** A stored change, with {@code fields} as JSON text. */
  public record Stored(String entity, String op, String id, String fields) {}

  private static final String COLUMNS =
      "id, name, state, owner, owner_name, change_count, created_at, updated_at, note, note_by,"
          + " decided_by, decided_at";

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
            "SELECT count(*) FROM proposal WHERE roadmap_id = :r AND owner = :o AND state IN ('draft', 'submitted')")
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

  /**
   * Like {@link #find} but locks the row until the transaction ends, so two requests adding changes
   * to one Proposal take turns and each sees the other's changes (research R8).
   */
  public Optional<Row> findForUpdate(UUID roadmap, UUID id) {
    return jdbc.sql(
            "SELECT " + COLUMNS + " FROM proposal WHERE id = :i AND roadmap_id = :r FOR UPDATE")
        .param("i", id)
        .param("r", roadmap)
        .query(Row.class)
        .optional();
  }

  /** Records the new total of changes and the time of the edit. */
  public void setChangeCount(UUID proposal, int count) {
    jdbc.sql("UPDATE proposal SET change_count = :c, updated_at = now() WHERE id = :p")
        .param("c", count)
        .param("p", proposal)
        .update();
  }

  /**
   * Moves a Proposal to {@code to} and records the move (005, FR-008). A new note replaces the old
   * one only when the action carries one.
   */
  public void move(
      UUID proposal, String action, String from, String to, String by, String byName, String note) {
    int seq =
        jdbc.sql("SELECT coalesce(max(seq), 0) + 1 FROM proposal_move WHERE proposal_id = :p")
            .param("p", proposal)
            .query(Integer.class)
            .single();
    jdbc.sql(
            "INSERT INTO proposal_move (proposal_id, seq, action, from_state, to_state, by_user, note)"
                + " VALUES (:p, :s, :a, :f, :t, :b, :n)")
        .param("p", proposal)
        .param("s", seq)
        .param("a", action)
        .param("f", from)
        .param("t", to)
        .param("b", by)
        .param("n", note)
        .update();
    jdbc.sql(
            "UPDATE proposal SET state = :t, updated_at = now(),"
                + " note = CASE WHEN CAST(:n AS text) IS NULL THEN note ELSE :n END,"
                + " note_by = CASE WHEN CAST(:n AS text) IS NULL THEN note_by ELSE :nb END"
                + " WHERE id = :p")
        .param("t", to)
        .param("n", note)
        .param("nb", byName)
        .param("p", proposal)
        .update();
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
