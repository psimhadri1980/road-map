package dev.roadmap;

import java.util.Locale;
import java.util.Optional;

/**
 * The states of a Proposal and the one table of moves between them (005-T001, FR-001, research R1).
 * Nothing else in the code decides whether a move is allowed: {@link Action#target} is the table.
 */
public enum ProposalState {
  DRAFT,
  SUBMITTED,
  APPROVED,
  REJECTED,
  DISCARDED;

  /** Who may perform an action (research R2). */
  public enum Who {
    /** The creator, who must still be an editor of the owning team. */
    CREATOR,
    /** A reviewer of the owning team who is not the creator. */
    REVIEWER
  }

  /** The six actions, each with its allowed starting state, result and actor. */
  public enum Action {
    SUBMIT(DRAFT, SUBMITTED, Who.CREATOR),
    WITHDRAW(SUBMITTED, DRAFT, Who.CREATOR),
    DISCARD(DRAFT, DISCARDED, Who.CREATOR),
    RETURN(SUBMITTED, DRAFT, Who.REVIEWER),
    REJECT(SUBMITTED, REJECTED, Who.REVIEWER),
    APPROVE(SUBMITTED, APPROVED, Who.REVIEWER);

    private final ProposalState from;
    private final ProposalState to;
    private final Who who;

    Action(ProposalState from, ProposalState to, Who who) {
      this.from = from;
      this.to = to;
      this.who = who;
    }

    /** The state after this action, or empty if it is not allowed from {@code state}. */
    public Optional<ProposalState> target(ProposalState state) {
      return state == from ? Optional.of(to) : Optional.empty();
    }

    /** Who may do it. */
    public Who who() {
      return who;
    }

    /** A return or a rejection must say why (FR-004). */
    public boolean needsNote() {
      return this == RETURN || this == REJECT;
    }

    /** The action named in a URL, or empty if there is no such action. */
    public static Optional<Action> parse(String name) {
      try {
        return Optional.of(valueOf(name.toUpperCase(Locale.ROOT)));
      } catch (IllegalArgumentException e) {
        return Optional.empty();
      }
    }
  }

  /** The stored form of a state. */
  public String db() {
    return name().toLowerCase(Locale.ROOT);
  }

  /** The state stored under this text. */
  public static ProposalState fromDb(String value) {
    return valueOf(value.toUpperCase(Locale.ROOT));
  }
}
