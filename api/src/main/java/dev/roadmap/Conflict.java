package dev.roadmap;

/** A change of a Proposal that touches something changed since its base version (007, FR-003). */
public record Conflict(int position, String entity, String id) {}
