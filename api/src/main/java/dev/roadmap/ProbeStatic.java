package dev.roadmap;

/** Proof of the static-analysis gate (T036). */
final class ProbeStatic {
  /** Compares strings by reference. */
  static boolean same(String a, String b) {
    return a == b;
  }
}
