import { afterEach, expect, test, vi } from 'vitest';

// The adapter is faked: its renewal, redirect and PKCE are Keycloak's code and are covered end to end (smoke
// and the real-Keycloak tests). What is tested here is the policy around it (spec 002 FR-006, FR-018).
const kc = { token: 'old', init: vi.fn(), updateToken: vi.fn(), login: vi.fn(), logout: vi.fn() };
vi.mock('keycloak-js', () => ({
  default: vi.fn(function () {
    return kc;
  }),
}));
const { apiFetch } = await import('./auth.ts');

const answer = (status: number) => new Response('{}', { status });
const headers = (n: number) => (vi.mocked(fetch).mock.calls[n]![1] as RequestInit).headers;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.values(kc).forEach((f) => typeof f === 'function' && f.mockReset());
  kc.token = 'old';
});

test('renews before the call and sends the bearer token', async () => {
  kc.updateToken.mockResolvedValue(true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(200)));
  expect((await apiFetch('/api/x')).status).toBe(200);
  expect(kc.updateToken).toHaveBeenCalledWith(30);
  expect(headers(0)).toEqual({ authorization: 'Bearer old' });
});

test('a 401 forces one renewal and retries once with the new token', async () => {
  kc.updateToken.mockImplementation((s: number) => {
    if (s === -1) kc.token = 'new';
    return Promise.resolve(true);
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(answer(401)).mockResolvedValueOnce(answer(200)));
  expect((await apiFetch('/api/x')).status).toBe(200);
  expect(kc.updateToken).toHaveBeenCalledWith(-1);
  expect(headers(1)).toEqual({ authorization: 'Bearer new' });
  expect(kc.login).not.toHaveBeenCalled();
});

test('a second 401 sends the user back to sign-in rather than retrying again', async () => {
  kc.updateToken.mockResolvedValue(true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(401)));
  void apiFetch('/api/x');
  await vi.waitFor(() => expect(kc.login).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('a refused renewal (session over) sends the user back to sign-in', async () => {
  kc.updateToken.mockRejectedValue(new Error('refresh refused'));
  vi.stubGlobal('fetch', vi.fn());
  void apiFetch('/api/x');
  await vi.waitFor(() => expect(kc.login).toHaveBeenCalledOnce());
  expect(fetch).not.toHaveBeenCalled();
});
