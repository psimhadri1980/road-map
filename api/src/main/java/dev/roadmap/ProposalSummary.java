package dev.roadmap;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A Proposal as the API shows it (004-T002, FR-004). {@code owner} is the creator's readable name
 * (the token's {@code preferred_username}, else its subject), stored when the Proposal was made.
 */
public record ProposalSummary(
    UUID id,
    String name,
    String state,
    String owner,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    int changeCount) {}
