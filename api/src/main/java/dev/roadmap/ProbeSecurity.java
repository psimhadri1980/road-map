package dev.roadmap;

/** Proof of the security-analysis gate (T036). */
final class ProbeSecurity {
  /** Uses a predictable random generator. */
  static int pick() {
    return new java.util.Random().nextInt();
  }
}
