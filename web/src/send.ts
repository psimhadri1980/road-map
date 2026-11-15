import { apiFetch } from './auth.ts';

/** A write to the service. A refusal throws the service's own message (`{error}`), shown as it is (010 FR-006). */
export async function send(path: string, body?: unknown): Promise<unknown> {
  const r = await apiFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
  if (r.ok) return r.json();
  const said = (await r.json().catch(() => ({}))) as { error?: unknown };
  throw new Error(typeof said.error === 'string' ? said.error : 'The service refused the request.');
}
