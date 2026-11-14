package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * 003-T002 (FR-002, FR-003; research R2): the claim parser, case by case. These are the rules that
 * must never widen access, so each edge case of the spec has a line here.
 */
class TeamsTest {

  @Test
  void aTeamAndRoleAreRead() {
    var teams = Teams.of(List.of("/alpha/editor"));
    assertTrue(teams.has("alpha"));
    assertEquals("editor", teams.role("alpha"));
  }

  @Test
  void aUserInTwoTeamsHasBoth() {
    var teams = Teams.of(List.of("/alpha/viewer", "/beta/editor"));
    assertEquals(Set.of("alpha", "beta"), teams.names());
    assertEquals("editor", teams.role("beta"));
  }

  @Test
  void noClaimMeansNoTeams() {
    assertTrue(Teams.of(null).names().isEmpty());
    assertTrue(Teams.of(List.of()).names().isEmpty());
  }

  @Test
  void twoRolesInOneTeamGrantNothingFromThatTeam() {
    var teams = Teams.of(List.of("/alpha/viewer", "/alpha/reviewer", "/beta/viewer"));
    assertFalse(teams.has("alpha"));
    assertTrue(teams.has("beta"));
  }

  @Test
  void theSameEntryTwiceIsStillOneRole() {
    assertTrue(Teams.of(List.of("/alpha/viewer", "/alpha/viewer")).has("alpha"));
  }

  @Test
  void anythingThatIsNotExactlyTeamSlashRoleIsIgnored() {
    for (String entry :
        Arrays.asList(
            "/Alpha/viewer", // no case folding
            "/alpha/Viewer",
            "/alpha/admin", // unknown role
            "/alpha", // a team without a role
            "alpha/viewer", // no leading slash
            "/alpha/viewer/extra", // extra path part
            "/alpha/viewer ", // trailing space
            "/ alpha/viewer",
            "/" + "a".repeat(33) + "/viewer",
            "",
            null)) {
      assertTrue(Teams.of(Arrays.asList(entry)).names().isEmpty(), "granted from: " + entry);
    }
  }

  @Test
  void aTeamTheUserIsNotInHasNoRole() {
    assertNull(Teams.of(List.of("/alpha/viewer")).role("beta"));
  }
}
