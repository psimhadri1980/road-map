package dev.roadmap;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ssl.SslBundles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * The service as an OAuth 2.0 resource server (002-T003, FR-008, FR-009, FR-010). Every route
 * except the health probes needs a valid access token from the road-map realm; the user is the
 * token's subject ({@code Authentication.getName()}), and nothing reads a user header, so {@code
 * x-gantt-user} cannot name anyone (constitution III). nginx checks tokens first (002-T004), but
 * this is the authority: it re-checks signature, issuer, audience and expiry on every request, so a
 * request that reaches the service by any other path is refused just the same.
 */
@Configuration
class SecurityConfig {

  /**
   * Spring Security's default tolerance is a minute; tokens here live five, so five seconds is
   * plenty.
   */
  private static final Duration CLOCK_SKEW = Duration.ofSeconds(5);

  /**
   * Stateless, bearer-only chain. CSRF protection is off because no cookie authenticates a request,
   * so there is nothing for a forged request to ride on; sessions are off for the same reason.
   */
  @Bean
  SecurityFilterChain filters(HttpSecurity http, ObjectMapper json) throws Exception {
    return http.authorizeHttpRequests(rules ->
            rules.requestMatchers("/actuator/health/**").permitAll().anyRequest().authenticated())
        .oauth2ResourceServer(oauth ->
            oauth
                .jwt(Customizer.withDefaults())
                // Bad, missing and unverifiable tokens all end here: one body, never the reason.
                .authenticationEntryPoint((request, response, e) -> {
                  response.setStatus(401);
                  response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
                  response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                  json.writeValue(response.getOutputStream(), ApiErrors.UNAUTHENTICATED);
                }))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(AbstractHttpConfigurer::disable)
        .build();
  }

  /**
   * The one bean beyond properties: Spring's own decoder would fetch the keys with the JVM's trust
   * store, which does not hold the project CA, so the key fetch uses the {@code ca} SSL bundle
   * instead. Keys are cached and refetched on an unknown key id; if Keycloak cannot be reached the
   * decode fails and the request is refused, never accepted unverified (FR-010, fail closed).
   */
  @Bean
  JwtDecoder jwtDecoder(
      SslBundles bundles,
      @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String keys,
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
      @Value("${spring.security.oauth2.resourceserver.jwt.audiences}") String audience) {
    HttpClient http =
        HttpClient.newBuilder()
            .sslContext(bundles.getBundle("ca").createSslContext())
            .connectTimeout(Duration.ofSeconds(2))
            .build();
    JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
    factory.setReadTimeout(Duration.ofSeconds(2));
    NimbusJwtDecoder decoder =
        NimbusJwtDecoder.withJwkSetUri(keys).restOperations(new RestTemplate(factory)).build();
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(CLOCK_SKEW),
            new JwtIssuerValidator(issuer),
            audienceIs(audience)));
    return decoder;
  }

  /**
   * The token must have been issued for this API: a token for another client of the realm is
   * refused.
   */
  private static OAuth2TokenValidator<Jwt> audienceIs(String audience) {
    OAuth2TokenValidatorResult refused =
        OAuth2TokenValidatorResult.failure(
            new OAuth2Error("invalid_token", "wrong audience", null));
    return jwt -> {
      List<String> audiences = jwt.getAudience();
      return audiences != null && audiences.contains(audience)
          ? OAuth2TokenValidatorResult.success()
          : refused;
    };
  }
}
