package dev.roadmap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

/**
 * The road-map service (spec 001, T013). Everything it does is configuration of Spring Boot in
 * {@code application.yaml}: TLS for serving, PostgreSQL and Redis over TLS, Flyway migrations and
 * the cache. {@code @EnableCaching} switches on the cache abstraction that the read path (T017)
 * uses.
 */
@SpringBootApplication
@EnableCaching
public class RoadmapApplication {

  /** Starts the service. */
  public static void main(String[] args) {
    SpringApplication.run(RoadmapApplication.class, args);
  }
}
