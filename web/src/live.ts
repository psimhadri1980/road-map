import { apiFetch } from './auth.ts';

/** What the header says (008 FR-009): `off` means the service refused the stream, so changes need a manual refresh. */
export type LiveState = 'connecting' | 'live' | 'reconnecting' | 'off';

const BACKOFF_MAX = 30_000;
/** The service pings every 25 s; a stream silent for twice that is dead, so it is dropped and reopened. */
const SILENCE = 60_000;
/** A burst of events becomes one re-read (008 edge case). */
const COALESCE = 300;

type Open = (slug: string, signal: AbortSignal) => Promise<Response>;

/** The stream of one roadmap: `fetch`, because `EventSource` cannot send the Authorization header (008 R1). */
const openStream: Open = (slug, signal) =>
  apiFetch(`/api/roadmaps/${encodeURIComponent(slug)}/events`, {
    method: 'GET',
    headers: { accept: 'text/event-stream, application/json' },
    signal,
  });

/**
 * Keeps one live stream open for a roadmap until the returned function is called (008-T004, FR-009).
 * `onChange` is the page's re-read: it runs after every (re)connect, so nothing missed while away is lost, and
 * once per burst of events. Drops are retried with 1, 2, 4 … 30 s waits (plus jitter). A clean end (the token's
 * life is over) reopens at once with a fresh token. 404, 403 and 429 are final: the state becomes `off`.
 */
export function watch(
  slug: string,
  onChange: () => void,
  onState: (s: LiveState) => void,
  open: Open = openStream,
): () => void {
  const stop = new AbortController();
  let pending: ReturnType<typeof setTimeout> | undefined;
  const changed = () => {
    pending ??= setTimeout(() => {
      pending = undefined;
      onChange();
    }, COALESCE);
  };

  async function run() {
    let failures = 0;
    onState('connecting');
    while (!stop.signal.aborted) {
      const link = new AbortController();
      stop.signal.addEventListener('abort', () => link.abort(), { once: true });
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const quiet = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => link.abort(), SILENCE);
      };
      try {
        const res = await open(slug, link.signal);
        if (res.status === 404 || res.status === 403 || res.status === 429) return onState('off');
        if (!res.ok || !res.body) throw new Error(String(res.status));
        failures = 0;
        onState('live');
        onChange();
        quiet();
        const started = Date.now();
        const reader = res.body.getReader();
        const text = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          quiet();
          buffer += text.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          if (frames.some((f) => f.split('\n').some((l) => l.startsWith('data:')))) changed();
        }
        // A stream that ends at once is a fault, not a token's end: wait before reopening.
        if (Date.now() - started < 2000) failures += 1;
      } catch {
        if (stop.signal.aborted) return;
        failures += 1;
      } finally {
        clearTimeout(watchdog);
      }
      if (stop.signal.aborted) return;
      if (failures > 0) {
        onState('reconnecting');
        const wait = Math.min(BACKOFF_MAX, 1000 * 2 ** (failures - 1)) + Math.random() * 250;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  void run();
  return () => {
    stop.abort();
    clearTimeout(pending);
  };
}
