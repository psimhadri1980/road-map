package db.migration;

import dev.roadmap.RoadmapSchema;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 003-T002 (FR-013): Beta's roadmap, so access between teams has something to refuse. It is the
 * gantt sample again under another name; like V2 it must pass the gantt schema before it is stored.
 */
public class V4__seed_second_roadmap extends BaseJavaMigration {

  @Override
  public void migrate(Context context) throws Exception {
    JsonNode root;
    try (InputStream in = getClass().getResourceAsStream("/gantt/small.json")) {
      if (in == null) {
        throw new IllegalStateException("gantt/small.json is not on the classpath");
      }
      root = new ObjectMapper().readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
    }
    String name = "Beta roadmap";
    ((ObjectNode) root.get("roadmap")).put("name", name);
    String document = root.toString();
    var problems = RoadmapSchema.validate(document);
    if (!problems.isEmpty()) {
      throw new IllegalStateException(
          "the second roadmap does not match gantt-roadmap/1: " + problems);
    }
    try (PreparedStatement insert =
        context
            .getConnection()
            .prepareStatement(
                "INSERT INTO roadmap (slug, name, document, team) VALUES ('beta-plan', ?, ?::jsonb, 'beta')")) {
      insert.setString(1, name);
      insert.setString(2, document);
      insert.executeUpdate();
    }
  }
}
