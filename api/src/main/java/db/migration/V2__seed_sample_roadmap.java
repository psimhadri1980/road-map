package db.migration;

import dev.roadmap.RoadmapSchema;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import tools.jackson.databind.ObjectMapper;

/**
 * T016 (FR-003, FR-006): stores the gantt library's small sample as the one roadmap, slug
 * {@code sample}. Flyway runs it once, so a second start adds nothing. A Java migration rather than
 * SQL because the document must pass the gantt schema before it is stored; a non-conforming sample
 * fails the migration and the service does not start.
 */
public class V2__seed_sample_roadmap extends BaseJavaMigration {

  @Override
  public void migrate(Context context) throws Exception {
    String document;
    try (InputStream in = getClass().getResourceAsStream("/gantt/small.json")) {
      if (in == null) {
        throw new IllegalStateException("gantt/small.json is not on the classpath");
      }
      document = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
    var problems = RoadmapSchema.validate(document);
    if (!problems.isEmpty()) {
      throw new IllegalStateException("the sample roadmap does not match gantt-roadmap/1: " + problems);
    }
    String name = new ObjectMapper().readTree(document).path("roadmap").path("name").asString();
    try (PreparedStatement insert =
        context
            .getConnection()
            .prepareStatement("INSERT INTO roadmap (slug, name, document) VALUES ('sample', ?, ?::jsonb)")) {
      insert.setString(1, name);
      insert.setString(2, document);
      insert.executeUpdate();
    }
  }
}
