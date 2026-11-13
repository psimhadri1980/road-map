# Feature Specification: Walking Skeleton

**Feature Branch**: `001-walking-skeleton`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Walking skeleton for road-map. A developer checks out the repository and, with one command, brings up the whole application on their machine: the web front door, the roadmap service, the database, the cache and the identity provider. Opening the application in a browser shows one seeded sample roadmap rendered as a Gantt chart, read from the database through the cache. Every connection between the parts is encrypted and verified, and only the front door is reachable from outside the machine; the database and cache refuse unencrypted connections. The same single entry point (the command design taken from the D4 workspace: build, deploy, start, stop, reset, status, logs, test, format) is used by developers and by continuous integration. All quality gates from the constitution run on every pull request from this first feature on. Out of scope: user sign-in and token enforcement (spec 002), teams and access control (003), editing, Proposals, versions, live events. The roadmap is read-only here. The Gantt chart comes from the existing gantt library, consumed as a pinned third-party dependency and not modified."

## Clarifications

### Session 2026-11-13

- Q: With no sign-in until spec 002, how is the sample roadmap exposed? → A: The front door listens on the local machine only (127.0.0.1); the open roadmap is sample data.
- Q: Host network as in D4, or a private container network? → A: Same as D4: host network, every port bound to the local machine, encryption and credentials on each.
- Q: Which runtimes does the roadmap service support through the entry point? → A: Container only; the web application also keeps D4's local runtime.
- Q: Where do the pull-request gates run? → A: GitHub Actions hosted runners.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See a roadmap end to end (Priority: P1)

A developer who has just checked out the repository runs one command. The whole application
starts on their machine. They open the application's address in a browser and see the sample
roadmap drawn as a Gantt chart: its tasks, their bars on the timeline, and the links between them.

**Why this priority**: This proves every part of the system is connected — front door, service,
database, cache and chart — before any feature is built on top. Nothing else has value until it works.

**Independent Test**: From a clean checkout on a machine with the documented prerequisites, run
the deploy command, open the address it prints, and compare the chart with the sample roadmap.

**Acceptance Scenarios**:

1. **Given** a clean checkout and the documented prerequisites, **When** the developer runs the
   single deploy command, **Then** every component starts, each reports healthy, and the command
   prints the address of the application.
2. **Given** the application is running, **When** the developer opens its address in a browser,
   **Then** the sample roadmap is shown as a Gantt chart with every task and link of the sample.
3. **Given** the roadmap has been shown once, **When** it is requested again, **Then** it is
   served from the cache without reading the database, and the content is identical.
4. **Given** the cache has been emptied, **When** the roadmap is requested, **Then** it is read
   from the database, shown correctly, and placed in the cache again.
5. **Given** the application is running, **When** the developer tries to change the roadmap in
   the chart, **Then** no change is possible and nothing is stored.

---

### User Story 2 - One entry point for every task (Priority: P2)

A developer builds, starts, stops, resets, inspects, tests and formats the application through
one command with one grammar — the same one used in the D4 workspace — for the whole stack or
for a single component. Continuous integration uses exactly the same commands.

**Why this priority**: Consistent commands across projects remove a class of "works on my
machine" failures and make every later feature cheaper to build and verify.

**Independent Test**: Run each command against the whole stack and against one component, and
confirm the result each time; confirm the CI definition calls only this entry point.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the developer asks the entry point for help or a list of
   components, **Then** it shows every component, the commands available, and examples.
2. **Given** the stack is running, **When** the developer asks for status, **Then** each
   component is listed with where it runs, its state and its health.
3. **Given** the stack is running, **When** the developer stops, starts or resets one component,
   **Then** only that component is affected and status reflects it.
4. **Given** a prerequisite is missing, **When** any command is run, **Then** it stops with a
   message naming what is missing and how to install it.
5. **Given** a developer familiar with the D4 workspace, **When** they use the same command
   forms here, **Then** the forms are accepted and mean the same thing.

---

### User Story 3 - Nothing travels in clear text (Priority: P2)

An operator can verify that every connection between components is encrypted with the other
side's identity checked, that no component can be reached from another machine, and
that no secret or private key is stored in the repository.

**Why this priority**: Security added after the first feature is security retrofitted. The
skeleton sets the pattern every later component follows.

**Independent Test**: Attempt an unencrypted connection to each internal component and a
connection from another machine to each one; inspect the repository for secrets.

**Acceptance Scenarios**:

1. **Given** the stack is running, **When** an unencrypted connection to the database or the
   cache is attempted, **Then** it is refused.
2. **Given** the stack is running, **When** a component is presented with a certificate that was
   not issued by the project's certificate authority, **Then** the connection fails.
3. **Given** the stack is running, **When** another machine on the network tries to reach any
   component, the front door included, **Then** it cannot.
