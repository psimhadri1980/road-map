package dev.roadmap;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;
import org.springframework.test.context.DynamicPropertyRegistry;

/**
 * What the integration tests (T018) share: the addresses of the running PostgreSQL and Redis, how
 * to point a Spring context at them (or at a closed port, for an outage), and fixture roadmaps
 * written as the schema owner. Values come from {@code run/run.sh api:test integration}.
 */
final class Services {

  /** A port nothing listens on: a service that is down. */
  static final int DOWN = 1;

  static final int POSTGRES = Integer.parseInt(env("PORT_POSTGRES"));
  static final int REDIS = Integer.parseInt(env("PORT_REDIS"));
  private static final String CA = env("RM_TEST_CA_FILE");
  private static final String CERTS = env("RM_TEST_CERT_DIR");

  private Services() {}

  static String env(String name) {
    String value = System.getenv(name);
    if (value == null) {
      throw new IllegalStateException(name + " is not set; run: run/run.sh api:test integration");
    }
    return value;
  }

  /**
   * Points a test context at PostgreSQL and Redis on these ports; Flyway only when the database is
   * up.
   */
  static void use(DynamicPropertyRegistry registry, int postgres, int redis) {
    String url = jdbcUrl(postgres);
    registry.add("spring.datasource.url", () -> url);
    registry.add("spring.flyway.url", () -> url);
    registry.add("spring.flyway.enabled", () -> postgres == POSTGRES);
    registry.add("spring.data.redis.port", () -> redis);
    // The TLS files as they are on the host; a MOCK context does not serve, but the bundles load.
    registry.add(
        "spring.ssl.bundle.pem.server.keystore.certificate", () -> "file:" + CERTS + "/api.crt");
    registry.add(
        "spring.ssl.bundle.pem.server.keystore.private-key", () -> "file:" + CERTS + "/api.key");
    registry.add("spring.ssl.bundle.pem.ca.truststore.certificate", () -> "file:" + CA);
  }

  private static String jdbcUrl(int port) {
    return "jdbc:postgresql://127.0.0.1:" + port + "/roadmap?sslmode=verify-full&sslrootcert=" + CA;
  }

  /** The gantt sample, as the service stores and serves it. */
  static String sample() throws Exception {
    try (var in = Services.class.getResourceAsStream("/gantt/small.json")) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  /** Stores {@code document} under a new unique slug (as the schema owner) and returns the slug. */
  static String insert(String document) throws SQLException {
    String slug = "it-" + UUID.randomUUID().toString().substring(0, 8);
    try (Connection c = migrator();
        PreparedStatement s =
            c.prepareStatement(
                "INSERT INTO roadmap (slug, name, document) VALUES (?, 'fixture', ?::jsonb)")) {
      s.setString(1, slug);
      s.setString(2, document);
      s.executeUpdate();
    }
    return slug;
  }

  /** Replaces a fixture's document directly in the database. */
  static void update(String slug, String document) throws SQLException {
    try (Connection c = migrator();
        PreparedStatement s =
            c.prepareStatement("UPDATE roadmap SET document = ?::jsonb WHERE slug = ?")) {
      s.setString(1, document);
      s.setString(2, slug);
      s.executeUpdate();
    }
  }

  /** Removes a fixture row. Its cache entry stays: the service account may not delete keys. */
  static void delete(String slug) throws SQLException {
    try (Connection c = migrator();
        PreparedStatement s = c.prepareStatement("DELETE FROM roadmap WHERE slug = ?")) {
      s.setString(1, slug);
      s.executeUpdate();
    }
  }

  private static Connection migrator() throws SQLException {
    return DriverManager.getConnection(
        jdbcUrl(POSTGRES), "roadmap_migrator", env("ROADMAP_MIGRATOR_PASSWORD"));
  }
}
