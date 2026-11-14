package dev.roadmap;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/**
 * One edit inside a Proposal, in the gantt library's own format ({@code ProposalChange} in
 * {@code @gantt/contract}, minus {@code by} and {@code at}, which the service sets from the token
 * and its clock so a client can never claim to be someone else; 004-T001, research R1).
 *
 * @param entity task, link, resource, calendar or roadmap
 * @param op create, update or delete
 * @param id the id of the thing changed (for {@code roadmap}, the roadmap's own id)
 * @param fields what to set: required for create, optional for update, absent for delete
 */
public record ProposalChange(String entity, String op, String id, JsonNode fields) {

  static final int MAX_FIELDS_BYTES = 64 * 1024;
  static final int MAX_ID = 128;
  private static final Set<String> ENTITIES =
      Set.of("task", "link", "resource", "calendar", "roadmap");
  private static final Set<String> OPS = Set.of("create", "update", "delete");

  /**
   * The reason this change is malformed, or null when its shape is fine. Whether it fits the
   * roadmap is {@link ChangeApplier}'s question.
   */
  String problem() {
    if (entity == null || !ENTITIES.contains(entity)) {
      return "unknown entity";
    }
    if (op == null || !OPS.contains(op)) {
      return "unknown operation";
    }
    if (id == null || id.isEmpty() || id.length() > MAX_ID) {
      return "id must be 1 to " + MAX_ID + " characters";
    }
    boolean has = fields != null && !fields.isNull();
    if (op.equals("delete") && has) {
      return "a delete takes no fields";
    }
    if (op.equals("create") && !has) {
      return "a create needs fields";
    }
    if (has && !fields.isObject()) {
      return "fields must be an object";
    }
    if (has && fields.toString().getBytes(StandardCharsets.UTF_8).length > MAX_FIELDS_BYTES) {
      return "fields are over " + MAX_FIELDS_BYTES / 1024 + " KiB";
    }
    if (entity.equals("roadmap") && !op.equals("update")) {
      return "only update is possible";
    }
    return null;
  }
}