4. **Given** a clean checkout, **When** the stack is deployed for the first time, **Then** the
   certificates and secrets it needs are created locally and none of them is tracked by the repository.
5. **Given** the application is open in a browser, **When** the response is inspected, **Then**
   it carries the security headers that restrict framing, content sources and transport.

---

### User Story 4 - Every change is checked the same way (Priority: P3)

A contributor opens a pull request. Formatting is applied automatically before the commit is
made, and the full set of quality gates runs on the pull request. A failing gate blocks the merge.

**Why this priority**: Gates that start with the first feature never have a backlog of
violations to excuse. They are P3 only because they need stories 1–3 to have something to check.

**Independent Test**: Open pull requests that each break one gate (unformatted file, lint
violation, known-vulnerable dependency, committed secret, failing test) and confirm each is blocked.

**Acceptance Scenarios**:

1. **Given** a contributor commits an unformatted file, **When** the commit is made, **Then**
   the file is formatted automatically and the commit contains the formatted version.
2. **Given** a pull request containing an unformatted file, **When** the gates run, **Then** the
   formatting check fails and the merge is blocked.
3. **Given** a pull request that violates any one gate — lint, static analysis, security
   analysis, a test, container scan, secret scan or dependency review — **When** the gates run,
   **Then** that gate fails, names the problem, and the merge is blocked.
4. **Given** a pull request that passes every gate, **When** the gates finish, **Then** the
   merge is allowed.
5. **Given** the test gate runs, **When** it exercises the service, **Then** it does so against
   a real database, cache and identity provider, not substitutes.

---

### Edge Cases

- A port the stack needs is already in use: the deploy command stops and names the port and component.
- A component fails to become healthy within its time limit: deploy fails, names the component
  and points to its logs; the other components are left as they are for inspection.
- The database is unavailable while the roadmap is in the cache: the roadmap is still shown.
- The database and the cache are both unavailable: the browser shows a plain error message, not
  a blank page or internal details.
- The cache is unavailable but the database is not: the roadmap is still shown, read from the database.
- The stored sample roadmap does not match the roadmap document format: the service refuses to
  serve it and reports the validation failure.
- Deploy is run twice: the second run changes nothing and reports the stack as already healthy.
- Reset is requested: it asks for confirmation before deleting stored data.
- A certificate has expired: the affected connection fails and the status command names the certificate.

## Requirements _(mandatory)_

### Functional Requirements

**Running the application**

- **FR-001**: The system MUST start the complete application — front door, roadmap service,
  database, cache and identity provider — from a clean checkout with a single command.
- **FR-002**: The system MUST report each component as healthy or not, and the deploy command
  MUST succeed only when all are healthy. Each component declares its own health time limit;
  deploy waits no longer than that limit for each component. Running deploy on a healthy stack
  MUST change nothing.
- **FR-003**: The system MUST store one sample roadmap in the database on first start, without
  manual steps, and MUST NOT duplicate it on later starts.
- **FR-004**: The system MUST show the sample roadmap as a Gantt chart in a browser, using the
  existing gantt library unmodified and pinned to an exact revision.
- **FR-005**: The roadmap MUST be read-only in this feature: no user action stores a change.
- **FR-006**: The system MUST check the stored roadmap against the gantt roadmap document format
  before serving it, and refuse to serve a roadmap that does not conform.

**Cache**

- **FR-007**: A roadmap request MUST be answered from the cache when the roadmap is there, and
  otherwise read from the database and placed in the cache.
- **FR-008**: When the cache is unavailable, the roadmap MUST still be served from the database.

**Entry point**

- **FR-009**: The system MUST provide one entry point with the command grammar and command set
  of the D4 workspace: build, deploy, start, stop, reset, status, logs, test, exec and shell,
  addressed to the whole stack or to named components, plus help, component list and a
  prerequisite check.
- **FR-010**: The entry point MUST add one command, format, which rewrites source files to the
  project's formatting rules, and a check-only form that fails when any file would change.
- **FR-011**: Continuous integration MUST run builds, tests and checks only through this entry
  point, on GitHub Actions hosted runners.
- **FR-011a**: The roadmap service MUST run as a container; the web application MUST also run
  as a local process for development.
- **FR-012**: Each component MUST describe itself in one declaration file in its own folder,
  which the entry point validates on every run.

**Security**

- **FR-013**: Every connection between components MUST be encrypted, and the connecting side
  MUST verify the other side's certificate against the project's certificate authority.
- **FR-014**: The database and the cache MUST refuse unencrypted connections.
- **FR-015**: Every component, the front door included, MUST listen on the local machine only
  (127.0.0.1) in this feature; none is reachable from another machine.
