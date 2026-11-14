package dev.roadmap;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import org.springframework.test.context.DynamicPropertyRegistry;
import tools.jackson.databind.ObjectMapper;

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
    // Each cached test context keeps its own pool; small pools keep the many contexts under
    // PostgreSQL's connection limit.
    registry.add("spring.datasource.hikari.maximum-pool-size", () -> 3);
    registry.add("spring.flyway.url", () -> url);
    registry.add("spring.flyway.enabled", () -> postgres == POSTGRES);
    registry.add("spring.data.redis.port", () -> redis);
    // The TLS files as they are on the host; a MOCK context does not serve, but the bundles load.
    registry.add(
        "spring.ssl.bundle.pem.server.keystore.certificate", () -> "file:" + CERTS + "/api.crt");
    registry.add(
        "spring.ssl.bundle.pem.server.keystore.private-key", () -> "file:" + CERTS + "/api.key");
    registry.add("spring.ssl.bundle.pem.ca.truststore.certificate", () -> "file:" + CA);
    registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri", () -> keys(KEYCLOAK));
  }

  /**
   * The running Keycloak's port; the service's key fetch goes straight to it, not through nginx.
   */
  static final int KEYCLOAK = Integer.parseInt(env("PORT_KEYCLOAK_HTTPS"));

  /** Keycloak's signing keys on this port (a closed one makes Keycloak "down" for the service). */
  static String keys(int keycloak) {
    return "https://127.0.0.1:" + keycloak + "/auth/realms/road-map/protocol/openid-connect/certs";
  }

  /**
   * A real access token for the sample user from {@code client}, obtained from the running Keycloak
   * with a password grant (development clients only, research R5). {@code road-map-test} adds the
   * API audience and lives five seconds; {@code road-map-test-other-audience} has no audience.
   */
  static String token(String client) throws Exception {
    return token(client, "sample");
  }

  /** The same for another development user (alice, bob, carol, dave, erin; 003-T001). */
  static String token(String client, String user) throws Exception {
    KeyStore trust = KeyStore.getInstance(KeyStore.getDefaultType());
    trust.load(null);
    try (var in = new ByteArrayInputStream(Files.readAllBytes(Path.of(CA)))) {
      trust.setCertificateEntry(
          "ca", CertificateFactory.getInstance("X.509").generateCertificate(in));
    }
    TrustManagerFactory tmf =
        TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    tmf.init(trust);
    SSLContext tls = SSLContext.getInstance("TLSv1.3");
    tls.init(null, tmf.getTrustManagers(), null);
    String form =
        "grant_type=password&client_id="
            + client
            + "&username="
            + user
            + "&password="
            + URLEncoder.encode(env("SAMPLE_USER_PASSWORD"), StandardCharsets.UTF_8);
    HttpResponse<String> response =
        HttpClient.newBuilder()
            .sslContext(tls)
            .build()
            .send(
                HttpRequest.newBuilder(
                        URI.create(
                            "https://127.0.0.1:"
                                + KEYCLOAK
                                + "/auth/realms/road-map/protocol/openid-connect/token"))
                    .header("content-type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build(),
                HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new IllegalStateException("Keycloak refused the sample user: " + response.statusCode());
    }
    return new ObjectMapper().readTree(response.body()).get("access_token").asString();
  }

  /** The Authorization header value for a fresh token of the default test client. */
  static String bearer() throws Exception {
    return bearer("sample");
  }

  /** The same for another development user. */
  static String bearer(String user) throws Exception {
    return "Bearer " + token("road-map-test", user);
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

  /** Stores {@code document} for team alpha under a new unique slug and returns the slug. */
  static String insert(String document) throws SQLException {
    return insert(document, "alpha");
  }

  /** Stores {@code document} for {@code team} under a new unique slug (as the schema owner). */
  static String insert(String document, String team) throws SQLException {
    String slug = "it-" + UUID.randomUUID().toString().substring(0, 8);
    try (Connection c = migrator();
        PreparedStatement s =
            c.prepareStatement(
                "INSERT INTO roadmap (slug, name, document, team) VALUES (?, 'fixture', ?::jsonb, ?)")) {
      s.setString(1, slug);
      s.setString(2, document);
      s.setString(3, team);
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

  /** Moves a fixture to another owning team directly in the database. */
  static void setTeam(String slug, String team) throws SQLException {
    try (Connection c = migrator();
        PreparedStatement s = c.prepareStatement("UPDATE roadmap SET team = ? WHERE slug = ?")) {
      s.setString(1, team);
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

  /** Removes every Proposal of a fixture roadmap (the service account may not delete them). */
  static void clearProposals(String slug) throws SQLException {
    try (Connection c = migrator();
        PreparedStatement m =
            c.prepareStatement(
                "DELETE FROM proposal_move WHERE proposal_id IN (SELECT p.id FROM proposal p"
                    + " JOIN roadmap r ON r.id = p.roadmap_id WHERE r.slug = ?)");
        PreparedStatement a =
            c.prepareStatement(
                "DELETE FROM proposal_change WHERE proposal_id IN (SELECT p.id FROM proposal p"
                    + " JOIN roadmap r ON r.id = p.roadmap_id WHERE r.slug = ?)");
        PreparedStatement b =
            c.prepareStatement(
                "DELETE FROM proposal WHERE roadmap_id IN (SELECT id FROM roadmap WHERE slug = ?)")) {
      m.setString(1, slug);
      m.executeUpdate();
      a.setString(1, slug);
      a.executeUpdate();
      b.setString(1, slug);
      b.executeUpdate();
    }
  }

  private static Connection migrator() throws SQLException {
    return DriverManager.getConnection(
        jdbcUrl(POSTGRES), "roadmap_migrator", env("ROADMAP_MIGRATOR_PASSWORD"));
  }
}
