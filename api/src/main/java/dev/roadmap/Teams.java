package dev.roadmap;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The teams a user belongs to, and their role in each, read from the token's {@code groups} claim
 * (003-T002, FR-002, FR-003; research R2). The claim has already passed the signature, issuer,
 * audience and expiry checks of spec 002, so it is the only source there is: no lookup, no header.
 *
 * <p>The matching is exact on purpose: no case folding, no extra path parts. A team with two
 * different roles grants nothing, because ambiguity must never widen access, and an entry that is
 * not {@code /team/role} is ignored.
 */
public final class Teams {

  private static final Pattern ENTRY =
      Pattern.compile("^/([a-z0-9][a-z0-9-]{0,31})/(viewer|editor|reviewer)$");

  private final Map<String, String> roles;

  private Teams(Map<String, String> roles) {
    this.roles = roles;
  }

  /** From the claim's group paths; {@code null} (no claim) means no teams. */
  public static Teams of(List<String> groups) {
    Map<String, Set<String>> seen = new HashMap<>();
    for (String path : groups == null ? List.<String>of() : groups) {
      Matcher m = ENTRY.matcher(path == null ? "" : path);
      if (m.matches()) {
        seen.computeIfAbsent(m.group(1), k -> new HashSet<>()).add(m.group(2));
      }
    }
    Map<String, String> one = new HashMap<>();
    seen.forEach((team, found) -> {
      if (found.size() == 1) {
        one.put(team, found.iterator().next());
      }
    });
    return new Teams(Map.copyOf(one));
  }

  /** Whether the user holds a role in this team; any of the three may view. */
  public boolean has(String team) {
    return roles.containsKey(team);
  }

  /** The user's role in this team, or null. */
  public String role(String team) {
    return roles.get(team);
  }

  /** The team names, for the list query. */
  public Set<String> names() {
    return roles.keySet();
  }
}
