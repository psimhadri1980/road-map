package dev.roadmap;

/** One entry of the roadmap list (003-T003, FR-004): what a picker needs, not the document. */
public record RoadmapSummary(String slug, String name, String team, String role) {}
