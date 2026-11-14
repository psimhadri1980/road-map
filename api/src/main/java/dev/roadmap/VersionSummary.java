package dev.roadmap;

import java.time.OffsetDateTime;
import java.util.UUID;

/** A version as listed (006, FR-003): who made it, when, and the Proposal it came from, if any. */
public record VersionSummary(
    int version, OffsetDateTime at, String by, UUID proposalId, String note) {}
