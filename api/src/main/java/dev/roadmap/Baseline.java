package dev.roadmap;

import java.time.OffsetDateTime;

/** A named version of a roadmap (006, FR-005): what a reviewer marks as "the plan we agreed". */
public record Baseline(String name, int version, OffsetDateTime at, String by) {}
