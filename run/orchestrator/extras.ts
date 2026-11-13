// An HTTP request to the front door (used by the smoke test) and doctor. Requests go to 127.0.0.1
// with the public Host header, so no name has to resolve.
import { existsSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { c, capture, log, RunError } from './log.ts';
import { loadComponents, PREFIX, RUN_DIR } from './components.ts';
import { baseEnv, ENGINE } from './env.ts';
import { containers, portOwner } from './runtime.ts';

/** An HTTP request to the gateway (127.0.0.1:RM_PORT) as the browser would send it. */
export function gatewayRequest(method: string, path: string, body?: string, bearer?: string, type = 'application/json'): Promise<{ status: number; body: string }> {
  const env = baseEnv();
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port: Number(env['RM_PORT']), method, path, timeout: 30_000,
      headers: { Host: `${env['RM_HOST']}:${env['RM_PORT']}`, ...(bearer && { Authorization: `Bearer ${bearer}` }), ...(body !== undefined && { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) }) },
    }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', (e) => reject(new RunError(`${method} ${path} through the gateway failed: ${e.message}`, { hint: 'is the gateway running? run/run.sh status' })));
    req.on('timeout', () => req.destroy(new Error('timed out')));
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** doctor: everything run.sh relies on, with what to do about each failure. */
export async function doctor(): Promise<number> {
  let bad = 0;
  const check = (what: string, ok: boolean, fix: string, warnOnly = false) => {
    if (ok) log.ok(what);
    else if (warnOnly) log.warn(`${what}: ${fix}`);
    else { bad++; log.error(`${what}: ${fix}`); }
  };
  log.phase('Doctor');
  const v = capture(ENGINE, ['version', '--format', '{{.Client.Version}}']).out.trim();
  check(`${ENGINE} ${v || 'missing'}`, /^[45]\./.test(v), 'install Podman 4.4 or later');
  check(`Node ${process.version}`, process.version.startsWith('v24.'), 'install Node 24 (.node-version)');
  const info = capture(ENGINE, ['info', '--format', '{{.Host.Security.Rootless}} {{.Host.CgroupsVersion}}']).out.trim();
  check(`rootless, cgroups ${info.split(' ')[1] ?? '?'}`, info.startsWith('true'), 'run Podman as your user', true);
  const ctl = capture('cat', [`/sys/fs/cgroup/user.slice/user-${process.getuid?.()}.slice/user@${process.getuid?.()}.service/cgroup.controllers`]).out;
  check('cgroup cpu and memory delegated (memory/cpu limits)', /memory/.test(ctl) && /cpu/.test(ctl), 'enable systemd delegation, or limits are ignored', true);
  try { loadComponents(); check(`component.yaml contract (${loadComponents().size} components)`, true, ''); } catch (e) { check('component.yaml contract', false, (e as Error).message); }
  const cons = containers();
  for (const comp of loadComponents().values()) {
    for (const p of Object.values(comp.ports)) {
      const owner = portOwner(p);
      if (!owner) continue;
      const ours = cons.get(comp.name)?.state === 'running' || existsSync(join(RUN_DIR, '.run/pids', `${comp.name}.json`));
      check(`port ${p} (${comp.name}) used by ${owner}`, ours, `free it, or another program holds one of this project's ports`, true);
    }
  }
  const restart = capture('systemctl', ['--user', 'is-enabled', 'podman-restart.service']).out.trim();
  check('podman-restart.service enabled (containers come back after a reboot)', restart === 'enabled', 'systemctl --user enable podman-restart.service, or run run/run.sh podman:stack:start after each boot', true);
  const running = [...cons.values()].find((x) => x.state === 'running' && x.health);
  if (running) check(`podman healthcheck run works (${running.name})`, capture(ENGINE, ['healthcheck', 'run', `${PREFIX}-${running.name}`]).code !== 125, 'healthcheck run is not supported: health checks will fail', true);
  log.raw(bad ? c.red(`\n${bad} problem(s)`) : c.green('\nall checks passed'));
  return bad ? 1 : 0;
}
