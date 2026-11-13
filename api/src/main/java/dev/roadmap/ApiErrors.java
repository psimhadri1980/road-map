package dev.roadmap;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

/**
 * The one place exceptions become responses (T017, contracts/openapi.yaml): {@code {error, code}}
 * with 400, 404, 422 or 503. Messages are for people and carry no internal detail; the detail goes
 * to the log.
 */
@RestControllerAdvice
public class ApiErrors {

  private static final Logger LOG = LoggerFactory.getLogger(ApiErrors.class);

  /** The body of every error response. */
  public record Body(String error, String code) {}

  /** No roadmap has this slug. */
  public static final class NotFound extends RuntimeException {
    NotFound(String slug) {
      super("no roadmap " + slug);
    }
  }

  /** The stored document does not match the gantt format, so it is not served (FR-006). */
  public static final class NonConforming extends RuntimeException {
    NonConforming(String slug) {
      super("roadmap " + slug + " does not match gantt-roadmap/1");
    }
  }

  @ExceptionHandler({HandlerMethodValidationException.class, ConstraintViolationException.class})
  ResponseEntity<Body> invalid() {
    return reply(HttpStatus.BAD_REQUEST, "The roadmap name is not valid.", "invalid");
  }

  @ExceptionHandler(NotFound.class)
  ResponseEntity<Body> notFound() {
    return reply(HttpStatus.NOT_FOUND, "There is no such roadmap.", "notFound");
  }

  @ExceptionHandler(NonConforming.class)
  ResponseEntity<Body> nonConforming(NonConforming e) {
    LOG.warn("{}", e.getMessage());
    return reply(
        HttpStatus.UNPROCESSABLE_CONTENT,
        "The stored roadmap is not in the expected format.",
        "nonConforming");
  }

  /** The database could not answer; the cache already had its chance (FR-008). */
  @ExceptionHandler(DataAccessException.class)
  ResponseEntity<Body> unavailable(DataAccessException e) {
    LOG.error("database unavailable", e);
    return reply(
        HttpStatus.SERVICE_UNAVAILABLE, "The roadmap is temporarily unavailable.", "unavailable");
  }

  private static ResponseEntity<Body> reply(HttpStatus status, String message, String code) {
    return ResponseEntity.status(status).body(new Body(message, code));
  }
}
