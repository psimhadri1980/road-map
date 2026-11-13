package dev.roadmap;

import jakarta.validation.constraints.Pattern;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP for roadmaps (T017): nothing but the request and the response; the rules are in the service.
 */
@RestController
@Validated
public class RoadmapController {

  private final RoadmapService service;

  RoadmapController(RoadmapService service) {
    this.service = service;
  }

  /** The roadmap in the gantt-roadmap/1 format; the document is passed through as stored. */
  @GetMapping(path = "/api/roadmaps/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
  public String get(@PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{0,62}$") String slug) {
    return service.document(slug);
  }
}
