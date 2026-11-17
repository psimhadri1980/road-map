package dev.roadmap;

import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

/**
 * The open event streams, per roadmap (008-T001, FR-001, FR-007, FR-008, research R2). In-process
 * and in memory: one service instance only, so with several instances an event would reach only the
 * streams on its own instance; a shared broker is a later spec. Events hold ids and names, never
 * documents (FR-005).
 */
@Component
class LiveEvents {

  /** Open streams one person may hold (FR-008). */
  static final int MAX_PER_USER = 5;

  /** What the page is told; the page re-reads what it shows (FR-005). */
  record Event(
      String kind,
      String proposal,
      Integer version,
      String baseline,
      String actor,
      OffsetDateTime at) {
    static Event of(String kind, String proposal, Integer version, String baseline, String actor) {
      return new Event(
          kind, proposal, version, baseline, actor, OffsetDateTime.now(ZoneOffset.UTC));
    }
  }

  /** One open connection of one person. */
  private record Stream(String subject, SseEmitter emitter) {}

  private final Map<String, Set<Stream>> streams = new ConcurrentHashMap<>();
  private final ObjectMapper json;

  @SuppressWarnings("FutureReturnValueIgnored") // ping() handles its own failures
  LiveEvents(ObjectMapper json) {
    this.json = json;
    ScheduledExecutorService beat =
        Executors.newSingleThreadScheduledExecutor(r -> {
          Thread t = new Thread(r, "live-heartbeat");
          t.setDaemon(true);
          return t;
        });
    // A comment line keeps proxies from closing a quiet stream (FR-007).
    beat.scheduleAtFixedRate(this::ping, 25, 25, TimeUnit.SECONDS);
  }

  /** A new stream that ends after {@code life} (the token's remaining life, FR-008). */
  synchronized SseEmitter open(String slug, String subject, Duration life) {
    long open =
        streams.values().stream()
            .flatMap(Set::stream)
            .filter(s -> s.subject().equals(subject))
            .count();
    if (open >= MAX_PER_USER) {
      throw new ApiErrors.TooManyStreams();
    }
    var emitter = new SseEmitter(Math.max(1, life.toMillis()));
    var stream = new Stream(subject, emitter);
    streams.computeIfAbsent(slug, k -> ConcurrentHashMap.newKeySet()).add(stream);
    Runnable gone = () -> streams.getOrDefault(slug, Set.of()).remove(stream);
    emitter.onCompletion(gone);
    emitter.onTimeout(emitter::complete);
    emitter.onError(e -> gone.run());
    try {
      emitter.send(SseEmitter.event().comment("open"));
    } catch (IOException e) {
      gone.run();
    }
    return emitter;
  }

  /** Tells every stream of the roadmap, once the surrounding transaction has committed (FR-006). */
  void publish(String slug, Event event) {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              send(slug, event);
            }
          });
    } else {
      send(slug, event);
    }
  }

  private void send(String slug, Event event) {
    String data = json.writeValueAsString(event);
    each(slug, s -> s.emitter().send(SseEmitter.event().data(data)));
  }

  private void ping() {
    streams
        .keySet()
        .forEach(slug -> each(slug, s -> s.emitter().send(SseEmitter.event().comment("ping"))));
  }

  /** One send to one stream. */
  private interface Send {
    void to(Stream s) throws IOException;
  }

  private void each(String slug, Send how) {
    for (Stream s : streams.getOrDefault(slug, Set.of())) {
      try {
        how.to(s);
      } catch (IOException | IllegalStateException e) {
        streams.get(slug).remove(s); // a closed connection; the page will reconnect
      }
    }
  }
}
