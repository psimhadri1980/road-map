package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/** T016 / FR-006: the gantt sample conforms; a broken document is refused with reasons. */
class RoadmapSchemaTest {

  private static String sample() throws Exception {
    try (var in = RoadmapSchemaTest.class.getResourceAsStream("/gantt/small.json")) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  @Test
  void theGanttSampleConforms() throws Exception {
    assertEquals(java.util.List.of(), RoadmapSchema.validate(sample()));
  }

  @Test
  void aWrongContractIsRefused() throws Exception {
    assertFalse(RoadmapSchema.validate(sample().replace("gantt-roadmap/1", "other/1")).isEmpty());
  }

  @Test
  void aDocumentWithoutTasksIsRefused() {
    assertFalse(RoadmapSchema.validate("{\"contract\":\"gantt-roadmap/1\"}").isEmpty());
  }
}