- **FR-016**: The database and the cache MUST each accept only the credentials issued to the
  components that use them, with the least privileges those components need.
- **FR-017**: Certificates, private keys and credentials — development passwords included — MUST
  be created locally on first use and MUST NOT be tracked by the repository. (This differs from
  the D4 workspace, which tracks its development passwords.)
- **FR-017a**: Certificates MUST be valid for one year. The status command MUST warn when a
  certificate expires within 30 days. A missing, unreadable, empty or malformed certificate, key
  or secret file MUST stop deploy with a message naming the file; deleting the files and
  deploying again MUST create new ones without losing stored data.
- **FR-017b**: No secret, private key or credential MUST appear in any log or command output.
- **FR-018**: Every component MUST run without administrator privileges and without write access
  to its own program files.
- **FR-019**: The front door MUST send `Strict-Transport-Security` (one year),
  `Content-Security-Policy` (own origin only, no framing), `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`, and MUST limit each client to 10 requests per second with a
  burst of 20.

**Quality gates**

- **FR-020**: Formatting MUST be applied automatically when a contributor commits.
- **FR-021**: Every pull request MUST run: the formatting check, linting, static analysis,
  security analysis, tests, container image scanning, secret scanning and dependency review.
- **FR-022**: A failing gate MUST block the merge and MUST name the file or finding that caused it.
- **FR-023**: Tests MUST run against a real database, cache and identity provider.
- **FR-024**: Tests MUST include: the roadmap is served end to end; the second request is served
  from the cache; an unencrypted connection to the database and to the cache is refused.
- **FR-025**: Every source file MUST meet the constitution's comment standard (Principle VI),
  checked by a gate.

**Operation alongside D4**

- **FR-026**: Any command run without the gantt library checked out MUST stop with a message
  saying how to fetch it.
- **FR-027**: The application MUST run on the same machine as the D4 workspace at the same time,
  without sharing names or ports with it.

**Out of scope** (later features): sign-in and token checks; teams and access control; editing,
Proposals, versions and baselines; live events; more than one roadmap.

### Key Entities

- **Roadmap**: One named roadmap and its content in the gantt roadmap document format (tasks,
  links and settings). In this feature exactly one exists, seeded from the gantt library's sample.
- **Component**: One runnable part of the application (front door, web application, roadmap
  service, database, cache, identity provider) with a name, a way to start it, a health check,
  and the components it depends on.
- **Certificate authority and certificates**: The project's own authority and one certificate
  per component, used to encrypt and verify connections. Local to each machine.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer with the documented prerequisites goes from a clean checkout to seeing
  the roadmap in a browser with one command and in under 15 minutes on first run.
- **SC-002**: With everything already built, the stack goes from stopped to all components
  healthy in under 2 minutes.
- **SC-003**: The roadmap appears within 2 seconds of opening the application.
- **SC-004**: 100% of connections between components are encrypted and verified; an attempt to
  connect without encryption fails for every internal component.
- **SC-005**: No component accepts a connection from another machine.
- **SC-006**: A scan of the repository and its history finds zero secrets or private keys.
- **SC-007**: Each of the eight gates blocks a pull request that violates it; a compliant pull
  request receives a result from all gates in under 15 minutes.
- **SC-008**: Every command form documented for the D4 workspace entry point that applies to
  this project is accepted with the same meaning.

## Assumptions

- The application runs on one developer or CI machine. Production deployment and public
  certificates are outside this feature.
- With no sign-in yet, the sample roadmap is readable by anyone who can reach the front door.
  This is acceptable only because the roadmap is sample data and the front door listens on the
  local machine; spec 002 closes it.
- The identity provider is started and health-checked here but nothing depends on it until spec 002.
- The sample roadmap is the small sample shipped with the gantt library.
- The gantt library is used as it is today. Changes it needs for later features (licence, token
  support, conformance suite) are made in its own repository and are not required here.
- Prerequisites on the machine are the container runtime and the runtime the entry point needs;
  everything else is built inside containers.
- The entry point starts as a copy of the D4 workspace's `run/` folder, adapted only where this
  project differs.
- The gantt library builds with pnpm once psimhadri1980/gantt#10 is merged. Until then the
  submodule cannot be pinned and the web application cannot be built.
- Continuous integration runners may provide an older container runtime (Podman 4.9 on Ubuntu
  24.04) than developer machines; the first CI task establishes which version runs there.

## Amendments after checklist (2026-11-13)

FR-002, FR-017, FR-017a, FR-017b, FR-019, FR-026, FR-027 and the last two assumptions were added or
made specific after the requirements checklists in `checklists/security.md` and
`checklists/gates.md` (items CHK002, CHK004, CHK006, CHK007, CHK010, CHK013–CHK015, CHK019,
CHK026, CHK028, CHK029, CHK032, CHK033).
