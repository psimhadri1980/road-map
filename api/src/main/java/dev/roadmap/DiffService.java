package dev.roadmap;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Read-only comparison of two roadmap documents (011, FR-001, FR-012): tasks and links present in
 * one and not the other, or different. Writes nothing. Membership and unknown versions are decided
 * by the services that read the documents, so a non-member and an absent version get the same 404
 * (spec 003).
 */
@Service
public class DiffService {

  /**
   * One difference. {@code kind} is added, removed, moved (a task whose parent changed) or changed.
   */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Difference(
      String entity, String id, String kind, JsonNode old, @JsonProperty("new") JsonNode now) {}

  private static final ObjectMapper JSON = new ObjectMapper();

  private final VersionService versions;
  private final ProposalService proposals;

  DiffService(VersionService versions, ProposalService proposals) {
    this.versions = versions;
    this.proposals = proposals;
  }

  /** Version {@code from} against version {@code to}. */
  public List<Difference> versions(String slug, String from, String to, Teams teams) {
    return compare(versions.document(slug, from, teams), versions.document(slug, to, teams));
  }

  /** The Proposal's document against the roadmap's current version. */
  public List<Difference> proposal(String slug, String id, Teams teams) {
    String proposed = proposals.document(slug, id, teams);
    String current = String.valueOf(versions.list(slug, teams).get(0).version());
    return compare(versions.document(slug, current, teams), proposed);
  }

  private static List<Difference> compare(String before, String after) {
    var out = new ArrayList<Difference>();
    JsonNode a = JSON.readTree(before);
    JsonNode b = JSON.readTree(after);
    for (String entity : List.of("task", "link")) {
      String key = entity + "s";
      Map<String, JsonNode> old = byId(a.path(key));
      Map<String, JsonNode> now = byId(b.path(key));
      now.forEach((id, n) -> {
        JsonNode o = old.get(id);
        if (o == null) {
          out.add(new Difference(entity, id, "added", null, n));
        } else if (!o.equals(n)) {
          boolean moved = entity.equals("task") && !o.path("parent").equals(n.path("parent"));
          out.add(new Difference(entity, id, moved ? "moved" : "changed", o, n));
        }
      });
      old.forEach((id, o) -> {
        if (!now.containsKey(id)) {
          out.add(new Difference(entity, id, "removed", o, null));
        }
      });
    }
    return out;
  }

  private static Map<String, JsonNode> byId(JsonNode list) {
    var map = new LinkedHashMap<String, JsonNode>();
    for (JsonNode n : list) {
      map.put(n.get("id").asString(), n);
    }
    return map;
  }
}
