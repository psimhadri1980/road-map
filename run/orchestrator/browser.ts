import { spawn } from 'node:child_process';
import { X509Certificate, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunError } from './log.ts';

/**
 * Loads `url` in headless Chrome and returns what `script` evaluates to once it is truthy (polled for
 * up to `seconds`). Chrome is driven over the DevTools protocol with Node's own WebSocket, so the
 * smoke test needs no browser-automation dependency. Certificates stay verified: only the front
 * door's own key is trusted (its SPKI hash), not "any certificate".
 */
export async function browse(url: string, certFile: string, script: string, seconds = 30): Promise<unknown> {
  const spki = createHash('sha256').update(new X509Certificate(readFileSync(certFile)).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
  const profile = mkdtempSync(join(tmpdir(), 'rm-chrome-'));
  const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--ignore-certificate-errors-spki-list=${spki}`, '--window-size=1400,900', 'about:blank',
  ], { stdio: 'ignore' }).on('error', () => undefined);
  try {
    const port = await devtoolsPort(profile);
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()) as { webSocketDebuggerUrl: string };
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new RunError('cannot reach headless Chrome')); });
    let id = 0;
    const evaluate = (expression: string) => new Promise<unknown>((ok) => {
      const mine = ++id;
      ws.addEventListener('message', function on(e) {
        const m = JSON.parse(String(e.data)) as { id?: number; result?: { result?: { value?: unknown } } };
        if (m.id === mine) { ws.removeEventListener('message', on); ok(m.result?.result?.value); }
      });
      ws.send(JSON.stringify({ id: mine, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    });
    for (const end = Date.now() + seconds * 1000; Date.now() < end; await new Promise((r) => setTimeout(r, 300))) {
      const value = await evaluate(script);
      if (value) return value;
    }
    throw new RunError(`the page did not show what was expected within ${seconds}s`, { tail: [String(await evaluate('document.body.innerText.slice(0, 500)'))] });
  } finally {
    chrome.kill();
    await new Promise((r) => chrome.once('exit', r)); // Chrome writes into the profile until it exits
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
}

/** Chrome writes its chosen debugging port into the profile folder once it is listening. */
async function devtoolsPort(profile: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try { return readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]!; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new RunError('headless Chrome did not start (set CHROME to its path)');
}
