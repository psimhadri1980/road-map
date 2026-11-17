package dev.roadmap;

import java.time.Duration;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Who may open an event stream (008-T001, FR-002): any member of the owning team, else 404. */
@Service
public class LiveService {

  private final ProposalRepository proposals;
  private final LiveEvents live;

  LiveService(ProposalRepository proposals, LiveEvents live) {
    this.proposals = proposals;
    this.live = live;
  }

  /** Opens the stream after the membership check, before anything is sent. */
  public SseEmitter open(String slug, Teams teams, String subject, Duration life) {
    var roadmap = proposals.findRoadmap(slug).orElseThrow(() -> new ApiErrors.NotFound(slug));
    if (!teams.has(roadmap.team())) {
      throw new ApiErrors.NotFound(slug);
    }
    return live.open(slug, subject, life);
  }
}
