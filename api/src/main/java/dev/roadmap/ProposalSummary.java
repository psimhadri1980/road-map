package dev.roadmap;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A Proposal as the API shows it (004-T002, FR-004). {@code owner} is the creator's readable name
 * (the token's {@code preferred_username}, else its subject), stored when the Proposal was made.
 * {@code note} is the latest return or rejection note (005, FR-004); {@code decidedBy} and {@code
 * decidedAt} are set on approval. {@code baseVersion} is the roadmap version the Proposal was made
 * against and {@code headVersion} the current one; {@code stale} when the roadmap has moved on
 * (007).
 */
public record ProposalSummary(
    UUID id,
    String name,
    String state,
    String owner,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    int changeCount,
    String note,
    String noteBy,
    String decidedBy,
    OffsetDateTime decidedAt,
    int baseVersion,
    int headVersion,
    boolean stale) {}
