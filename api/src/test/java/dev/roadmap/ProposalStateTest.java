package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * 005-T001 (FR-001, FR-009, SC-005): every state and action pair, against the table in the spec.
 */
class ProposalStateTest {

  private static final String ALLOWED =
      "SUBMIT:DRAFT>SUBMITTED WITHDRAW:SUBMITTED>DRAFT DISCARD:DRAFT>DISCARDED "
          + "RETURN:SUBMITTED>DRAFT REJECT:SUBMITTED>REJECTED APPROVE:SUBMITTED>APPROVED";

  @Test
  void exactlyTheSixListedMovesAreAllowed() {
    for (var action : ProposalState.Action.values()) {
      for (var state : ProposalState.values()) {
        Optional<ProposalState> to = action.target(state);
        String key = action + ":" + state + ">" + to.orElse(null);
        assertEquals(to.isPresent(), ALLOWED.contains(key), key);
      }
    }
  }

  @Test
  void finalStatesAllowNothing() {
    for (var state :
        new ProposalState[] {
          ProposalState.APPROVED, ProposalState.REJECTED, ProposalState.DISCARDED
        }) {
      for (var action : ProposalState.Action.values()) {
        assertTrue(action.target(state).isEmpty(), action + " from " + state);
      }
    }
  }

  @Test
  void actionsParseAndRolesAndNotesFollowTheSpec() {
    assertEquals(ProposalState.Action.APPROVE, ProposalState.Action.parse("approve").orElseThrow());
    assertTrue(ProposalState.Action.parse("destroy").isEmpty());
    assertEquals(ProposalState.Who.CREATOR, ProposalState.Action.SUBMIT.who());
    assertEquals(ProposalState.Who.REVIEWER, ProposalState.Action.RETURN.who());
    assertTrue(
        ProposalState.Action.REJECT.needsNote() && !ProposalState.Action.APPROVE.needsNote());
    assertEquals(ProposalState.SUBMITTED, ProposalState.fromDb(ProposalState.SUBMITTED.db()));
  }
}
