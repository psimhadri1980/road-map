package dev.roadmap.transport;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.sql.DriverManager;
import java.sql.SQLException;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManagerFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * T026, the service's side of the transport rules (FR-013, FR-014, SC-004): PostgreSQL and Redis
 * refuse plain text; a client that trusts a different certificate authority, or expects a different
 * host name, refuses them. The connections are the ones the service makes, to the real containers.
 */
class TransportIT {

  private static final int POSTGRES = Integer.parseInt(env("PORT_POSTGRES"));
  private static final int REDIS = Integer.parseInt(env("PORT_REDIS"));
  private static final String CA = env("RM_TEST_CA_FILE");

  /** A certificate authority that did not issue the stack's certificates. */
  private static Path foreignCa;

  @BeforeAll
  static void foreignCa(@TempDir Path dir) throws Exception {
    Path store = dir.resolve("other.p12");
    foreignCa = dir.resolve("other-ca.pem");
    run(
        "keytool",
        "-genkeypair",
        "-alias",
        "other",
        "-keyalg",
        "EC",
        "-groupname",
        "secp256r1",
        "-dname",
        "CN=Some other CA",
        "-ext",
        "bc:c",
        "-validity",
        "30",
        "-storetype",
        "PKCS12",
        "-keystore",
        store.toString(),
        "-storepass",
        "changeit");
    run(
        "keytool",
        "-exportcert",
        "-rfc",
        "-alias",
        "other",
        "-keystore",
        store.toString(),
        "-storepass",
        "changeit",
        "-file",
        foreignCa.toString());
  }

  private static String env(String name) {
    String value = System.getenv(name);
    if (value == null) {
      throw new IllegalStateException(name + " is not set; run: run/run.sh api:test integration");
    }
    return value;
  }

  private static void run(String... command) throws Exception {
    Process p = new ProcessBuilder(command).redirectErrorStream(true).start();
    String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    assertEquals(0, p.waitFor(), out);
  }

  /** The service's own database connection, with the given TLS mode and trust anchor. */
  private static void connect(String sslmode, String rootCert) throws SQLException {
    String url =
        "jdbc:postgresql://127.0.0.1:"
            + POSTGRES
            + "/roadmap?sslmode="
            + sslmode
            + "&sslrootcert="
            + rootCert;
    DriverManager.getConnection(url, "roadmap_app", env("ROADMAP_APP_PASSWORD")).close();
  }

  /** A TLS client socket to Redis that trusts `ca` and checks the certificate against `host`. */
  private static SSLSocket redis(String ca, String host) throws Exception {
    KeyStore trust = KeyStore.getInstance(KeyStore.getDefaultType());
    trust.load(null);
    try (InputStream in = new ByteArrayInputStream(Files.readAllBytes(Path.of(ca)))) {
      trust.setCertificateEntry(
          "ca", CertificateFactory.getInstance("X.509").generateCertificate(in));
    }
    TrustManagerFactory tmf =
        TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    tmf.init(trust);
    SSLContext context = SSLContext.getInstance("TLSv1.3");
    context.init(null, tmf.getTrustManagers(), null);
    // The TCP connection goes to the loopback address; `host` is the name the certificate must
    // match.
    SSLSocket socket =
        (SSLSocket)
            context
                .getSocketFactory()
                .createSocket(new Socket("127.0.0.1", REDIS), host, REDIS, true);
    SSLParameters parameters = socket.getSSLParameters();
    parameters.setEndpointIdentificationAlgorithm("HTTPS");
    socket.setSSLParameters(parameters);
    socket.setSoTimeout(3000);
    return socket;
  }

  @Test
  void postgresRefusesPlainText() {
    SQLException e = assertThrows(SQLException.class, () -> connect("disable", CA));
    assertTrue(
        e.getMessage().contains("pg_hba.conf") || e.getMessage().contains("encryption"),
        e.getMessage());
  }

  @Test
  void postgresIsReachableOverVerifiedTlsAndNotWithAForeignCa() throws Exception {
    assertDoesNotThrow(() -> connect("verify-full", CA));
    SQLException e =
        assertThrows(SQLException.class, () -> connect("verify-full", foreignCa.toString()));
    assertTrue(e.getMessage().contains("SSL") || e.getMessage().contains("PKIX"), e.getMessage());
  }

  @Test
  void redisRefusesPlainText() throws Exception {
    try (Socket plain = new Socket("127.0.0.1", REDIS)) {
      plain.setSoTimeout(3000);
      plain.getOutputStream().write("PING\r\n".getBytes(StandardCharsets.US_ASCII));
      byte[] answer = new byte[16];
      int n;
      try {
        n = plain.getInputStream().read(answer);
      } catch (IOException closed) {
        n = -1; // reset by the server: refused
      }
      assertTrue(n <= 0 || !new String(answer, 0, n, StandardCharsets.US_ASCII).contains("PONG"));
    }
  }

  @Test
  void redisIsReachableOverVerifiedTlsAndNotWithAForeignCaOrAWrongHostName() throws Exception {
    try (SSLSocket ok = redis(CA, "localhost")) {
      assertDoesNotThrow(ok::startHandshake);
    }
    try (SSLSocket foreign = redis(foreignCa.toString(), "localhost")) {
      assertThrows(SSLHandshakeException.class, foreign::startHandshake);
    }
    try (SSLSocket wrongName = redis(CA, "redis.example.com")) {
      assertThrows(SSLHandshakeException.class, wrongName::startHandshake);
    }
  }
}
