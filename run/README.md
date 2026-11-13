> **Provenance.** Copied from D4 (`psimhadri1980/d4`) at commit `3388748` in T001; adapted for
> road-map in T002 (spec 001). Changes against D4: name prefix `rm` (one constant, `PREFIX` in
> `orchestrator/components.ts`), contract `road-map/v1`, no tenants, ops, cli, publish, observability,
> knip, Neo4j or S3 wiring, no old-compose clean-up, no browser (`e2e`) suite yet, no committed
> secrets (`secrets/dev.env` is generated, FR-017). Still D4-shaped and reworked by later tasks:
> the Node/turbo test path, gateway TLS and `host.conf` (T007-T009).
> To carry a later D4 fix across, diff D4's `run/` from `3388748` to its new commit.

# run/

The one entry point for building, running and testing road-map:

```bash
run/run.sh [<runtime>:]<component>:<command> [args] [-- passthrough] [--verbose] [--yes] [--json]
run/run.sh ls | status | doctor | help [component]
```

- **runtime:** `local` (a process on local Node 24) or `podman` (a container on the host network); optional, each component has a default.
- **component:** a name, a category (`ui`, `service`, `infra`, `tool`), a group, `stack` or a list (`api,worker`).
- **command:** `build`, `deploy`, `start`, `stop`, `reset`, `status`, `logs`, `test`, `exec`, `shell`.

.

## What is here

| Path                           |                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run.sh`                       | Finds Node 24 (nvm when needed), installs the workspace on first use, runs the orchestrator                                                                                                                                                                                                                       |
| `orchestrator/`                | TypeScript run directly by Node: contract parsing and selection (`components.ts`), settings (`env.ts`), compile and images (`build.ts`), containers, processes and health (`runtime.ts`), the commands (`lifecycle.ts`), tests (`test.ts`), the front-door request and `doctor` (`extras.ts`), logging (`log.ts`) |
| `schema/component.schema.json` | The `component.yaml` contract (road-map/v1); editors validate against it                                                                                                                                                                                                                                          |
| `env/`                         | Shared settings: `common.env`, `images.env` (pinned images), `prod.env`; your git-ignored `local.env` wins                                                                                                                                                                                                        |
| `certs/`                       | The organization CA and gateway TLS files (git-ignored; see its README)                                                                                                                                                                                                                                           |
| `secrets/`                     | Generated passwords, `dev.env` (git-ignored)                                                                                                                                                                                                                                                                      |
| `.run/`                        | State (git-ignored): `logs/`, merged `env/<runtime>/<component>.env`, `pids/`, `deps/`, `tools/` (the pinned pnpm)                                                                                                                                                                                                |

Component-specific settings do not belong here: they live in each component's `component.yaml`. The browser-facing origin lives in `/host.conf`.

## Adding a component

1. Create `component.yaml` in its folder (`apps/<name>/`, `packages/<name>/` or `infra/<name>/`), starting from a similar one, with a port of its own.
2. For a built image, add a thin `Containerfile` that copies `deps/`, `app/` and `certs/` from the staged context.
3. Check it with `run/run.sh ls` (the contract is enforced on every run) and start it with `run/run.sh <name>:deploy`.
