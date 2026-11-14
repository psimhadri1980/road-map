package dev.roadmap;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Finds which changes of a Proposal collide with what happened since its base version (007, FR-003,
 * research R2). Every version's document is kept (spec 006), so a collision is simply that the
 * thing a change names, by entity and id, is not the same in the base and the current document.
 * Field-level merging is out of scope: any difference to that entity is a conflict.
 */
@Service
public class ConflictService {

  private final VersionRepository versions;
  private final ObjectMapper json;

  ConflictService(VersionRepository versions, ObjectMapper json) {
    this.versions = versions;
    this.json = json;
  }

  /**
   * The conflicts of {@code changes}, 1-based positions in the given order. Empty when the Proposal
   * is not stale or a document of either version is missing (cannot happen after V8).
   */
  public List<Conflict> find(
      UUID roadmap, int baseVersion, int headVersion, List<ProposalChange> changes) {
    if (baseVersion >= headVersion) {
      return List.of();
    }
    var base = versions.document(roadmap, baseVersion);
    var head = versions.document(roadmap, headVersion);
    if (base.isEmpty() || head.isEmpty()) {
      return List.of();
    }
    JsonNode before = json.readTree(base.get());
    JsonNode now = json.readTree(head.get());
    var found = new ArrayList<Conflict>();
    int position = 0;
    for (ProposalChange c : changes) {
      position++;
      JsonNode was = entity(before, c);
      JsonNode is = entity(now, c);
      boolean created = "create".equals(c.op()) && is != null;
      if (created || !java.util.Objects.equals(was, is)) {
        found.add(new Conflict(position, c.entity(), c.id()));
      }
    }
    return found;
  }

  /** The task, link or roadmap object the change names; null when absent. */
  private static JsonNode entity(JsonNode document, ProposalChange c) {
    if ("roadmap".equals(c.entity())) {
      return document.get("roadmap");
    }
    JsonNode list = document.get("task".equals(c.entity()) ? "tasks" : "links");
    if (list == null) {
      return null;
    }
    for (JsonNode n : list) {
      if (c.id().equals(n.get("id").asString())) {
        return n;
      }
    }
    return null;
  }
}
