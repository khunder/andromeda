# Andromeda

**Andromeda is a BPMN workflow engine built around code generation.**

Most workflow engines interpret a process definition at runtime. Andromeda doesn't: it **compiles** a BPMN
diagram into a fully functional, standalone Node.js application, called a **container**. A container is
conceptually a microservice: it exposes a REST API to start and drive process instances, persists its own
state, and can run next to the engine during development or be shipped and deployed on its own.

> "Container" in this project always means *a generated Node.js app*, not a Docker container (although a
> generated container can of course be packaged into a Docker image).

---

## Table of contents

- [Why Andromeda](#why-andromeda)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Typical workflow](#typical-workflow)
- [REST APIs](#rest-apis)
- [Supported BPMN elements](#supported-bpmn-elements)
- [Architecture](#architecture)
- [Deployment modes](#deployment-modes)
- [Testing](#testing)
- [Project conventions](#project-conventions)
- [Further documentation](#further-documentation)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why Andromeda

- **Code generation instead of interpretation.** Each workflow becomes plain, readable JavaScript. When
  something goes wrong, stack traces point at real generated code that you can open, read, and step through
  with a debugger.
- **One workflow, one microservice.** Every container is independently deployable and scalable, and it
  carries only the modules it needs.
- **Plain ES6, no build step.** The engine and the code it generates are pure ES modules: no TypeScript and
  no transpiler. The engine and generated containers start instantly, and errors point to the source line.
  See [`packages/engine/docs/index.md`](packages/engine/docs/index.md) for the rationale.
- **Event-sourced persistence.** Process-instance state is rebuilt from an append-only event log with
  snapshots, so the history of every instance can be inspected and replayed.
- **Reusable modules.** The same `persistence`, `galaxy`, and `web` modules run inside the engine and are
  copied as-is into generated containers. Nothing is implemented twice.

---

## Repository layout

```
andromeda/
├── packages/
│   ├── engine/      @andromeda/engine   – engine, code generator, REST APIs (plain ES6 JavaScript)
│   └── designer/    @andromeda/designer – BPMN diagramming UI (TypeScript + Vite + bpmn-js)
├── CHANGELOG.md     detailed, dated change history
├── Roadmap.md       planned and completed work
└── package.json     npm workspaces root
```

### `packages/engine`

```
packages/engine/
├── bootstrap.js / app.js        engine entry point; boots modules listed in ACTIVE_MODULES
├── src/
│   ├── config/                  Config singleton, constants, logger (pino)
│   ├── model/                   codegen contexts (container / workflow parsing contexts)
│   ├── modules/
│   │   ├── engine/              code generator: WorkflowBuilder, BPMN processors, templates, embedded containers
│   │   ├── persistence/         event store, repositories, PersistenceGateway (MongoDB or SQLite)
│   │   ├── galaxy/              runtime-state query API and container registry
│   │   └── web/                 Fastify app; auto-loads every file in src/routes/
│   ├── routes/                  engine-level HTTP routes (compile, run-embedded, galaxy, probes…)
│   └── utils/                   BPMN parsing helpers, OpenAPI generator…
├── test/                        integration / e2e tests and BPMN fixtures (test/resources/*.bpmn)
├── docs/                        design notes (index.md, EventSourcing.md)
└── deployments/                 GENERATED containers, one folder per deployment (do not edit)
```

### `packages/designer`

A browser-based BPMN editor built on `bpmn-js`, used to author the diagrams the engine compiles. It can
compile and run diagrams against a local engine and start or inspect process instances through Galaxy.
See [`packages/designer/README.md`](packages/designer/README.md) and
[`packages/designer/docs/`](packages/designer/docs). Parts of the designer README still describe the
older custom SVG renderer.

---

## Prerequisites

| Tool    | Version                                                                 |
|---------|-------------------------------------------------------------------------|
| Node.js | **>= 22.6.0** (enforced via `engines`)                                  |
| npm     | ships with Node (workspaces support required)                           |
| MongoDB | optional: only for `PERSISTENCE_DRIVER=mongodb`. The default SQLite driver (`sql.js`) needs no database server |

---

## Getting started

```bash
# 1. Install dependencies (from the repo root)
npm install

# 2. Configure the engine
#    create packages/engine/.env (see "Configuration" below)

# 3. Run the engine (http://localhost:5000)
npm start

# 4. In another terminal, run the designer dev server
npm run designer:dev
```

Every engine command must run with the working directory set to `packages/engine/`. The engine resolves
runtime paths (deployments, SQLite file, PID files) from `process.cwd()`. Either use the root aliases or
the `--workspace` flag:

```bash
npm run <script> --workspace=@andromeda/engine
# or
cd packages/engine && npm run <script>
```

Do not run `node packages/engine/bootstrap.js` from the repo root.

---

## Configuration

The engine reads its configuration from `packages/engine/.env` through the `Config` singleton
(`src/config/config.js`). Code should call `Config.getInstance()` instead of reading `process.env` directly.

```properties
# Which modules this process boots (comma-separated): server, web, persistence, galaxy
ACTIVE_MODULES=server,web,persistence,galaxy

# Environment: local | test | ...  (local/dev also starts the embedded sidecar daemon)
ENV=local

# Persistence backend: sqlite (default) | mongodb
# PERSISTENCE_DRIVER=sqlite
# SQLITE_FILE_PATH=./andromeda.sqlite   # default: andromeda.sqlite in packages/engine
# MONGODB_URI=mongodb://127.0.0.1:27017/andromeda   # only for PERSISTENCE_DRIVER=mongodb

# Where containers find Galaxy (when it is not embedded)
# GALAXY_HOST=localhost
# GALAXY_PORT=5001
# GALAXY_URL=http://localhost:5001
```

| Variable             | Purpose                                                                  |
|----------------------|--------------------------------------------------------------------------|
| `ACTIVE_MODULES`     | Modules to boot (`server`, `web`, `persistence`, `galaxy`)               |
| `ENV`                | Runtime environment (`local`, `test`, …)                                 |
| `PERSISTENCE_DRIVER` | `sqlite` (default, WASM `sql.js`, no native build) or `mongodb`          |
| `SQLITE_FILE_PATH`   | SQLite database file (default `andromeda.sqlite` in `packages/engine`)   |
| `MONGODB_URI`        | MongoDB connection string, only needed with `PERSISTENCE_DRIVER=mongodb` |

> **SQLite starts empty on every engine start (when the engine runs `persistence`).** An engine with
> `persistence` in `ACTIVE_MODULES` deletes and recreates its SQLite file when it boots, including on every
> nodemon reload, so process instances, tasks, variables and timers don't survive an engine restart.
> Containers never reset the file, they attach to it (creating it if missing), so with an engine that
> doesn't run `persistence` the file is kept. Use `PERSISTENCE_DRIVER=mongodb` when runtime state must
> outlive the engine process.
| `GALAXY_HOST` / `GALAXY_PORT` / `GALAXY_URL` | Location of a standalone Galaxy instance         |

---

## Typical workflow

1. **Design** a process in the designer, or write a `.bpmn` file by hand.
   - The `<bpmn:definitions id="...">` id becomes the process definition name and namespaces the generated
     routes.
   - An optional `version="x.y.z"` attribute on `<bpmn:definitions>` sets the workflow version (default
     `1.0.0`).
2. **Compile** it with `POST /api/compile`. The engine generates a container in
   `packages/engine/deployments/<deploymentId>_<version>/`. For example, `1.2.0` becomes `1_2_0`, so one
   deployment id can have several versions side by side.
3. **Run** it:
   - locally next to the engine with `POST /api/run-embedded`, which starts it as a child process on a
     free port from 10000 upward, or
   - on its own: install the generated app's dependencies and start its `bootstrap.js`, or package it into
     an image.
4. **Drive** process instances through the container's generated REST API (`start`, `signal`, `tasks`).
5. **Inspect** runtime state (instances, variables, pending human tasks) through Galaxy.

To change generated code, edit the engine's templates and processors, then recompile. Don't edit files
under `deployments/` by hand: they are overwritten on the next compile.

---

## REST APIs

### Engine (`localhost:5000`)

| Method | Path                  | Description                                                                     |
|--------|-----------------------|---------------------------------------------------------------------------------|
| POST   | `/api/compile`        | Multipart: one or more BPMN files plus `deploymentId` (and optional `includeGalaxyModule=true`). Generates a container. |
| POST   | `/api/run-embedded`   | Multipart, same inputs: compile, then run the container as an embedded child process |
| POST   | `/api/stop-embedded`  | Stop an embedded container                                                      |
| POST   | `/galaxy/heartbeat`   | Containers register and keep themselves alive in the Galaxy registry            |
| GET    | `/galaxy/containers`  | List registered containers                                                      |
| POST   | `/galaxy/remove`      | Remove a container from the registry                                            |
| POST   | `/galaxy/clear`       | Clear the registry                                                              |
| GET    | `/live`, `/ready`     | Liveness and readiness probes                                                   |

Example compile:

```bash
curl -X POST http://localhost:5000/api/compile \
  -F "deploymentId=orders" \
  -F "files=@./orders.bpmn"
```

Several BPMN files can be compiled into one container. Each file must have a unique
`<bpmn:definitions id>`, and all files must declare the same version.

### Generated container

Every container serves a generated OpenAPI specification (`specification.yaml`), and its routes are
namespaced by process definition:

| Method | Path                          | Description                                                          |
|--------|-------------------------------|----------------------------------------------------------------------|
| POST   | `/<processDef>/start`         | Start a process instance. Body: `{ "variables": { ... } }` (JSON or multipart). Returns `{ id }`. |
| POST   | `/<processDef>/signal`        | Resume an instance paused at a catch event or human task. Body: `{ processInstanceId, nodeId, variables? }`. Returns 404 if the instance or node is unknown and 409 if the instance is not waiting at that node. |
| GET    | `/<processDef>/tasks`         | List pending tasks (human tasks or catch events) that can be completed with `/signal` |
| GET    | `/api/containers`             | Describe this container: base id, resolved deployment id, version, served process defs |
| GET    | `/live`, `/ready`             | Liveness and readiness probes                                        |

Example:

```bash
curl -X POST http://localhost:10000/Orders/start \
  -H "Content-Type: application/json" \
  -d '{"variables": {"age": 20}}'
```

---

## Supported BPMN elements

| Element                                   | Status | Notes                                                    |
|-------------------------------------------|--------|----------------------------------------------------------|
| Start event                               | ✅     | Started through `POST /start`                            |
| Timer start event                         | ✅     | `timeCycle` cron expression schedules instance creation  |
| End event                                 | ✅     |                                                          |
| Sequence flow, including conditional flow | ✅     | Conditions evaluated against process variables           |
| Exclusive (XOR) gateway                   | ✅     | Conditional branching                                    |
| Parallel gateway (fork and join)          | ✅     | Join waits for all incoming branches                     |
| Script task                               | ✅     | Runs in a worker thread. Scripts read and write `this.variables` |
| User (human) task                         | ✅     | Pauses the instance. Listed in `/tasks`, completed through `/signal` |
| Intermediate catch event (signal/message) | ✅     | Pauses until `POST /signal`. Survives restarts           |
| Intermediate timer catch event            | ✅     | `timeDuration` (ISO 8601) or `timeDate`; durable across restarts |
| Custom task (extends script task)         | 🚧     | Planned                                                  |
| Signal throw (same or other process)      | 🚧     | Planned                                                  |
| Catch-event correlation                   | 🚧     | Planned                                                  |

Example script task body:

```js
this.variables.age = this.variables.age + 1;
```

---

## Architecture

### Module system

`App.init()` (`packages/engine/app.js`) dynamically imports and starts only the modules listed in
`ACTIVE_MODULES`:

| Module        | Entry point                                   | Role                                                                      |
|---------------|-----------------------------------------------|---------------------------------------------------------------------------|
| `server`      | `src/modules/engine/engine.module.js`         | The engine and code generator. In local/dev mode it also starts the embedded sidecar daemon |
| `web`         | `src/modules/web/web.module.js`               | Fastify app. Routes are auto-discovered from `src/routes/*` by `@fastify/autoload` |
| `persistence` | `src/modules/persistence/persistence.module.js` | Event-sourced storage behind the `PersistenceGateway`                  |
| `galaxy`      | `src/modules/galaxy/galaxy.module.js`         | Queries runtime state (instances, variables, human-task forms) and keeps the container registry. Depends on `persistence` |

To add a route, put a file in `src/routes/`. The web module picks it up without any manual registration.
The same mechanism lets generated containers add their own routes without changing the web module.

### Code generation pipeline

```
 .bpmn ──► bpmn-moddle ──► WorkflowBuilder ──► BpmnProcessor ──► processors/*  ──► templates ──► deployments/<id>_<ver>/
             (parse)       (walk from each     (dispatch by      (start, end,       (.njk / .snjk,
                            start event)        node type)        script, gateways,   ts-morph)
                                                                  human task,
                                                                  catch event)
```

`EngineService.generateContainer()` (`src/modules/engine/engine.service.js`) runs the build:

1. **Copy shared modules.** The container gets the `persistence`, `galaxy`, and `web` modules it needs,
   copied verbatim from `src/modules/`.
2. **Materialize templates** from `src/modules/engine/builder/templates/`:
   - `*.snjk` (static njk) files are copied byte for byte with the extension removed, for example
     `package.json.snjk` becomes `package.json`.
   - `*.njk` files are rendered with Nunjucks to produce per-workflow code (services, controllers, routes,
     timer service, registry).
   - Dynamic method bodies are injected into generated classes with `ts-morph`.
3. **Emit `specification.yaml`.** The OpenAPI spec is built from the codegen context.

A generated container has its own `bootstrap.js` and `app.js`, structured like the engine's `App` class.

### Persistence

- **Event sourcing.** Every state change of a process instance, flow event, or task is appended to an event
  log. `ReplayService` rebuilds read models from the latest snapshot plus the events after it. Details are
  in [`packages/engine/docs/EventSourcing.md`](packages/engine/docs/EventSourcing.md).
- **Repository pattern** over two interchangeable drivers: **SQLite** (`sql.js`, the default) and
  **MongoDB** (Mongoose). Select one with `PERSISTENCE_DRIVER`. Embedded containers inherit the engine's
  driver and share its SQLite file.
- **`PersistenceGateway`** is the only entry point other layers (the engine, Galaxy, generated containers)
  use to reach persistence.
- **Variables** are stored as strings with their type recorded alongside, which keeps them easy to inspect
  and debug in the database.

### Embedded containers

`src/modules/engine/embedded/embedded.containers.service.js` runs a generated container as a child process
next to the engine (through `forever`). It allocates a free port starting at 10000 and tracks a PID file for
each deployment. This is how you debug a workflow locally without building or deploying anything.

---

## Deployment modes

| Mode                              | Description                                                                  |
|-----------------------------------|------------------------------------------------------------------------------|
| Engine + embedded container       | Container runs as a child process next to the engine. For development and sandboxes |
| Engine + external container       | Container is built and deployed elsewhere (for example as a Docker image or Kubernetes pod) |
| Galaxy embedded                   | Galaxy runs in the engine process (no high availability). Fine for small installs |
| Galaxy standalone                 | Galaxy is its own deployment, for high workflow volume                       |

Several replicas of one container can run side by side. Timer start events are deduplicated so that only
one replica fires each tick.

---

## Testing

The engine uses **Vitest**. Integration tests use SQLite by default (`test/.env`); `mongodb-memory-server`
is available for Mongo-backed runs.

```bash
npm test                                            # single pass (root alias)
npm run test:unit                                   # src/**/*.unit.test.js
npm run test:int                                    # src/**/*.int.test.js
npm run test:e2e                                    # test/e2e/**/*.test.js
npm run test:coverage --workspace=@andromeda/engine # coverage (c8)

# single file or test name
npx vitest run <path> --workspace=@andromeda/engine
npx vitest run -t "<test name>" --workspace=@andromeda/engine
```

If port 27018 (in-memory MongoDB) is stuck, run `npm run posttest --workspace=@andromeda/engine`.
The Mocha and Ava configs in the engine are left over from an earlier setup. Use Vitest for new tests (see
`packages/engine/VITEST_MIGRATION.md`).

Designer tests: `cd packages/designer && npm test`.

---

## Project conventions

- **Never edit `packages/engine/deployments/`.** It is generated output. Change the templates or processors
  and recompile.
- **No TypeScript and no build step in the engine.** Plain ES6 modules are a deliberate design choice.
- **Read configuration through `Config.getInstance()`**, not `process.env`.
- **Reach persistence only through `PersistenceGateway`.**
- **Record notable changes in [`CHANGELOG.md`](CHANGELOG.md).**

---

## Further documentation

- [`packages/engine/readme.md`](packages/engine/readme.md): engine notes and running generated code locally
- [`packages/engine/docs/index.md`](packages/engine/docs/index.md): design rationale (why ES6)
- [`packages/engine/docs/EventSourcing.md`](packages/engine/docs/EventSourcing.md): event store, replay, snapshots
- [`packages/engine/src/modules/readme.md`](packages/engine/src/modules/readme.md): module internals and code injection
- [`packages/designer/README.md`](packages/designer/README.md): the designer
- [`CHANGELOG.md`](CHANGELOG.md): detailed history

---

## Roadmap

Highlights from [`Roadmap.md`](Roadmap.md):

- Signal events, within the same process and across processes
- Correlation for catch events
- Roles for human tasks and JWT authentication on container endpoints
- Scheduled tasks and cron-based starts
- Several processes, or several containers, in one process
- Container dependencies chosen per deployment (for example `sql.js` vs `mongoose`)
- Large-file ingestion through an object-storage driver
- Kubernetes pod manifests and multi-container high availability, including detection of stale process
  instances
- Support for workflow standards other than BPMN

---

## License

See [`LICENSE`](LICENSE).
