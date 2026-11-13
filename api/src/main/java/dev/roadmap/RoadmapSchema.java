package dev.roadmap;

import com.networknt.schema.Error;
import com.networknt.schema.InputFormat;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Checks a roadmap document against the gantt {@code gantt-roadmap/1} JSON Schema (FR-006). Used by
 * the seed migration (T016) before the sample is stored and by the read path (T017) before a
 * roadmap is served, so the one rule has one implementation. The schema is the library's own file,
 * packaged unmodified. Rules JSON Schema cannot express (unique ids, acyclic links) are not checked
 * here; the library's own {@code validate()} does that in the browser.
 */
public final class RoadmapSchema {

  private static final Schema SCHEMA = load();

  private RoadmapSchema() {}

  /** Returns the problems found in {@code document}; empty when it conforms. */
  public static List<String> validate(String document) {
    return SCHEMA.validate(document, InputFormat.JSON).stream().map(Error::getMessage).toList();
  }

  private static Schema load() {
    try (InputStream in =
        RoadmapSchema.class.getResourceAsStream("/gantt/gantt-roadmap-1.schema.json")) {
      if (in == null) {
        throw new IllegalStateException(
            "gantt/gantt-roadmap-1.schema.json is not on the classpath");
      }
      return SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
          .getSchema(new String(in.readAllBytes(), StandardCharsets.UTF_8));
    } catch (IOException e) {
      throw new IllegalStateException("cannot read the gantt roadmap schema", e);
    }
  }
}
