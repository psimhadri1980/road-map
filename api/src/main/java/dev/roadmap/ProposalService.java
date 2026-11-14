package dev.roadmap;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The rules of Proposals (004-T002; research R3 to R8). Who is asking and what role they hold come
 * from the verified token ({@link Actor}, {@link Teams}) and nothing else. Every method first
 * decides, from the roadmap's owning team read fresh from the database, whether the caller may even
 * know the roadmap exists: if not, the answer is the same {@link ApiErrors.NotFound} as for one
 * that does not exist (spec 003). Only then does it ask whether their role allows the action, and
 * refuses a member with {@link ApiErrors.Denied}, because a member already knows the roadmap is
 * there. Nothing here is cached: a draft read always shows what was stored (FR-011).
 */
@Service
public class ProposalService {

  static final int MAX_NAME = 200;
  static final int MAX_CHANGES_PER_REQUEST = 500;
  static final int MAX_OPEN_PER_OWNER = 50;
  static final int MAX_CHANGES_PER_PROPOSAL = 5000;

  /** The caller: the token's subject and the name to show for them. */
  public record Actor(String subject, String name) {}

  /** The body of a create request. */
  public record NewProposal(String name, List<ProposalChange> changes) {
    /** Copies the list so the record cannot be changed after it is checked. */
    public NewProposal {
      changes = changes == null ? List.of() : List.copyOf(changes);
    }
  }

  /** The body of an add-changes request (contract: an object with a changes array). */
  public record NewChanges(List<ProposalChange> changes) {
    /** Copies the list so the record cannot be changed after it is checked. */
    public NewChanges {
      changes = changes == null ? List.of() : List.copyOf(changes);
    }
  }

  private final ProposalRepository proposals;
  private final RoadmapRepository roadmaps;
  private final ObjectMapper json;

  ProposalService(ProposalRepository proposals, RoadmapRepository roadmaps, ObjectMapper json) {
    this.proposals = proposals;
    this.roadmaps = roadmaps;
    this.json = json;
  }

  /** A new draft owned by the caller, with its first changes applied in memory before any write. */
  @Transactional
  public ProposalSummary create(String slug, Teams teams, Actor actor, NewProposal request) {
    var roadmap = visible(slug, teams);
    if (!"editor".equals(teams.role(roadmap.team()))) {
      throw new ApiErrors.Denied();
    }
    String name = request == null ? null : request.name();
    if (name == null || name.isBlank() || name.length() > MAX_NAME) {
      throw new ApiErrors.Invalid("name must be 1 to " + MAX_NAME + " characters");
    }
    List<ProposalChange> changes = request.changes();
    if (changes.size() > MAX_CHANGES_PER_REQUEST) {
      throw new ApiErrors.Invalid("at most " + MAX_CHANGES_PER_REQUEST + " changes per request");
    }
    if (proposals.countOpen(roadmap.id(), actor.subject()) >= MAX_OPEN_PER_OWNER) {
      throw new ApiErrors.Invalid("at most " + MAX_OPEN_PER_OWNER + " open Proposals per roadmap");
    }
    check(slug, changes);
    var row = proposals.insert(roadmap.id(), name, actor.subject(), actor.name(), changes.size());
    proposals.addChanges(row.id(), 1, stored(changes), actor.subject());
    return row.summary();
  }

  /**
   * Adds changes to the caller's own Proposal. The row is locked first so concurrent requests apply
   * in turn; the stored and new changes are applied in memory and nothing is written unless the
   * whole result is valid (FR-002, FR-009, FR-012).
   */
  @Transactional
  public ProposalSummary addChanges(
      String slug, String id, Teams teams, Actor actor, List<ProposalChange> added) {
    var roadmap = visible(slug, teams);
    UUID uuid = uuid(slug, id);
    var row =
        proposals.findForUpdate(roadmap.id(), uuid).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!"editor".equals(teams.role(roadmap.team())) || !row.owner().equals(actor.subject())) {
      throw new ApiErrors.Denied();
    }
    List<ProposalChange> changes = added == null ? List.of() : List.copyOf(added);
    if (changes.isEmpty() || changes.size() > MAX_CHANGES_PER_REQUEST) {
      throw new ApiErrors.Invalid("send 1 to " + MAX_CHANGES_PER_REQUEST + " changes");
    }
    if (row.changeCount() + changes.size() > MAX_CHANGES_PER_PROPOSAL) {
      throw new ApiErrors.Invalid("at most " + MAX_CHANGES_PER_PROPOSAL + " changes per Proposal");
    }
    var all = new java.util.ArrayList<>(changesOf(row.id()));
    all.addAll(changes);
    check(slug, all);
    proposals.addChanges(row.id(), row.changeCount() + 1, stored(changes), actor.subject());
    proposals.setChangeCount(row.id(), all.size());
    return proposals.find(roadmap.id(), uuid).orElseThrow().summary();
  }

  /** The roadmap's Proposals, newest first, for any member of the owning team. */
  public List<ProposalSummary> list(String slug, Teams teams) {
    return proposals.list(visible(slug, teams).id()).stream()
        .map(ProposalRepository.Row::summary)
        .toList();
  }

  /** One Proposal, for any member of the owning team. */
  public ProposalSummary get(String slug, String id, Teams teams) {
    return row(slug, id, teams).summary();
  }

  /**
   * The approved roadmap with this Proposal's changes applied in order, read from the database on
   * every call (never the cache), as JSON text.
   */
  public String document(String slug, String id, Teams teams) {
    var row = row(slug, id, teams);
    try {
      return ChangeApplier.apply(base(slug), changesOf(row.id())).toString();
    } catch (ChangeApplier.Refused e) {
      throw new ApiErrors.Invalid(e.getMessage());
    }
  }

  private ProposalRepository.RoadmapRef visible(String slug, Teams teams) {
    var roadmap = proposals.findRoadmap(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!teams.has(roadmap.team())) {
      throw new ApiErrors.NotFound(slug);
    }
    return roadmap;
  }

  private ProposalRepository.Row row(String slug, String id, Teams teams) {
    var roadmap = visible(slug, teams);
    return proposals
        .find(roadmap.id(), uuid(slug, id))
        .orElseThrow(() -> new ApiErrors.NotFound(slug));
  }

  private static UUID uuid(String slug, String id) {
    try {
      return UUID.fromString(id);
    } catch (IllegalArgumentException e) {
      throw new ApiErrors.NotFound(slug); // a malformed id is simply not a Proposal
    }
  }

  private JsonNode base(String slug) {
    return json.readTree(
        roadmaps.findDocument(slug).orElseThrow(() -> new ApiErrors.NotFound(slug)));
  }

  /** Refuses the request, storing nothing, if applying the changes would break the roadmap. */
  private void check(String slug, List<ProposalChange> changes) {
    if (changes.isEmpty()) {
      return;
    }
    try {
      ChangeApplier.apply(base(slug), changes);
    } catch (ChangeApplier.Refused e) {
      throw new ApiErrors.Invalid(e.getMessage());
    }
  }

  private List<ProposalChange> changesOf(UUID proposal) {
    return proposals.changes(proposal).stream()
        .map(s ->
            new ProposalChange(
                s.entity(), s.op(), s.id(), s.fields() == null ? null : json.readTree(s.fields())))
        .toList();
  }

  private List<ProposalRepository.Stored> stored(List<ProposalChange> changes) {
    return changes.stream()
        .map(c ->
            new ProposalRepository.Stored(
                c.entity(),
                c.op(),
                c.id(),
                c.fields() == null || c.fields().isNull() ? null : c.fields().toString()))
        .toList();
  }
}
