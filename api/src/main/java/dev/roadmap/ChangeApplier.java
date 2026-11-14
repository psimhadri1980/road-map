package dev.roadmap;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Applies a Proposal's changes to a roadmap document, all or nothing (004-T001, research R2). A
 * port of {@code applyChanges} in the gantt library ({@code packages/proposals/src/changes.ts}), so
 * the service and the browser agree on what a change means: changes apply in order on a copy;
 * create refuses an existing id, update and delete refuse a missing one; update merges fields and
 * drops nulls except {@code parent}; deleting a task removes its subtree and every link touching
 * it. The result must still be a valid roadmap or the whole request is refused. The input document
 * is never modified, which is what keeps the approved roadmap untouched (FR-005).
 *
 * <p>Plain Java on purpose: no Spring, no database, so it can be tested case by case.
 *
 * <p>shortcut: beyond the library's JSON Schema this checks only unique ids, existing parents (not
 * self) and existing link ends. The library's full {@code validate()} also checks calendars, splits
 * and milestones; the schema covers their shapes. Upgrade when shared test vectors exist (plan
 * section 6) or a case shows an invalid document getting through.
 */
public final class ChangeApplier {

  /** The request cannot be applied; the message is safe to show and names the failing change. */
  public static final class Refused extends RuntimeException {
    Refused(String message) {
      super(message);
    }
  }

  private static final Map<String, String> COLLECTION =
      Map.of("task", "tasks", "link", "links", "resource", "resources", "calendar", "calendars");

  private ChangeApplier() {}

  /**
   * The document with {@code changes} applied; throws {@link Refused} and changes nothing
   * otherwise.
   */
  public static ObjectNode apply(JsonNode base, List<ProposalChange> changes) {
    ObjectNode doc = (ObjectNode) base.deepCopy();
    for (int i = 0; i < changes.size(); i++) {
      ProposalChange c = changes.get(i);
      String where = "change " + (i + 1) + " (" + c.entity() + " " + c.op() + " " + c.id() + ")";
      String shape = c.problem();
      if (shape != null) {
        throw new Refused(where + ": " + shape);
      }
      try {
        applyOne(doc, c);
      } catch (Refused e) {
        throw new Refused(where + ": " + e.getMessage());
      }
    }
    checkWhole(doc);
    return doc;
  }

  private static void applyOne(ObjectNode doc, ProposalChange c) {
    if (c.entity().equals("roadmap")) {
      ObjectNode roadmap = (ObjectNode) doc.get("roadmap");
      String own = roadmap.get("id").asString();
      merge(roadmap, c.fields());
      roadmap.put("id", own); // the roadmap's identity is never editable
      return;
    }
    String name = COLLECTION.get(c.entity());
    ArrayNode list = doc.get(name) instanceof ArrayNode a ? a : doc.putArray(name);
    int at = indexOf(list, c.id());
    switch (c.op()) {
      case "create" -> {
        if (at >= 0) {
          throw new Refused("already exists");
        }
        ObjectNode item = ((ObjectNode) c.fields()).deepCopy();
        item.put("id", c.id());
        list.add(item);
      }
      case "update" -> {
        if (at < 0) {
          throw new Refused("does not exist");
        }
        ObjectNode item = (ObjectNode) list.get(at);
        merge(item, c.fields());
        item.put("id", c.id());
      }
      default -> {
        if (at < 0) {
          throw new Refused("does not exist");
        }
        if (c.entity().equals("task")) {
          deleteTaskSubtree(doc, c.id());
        } else {
          list.remove(at);
        }
      }
    }
  }

  /** Sets each field; a null removes it, except {@code parent}, where null means top level. */
  private static void merge(ObjectNode target, JsonNode fields) {
    if (fields == null || fields.isNull()) {
      return;
    }
    for (var e : fields.properties()) {
      if (e.getValue().isNull() && !e.getKey().equals("parent")) {
        target.remove(e.getKey());
      } else {
        target.set(e.getKey(), e.getValue().deepCopy());
      }
    }
  }

  private static void deleteTaskSubtree(ObjectNode doc, String id) {
    ArrayNode tasks = (ArrayNode) doc.get("tasks");
    Set<String> gone = new HashSet<>(Set.of(id));
    for (boolean grew = true; grew; ) {
      grew = false;
      for (JsonNode t : tasks) {
        String parent = t.path("parent").isString() ? t.get("parent").asString() : null;
        if (parent != null && gone.contains(parent) && gone.add(t.get("id").asString())) {
          grew = true;
        }
      }
    }
    for (int i = tasks.size() - 1; i >= 0; i--) {
      if (gone.contains(tasks.get(i).get("id").asString())) {
        tasks.remove(i);
      }
    }
    if (doc.get("links") instanceof ArrayNode links) {
      for (int i = links.size() - 1; i >= 0; i--) {
        JsonNode l = links.get(i);
        if (gone.contains(l.path("source").asString())
            || gone.contains(l.path("target").asString())) {
          links.remove(i);
        }
      }
    }
  }

  private static int indexOf(ArrayNode list, String id) {
    for (int i = 0; i < list.size(); i++) {
      if (id.equals(list.get(i).path("id").asString())) {
        return i;
      }
    }
    return -1;
  }

  /**
   * The result must be a roadmap the read path would serve: schema plus what the schema cannot say.
   */
  private static void checkWhole(ObjectNode doc) {
    Set<String> taskIds = ids(doc, "tasks");
    ids(doc, "links");
    ids(doc, "resources");
    ids(doc, "calendars");
    for (JsonNode t : doc.path("tasks")) {
      JsonNode parent = t.path("parent");
      String id = t.path("id").asString();
      if (parent.isString()
          && (parent.asString().equals(id) || !taskIds.contains(parent.asString()))) {
        throw new Refused("task " + id + " has an unknown or self parent");
      }
    }
    for (JsonNode l : doc.path("links")) {
      if (!taskIds.contains(l.path("source").asString())
          || !taskIds.contains(l.path("target").asString())) {
        throw new Refused("link " + l.path("id").asString() + " joins a task that does not exist");
      }
    }
    List<String> problems = RoadmapSchema.validate(doc.toString());
    if (!problems.isEmpty()) {
      throw new Refused(
          "the result is not a valid roadmap: "
              + String.join("; ", problems.stream().limit(3).toList()));
    }
  }

  private static Set<String> ids(ObjectNode doc, String collection) {
    Set<String> seen = new HashSet<>();
    for (JsonNode x : doc.path(collection)) {
      if (!seen.add(x.path("id").asString())) {
        throw new Refused("duplicate id " + x.path("id").asString() + " in " + collection);
      }
    }
    return seen;
  }
}
