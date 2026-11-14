package dev.roadmap;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

/**
 * The one place exceptions become responses (T017, contracts/openapi.yaml): {@code {error, code}}
 * with 400, 401, 404, 422 or 503. Messages are for people and carry no internal detail; the detail
 * goes to the log.
 */
@RestControllerAdvice
public class ApiErrors {

  private static final Logger LOG = LoggerFactory.getLogger(ApiErrors.class);

  /** The body of every error response. */
  public record Body(String error, String code) {}

  /**
   * What an unauthenticated caller gets (002-T003, FR-007, FR-011): one message for every reason,
   * so the response never tells an attacker which check failed. Written by the security filter
   * chain, which runs before any controller, so it is a constant here rather than an exception
   * handler.
   */
  static final Body UNAUTHENTICATED = new Body("Sign in to continue.", "unauthenticated");

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

  /**
   * A member of the owning team lacks the role or ownership the action needs (004-T002, R6). Only
   * ever thrown after the team check, so it reveals nothing the caller does not already know.
   */
  public static final class Denied extends RuntimeException {
    Denied() {
      super("not permitted");
    }
  }

  /** The request is well-formed but cannot be applied; the message is safe to show (R9). */
  public static final class Invalid extends RuntimeException {
    Invalid(String message) {
      super(message);
    }
  }

  @ExceptionHandler({HandlerMethodValidationException.class, ConstraintViolationException.class})
  ResponseEntity<Body> invalid() {
    return reply(HttpStatus.BAD_REQUEST, "The roadmap name is not valid.", "invalid");
  }

  @ExceptionHandler(NotFound.class)
  ResponseEntity<Body> notFound() {
    // One text for every kind of absent, so an outsider cannot tell a roadmap from a Proposal.
    return reply(HttpStatus.NOT_FOUND, "Not found.", "notFound");
  }

  @ExceptionHandler(Denied.class)
  ResponseEntity<Body> denied() {
    return reply(HttpStatus.FORBIDDEN, "You are not permitted to do that.", "denied");
  }

  @ExceptionHandler(Invalid.class)
  ResponseEntity<Body> invalid(Invalid e) {
    return reply(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), "invalid");
  }

  /** A body that is not JSON of the expected shape is invalid input, not a server fault. */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Body> unreadable() {
    return reply(HttpStatus.UNPROCESSABLE_CONTENT, "The request body is not valid.", "invalid");
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
