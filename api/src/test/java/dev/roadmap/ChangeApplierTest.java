package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 004-T001 (FR-002, FR-005, FR-009): each operation and each refusal of the change applier, on the
 * gantt sample (t1 is a summary with children t2, t3, t4; link l1 joins t2 to t4).
 */
class ChangeApplierTest {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static JsonNode base;
  private static String baseText;

  @BeforeAll
  static void load() throws Exception {
    try (var in = ChangeApplierTest.class.getResourceAsStream("/gantt/small.json")) {
      baseText = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      base = JSON.readTree(baseText);
    }
  }

  private static ProposalChange c(String entity, String op, String id, String fields) {
    return new ProposalChange(entity, op, id, fields == null ? null : JSON.readTree(fields));
  }

  private static JsonNode apply(ProposalChange... changes) {
    return ChangeApplier.apply(base, List.of(changes));
  }

  private static String refusal(ProposalChange... changes) {
    return assertThrows(ChangeApplier.Refused.class, () -> apply(changes)).getMessage();
  }

  /** Asserts with the actual message, so a mismatch shows what the applier said. */
  private static void has(String message, String part, String how) {
    assertTrue(how.equals("contains") ? message.contains(part) : message.endsWith(part), message);
  }

  private static JsonNode task(JsonNode doc, String id) {
    for (JsonNode t : doc.get("tasks")) {
      if (t.get("id").asString().equals(id)) {
        return t;
      }
    }
    return null;
  }

  @Test
  void anUpdateMergesFieldsAndLeavesTheInputUntouched() {
    JsonNode out = apply(c("task", "update", "t2", "{\"name\":\"Requirements v2\"}"));
    assertEquals("Requirements v2", task(out, "t2").get("name").asString());
    assertEquals("Requirements", task(base, "t2").get("name").asString());
  }

  @Test
  void changesApplyInOrder() {
    JsonNode out =
        apply(
            c("task", "update", "t2", "{\"name\":\"first\"}"),
            c("task", "update", "t2", "{\"name\":\"second\"}"));
    assertEquals("second", task(out, "t2").get("name").asString());
  }

  @Test
  void aCreateAddsAndRefusesAnExistingId() {
    JsonNode out =
        apply(
            c(
                "task",
                "create",
                "t99",
                "{\"name\":\"New\",\"type\":\"task\",\"parent\":\"t1\",\"start\":\"2026-11-03\",\"duration\":2}"));
    assertEquals("New", task(out, "t99").get("name").asString());
    assertEquals(
        "change 1 (task create t2): already exists",
        refusal(c("task", "create", "t2", "{\"name\":\"x\"}")));
  }

  @Test
  void anUpdateOrDeleteOfAMissingIdIsRefusedAndNamesTheChange() {
    assertEquals(
        "change 2 (task update t9x): does not exist",
        refusal(
            c("task", "update", "t2", "{\"name\":\"ok\"}"),
            c("task", "update", "t9x", "{\"name\":\"x\"}")));
    has(refusal(c("link", "delete", "nope", null)), "does not exist", "endsWith");
  }

  @Test
  void aNullRemovesAFieldExceptParentWhichMeansTopLevel() {
    JsonNode out = apply(c("task", "update", "t2", "{\"parent\":null}"));
    assertTrue(task(out, "t2").get("parent").isNull());
  }

  @Test
  void deletingATaskDeletesItsSubtreeAndTheLinksTouchingIt() {
    JsonNode out = apply(c("task", "delete", "t1", null));
    assertEquals(null, task(out, "t1"));
    assertEquals(null, task(out, "t2"));
    for (JsonNode l : out.get("links")) {
      assertTrue(
          !l.get("source").asString().equals("t2") && !l.get("target").asString().equals("t4"));
    }
    assertEquals(20, base.get("tasks").size());
  }

  @Test
  void aDeleteOfALinkLeavesTasksAlone() {
    JsonNode out = apply(c("link", "delete", "l1", null));
    assertEquals(base.get("tasks").size(), out.get("tasks").size());
    assertEquals(base.get("links").size() - 1, out.get("links").size());
  }

  @Test
  void theRoadmapCanBeUpdatedButNotItsId() {
    JsonNode out = apply(c("roadmap", "update", "r1", "{\"name\":\"Renamed\",\"id\":\"other\"}"));
    assertEquals("Renamed", out.get("roadmap").get("name").asString());
    assertEquals("r1", out.get("roadmap").get("id").asString());
    assertEquals(
        "change 1 (roadmap delete r1): only update is possible",
        refusal(c("roadmap", "delete", "r1", null)));
  }

  @Test
  void aResultThatBreaksTheRoadmapIsRefusedAsAWhole() {
    has(
        refusal(c("task", "update", "t2", "{\"parent\":\"missing\"}")),
        "unknown or self parent",
        "contains");
    has(
        refusal(c("task", "update", "t2", "{\"parent\":\"t2\"}")),
        "unknown or self parent",
        "contains");
    has(
        refusal(
            c("link", "create", "l99", "{\"source\":\"t2\",\"target\":\"gone\",\"type\":\"FS\"}")),
        "joins a task that does not exist",
        "contains");
    has(
        refusal(c("task", "update", "t2", "{\"duration\":\"long\"}")),
        "not a valid roadmap",
        "contains");
  }

  @Test
  void malformedChangesAreRefusedByShape() {
    assertEquals(
        "change 1 (bogus update t2): unknown entity", refusal(c("bogus", "update", "t2", null)));
    has(refusal(c("task", "create", "t98", null)), "a create needs fields", "endsWith");
    has(
        refusal(c("task", "delete", "t2", "{\"name\":\"x\"}")),
        "a delete takes no fields",
        "endsWith");
    has(refusal(c("task", "update", "t2", "[1]")), "fields must be an object", "endsWith");
    has(refusal(c("task", "update", "x".repeat(129), null)), "id must be 1 to 128", "contains");
    String big = "{\"name\":\"" + "x".repeat(70_000) + "\"}";
    has(refusal(c("task", "update", "t2", big)), "fields are over 64 KiB", "endsWith");
  }
}
