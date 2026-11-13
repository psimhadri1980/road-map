package dev.roadmap;

/** Proof of the layering gate (T036). */
final class ProbeRepository {
  /** A repository that reaches up into a controller. */
  Object up(RoadmapController c) {
    return c;
  }
}
