import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { watch, type LiveState } from './live.ts';

/** A stream the test feeds by hand. */
function stream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
  const enc = new TextEncoder();
  return {
    res: new Response(body, { status: 200 }),
    push: (t: string) => controller.enqueue(enc.encode(t)),
    fail: () => controller.error(new Error('dropped')),
    end: () => controller.close(),
  };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('goes live, re-reads on connect, drops to reconnecting with backoff and re-reads again', async () => {
  const a = stream();
  const b = stream();
  const open = vi.fn().mockResolvedValueOnce(a.res).mockResolvedValueOnce(b.res);
  const states: LiveState[] = [];
  const read = vi.fn();
  const stop = watch('alpha', read, (s) => states.push(s), open);
  await settle();
  expect(states).toEqual(['connecting', 'live']);
  expect(read).toHaveBeenCalledTimes(1); // after connect

  a.fail();
  await settle();
  expect(states.at(-1)).toBe('reconnecting');
  await vi.advanceTimersByTimeAsync(1300); // first wait is 1 s plus jitter
  expect(states.at(-1)).toBe('live');
  expect(read).toHaveBeenCalledTimes(2); // re-read after the reconnect
  stop();
});

test('a burst of events is one re-read; comments are not events', async () => {
  const a = stream();
  const read = vi.fn();
  const stop = watch('alpha', read, () => undefined, vi.fn().mockResolvedValue(a.res));
  await settle();
  read.mockClear();
  a.push(': ping\n\n');
  await vi.advanceTimersByTimeAsync(500);
  expect(read).not.toHaveBeenCalled();
  a.push('data: {"kind":"currentChanged"}\n\ndata: {"kind":"baselineSaved"}\n\ndata: {"kind":"proposalCreated"}\n\n');
  await vi.advanceTimersByTimeAsync(500);
  expect(read).toHaveBeenCalledTimes(1);
  stop();
});

test('a refused stream (429) is final: off, and no retry', async () => {
  const open = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
  const states: LiveState[] = [];
  watch('alpha', vi.fn(), (s) => states.push(s), open);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(states).toEqual(['connecting', 'off']);
  expect(open).toHaveBeenCalledTimes(1);
});

test('a stream silent for a minute is dropped and reopened', async () => {
  const a = stream();
  const b = stream();
  const open = vi.fn().mockImplementation((_s: string, signal: AbortSignal) => {
    const next = open.mock.calls.length === 1 ? a : b;
    signal.addEventListener('abort', () => next.fail());
    return Promise.resolve(next.res);
  });
  const states: LiveState[] = [];
  const stop = watch('alpha', vi.fn(), (s) => states.push(s), open);
  await settle();
  await vi.advanceTimersByTimeAsync(61_000);
  expect(states).toContain('reconnecting');
  await vi.advanceTimersByTimeAsync(2_000);
  expect(open).toHaveBeenCalledTimes(2);
  expect(states.at(-1)).toBe('live');
  stop();
});
