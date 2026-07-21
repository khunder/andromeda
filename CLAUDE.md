# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

dont modify anything under deployments folder, it's a generated folder, instead try to regenerated it by compiling
the container with the engine.
when I specify a container, it's not a docker container, it's a term used to specify a generated node.js app. 

## What this is

Andromeda is a workflow engine that mainly supports BPMN not only but in the future I plan to go for another standard.
Andromeda built around **code generation**:
a BPMN diagram is translated into a fully functional, standalone Node.js app (a **container**, conceptually a microservice). 

I aim to implement simple Bpmn branching logic, but I plan to implement more complex logic in the future.
I will implement:
- start node
- end node
- parallel gateway
- exclusive gateway
- sequence flow with conditional flow
- user task
- script task
- custom task, inherits a script task to implement custom logic 
- timer event
- signal event
- catch event





This is an **npm-workspaces monorepo** with two packages today:

- **`packages/engine/`** (`@andromeda/engine`) — the engine, code generator, and REST APIs (pure ES6
  JavaScript, no build step, no TypeScript).
- **`packages/designer/`** (`@andromeda/designer`) — a separate BPMN diagramming UI (TypeScript + Vite),
  currently mid-migration from a hand-built SVG renderer to `bpmn-js` (see recent commits touching
  `packages/designer/src/designer/*`). Its own `packages/designer/README.md` still documents the old
  custom-renderer API and is stale for anything bpmn-js related.

A later, separate step will split the engine's own `src/modules/{persistence,galaxy,web}` into their own
workspace packages too (they're already reused as-is inside generated containers — see Module system below)
— not done yet, don't assume it's already happened.

The deliberate choice of plain ES6 for the engine (no transpile step, no TS) is explained in
`packages/engine/readme.md` and `packages/engine/docs/index.md` — don't suggest introducing TypeScript or a
build step there.

**All paths below (Architecture, Module system, etc.) are relative to `packages/engine/`** unless stated
otherwise — that's also true of every `src/`, `test/`, `deployments/<id>/` etc. reference throughout this
file. Every engine command must be run with cwd = `packages/engine/` (`cd packages/engine && npm run
<script>`, or `npm run <script> --workspace=@andromeda/engine` from the repo root) — never invoke
`node packages/engine/bootstrap.js` (or similar) directly from the repo root, since the engine resolves
several runtime paths (deployments, its own sqlite file, pid files) off `process.cwd()`.

## Commands

Engine (from the repo root, or `cd packages/engine` first and drop the `--workspace` flag):
```bash
npm start                                          # nodemon bootstrap.js, hot reload at localhost:8080
npm test                                           # vitest, watch mode (packages/engine only)
npm run test:run --workspace=@andromeda/engine      # vitest run (single pass)
npm run test:unit --workspace=@andromeda/engine     # vitest run src/**/*.unit.test.js
npm run test:int --workspace=@andromeda/engine      # vitest run src/**/*.int.test.js
npm run test:e2e --workspace=@andromeda/engine      # vitest run test/e2e/**/*.test.js
npm run test:coverage --workspace=@andromeda/engine # vitest run --coverage (c8)
npx vitest run <path> --workspace=@andromeda/engine              # run a single test file
npx vitest run -t "<test name>" --workspace=@andromeda/engine    # run tests matching a name
```
Requires MongoDB and a `packages/engine/.env` with `MONGODB_URI`, `ACTIVE_MODULES` (see Module system below),
`ENV`. `test/setup.js` spins up `mongodb-memory-server` for integration tests; if port 27018 is stuck,
`npm run posttest --workspace=@andromeda/engine` kills it.

There are legacy Mocha/Ava configs (`.mocharc.int.cjs`, `test:mocha:int`, `test:integration:exec`) left over from
a prior test runner — the project has migrated to Vitest (`packages/engine/VITEST_MIGRATION.md`); prefer the
`vitest`-based scripts for new/changed tests.

Designer (`npm run designer:dev` / `npm run designer:build` from the repo root, or `cd packages/designer` first):
```bash
npm run dev          # vite dev server
npm run build         # tsc && vite build
npm run type-check    # tsc --noEmit
npm test              # vitest
```

## Architecture

### Module system (engine)

`app.js` (`App.init()`) conditionally boots modules based on the comma-separated `ACTIVE_MODULES` env var
(`src/config/constants.js`: `web`, `server`, `persistence`, `galaxy`), each dynamically `import()`ed only if
active, then started in sequence. `Config` (`src/config/config.js`) is a process-wide singleton
(`Config.getInstance()`) reading all env vars — read from there rather than `process.env` directly elsewhere.

- **`server`** → `src/modules/engine/engine.module.js` — the engine itself; in local/dev mode also starts the
  embedded sidecar daemon.
- **`web`** → `src/modules/web/web.module.js` — Fastify app; routes are auto-discovered from `src/routes/*`
  via `@fastify/autoload` (drop a file in `routes/` and it's exposed — no manual registration).
- **`galaxy`** → `src/modules/galaxy/galaxy.module.js` — separate Fastify app for querying workflow runtime
  state (process instances, variables, human-task forms). Can run embedded with the engine (no HA) or as its
  own deployment when workflow volume is high; depends on `persistence`.
- **`persistence`** → MongoDB-backed storage (Mongoose).

### Code generation (the core of the engine)

`WorkflowBuilder` (`src/modules/engine/workflow.builder.js`) walks a parsed BPMN model starting from each start
event and dispatches nodes to `BpmnProcessor` (`src/modules/engine/builder/bpmn.processor.js`), which delegates
per node type to `src/modules/engine/builder/processors/*` (start/end/script/catch-event, etc.).

`EngineService.generateContainer()` (`src/modules/engine/engine.service.js`) orchestrates a full build into
`deployments/<id>/`:
1. Copies whichever of `persistence` / `galaxy` / `web` modules the container needs verbatim from `src/modules/`
   into the generated app (`GenerateModule`) — these modules are reused as-is in generated containers, not
   reimplemented.
2. Walks `src/modules/engine/builder/templates/` recursively and materializes it into the deployment:
   - **`.snjk`** files ("static njk") are copied byte-for-byte with the extension stripped — for files that
     never vary (e.g. `package.json.snjk` → `package.json`).
   - **`.njk`** files are rendered through Nunjucks for per-workflow dynamic content.
   - Dynamic method bodies get injected into generated classes via `ts-morph` (see `src/modules/readme.md`).
3. Writes a generated `specification.yaml` (OpenAPI) built from the codegen context, not from the
   `templates/specification.yaml.njk` file (that path is currently commented out in
   `EngineService.generateOpenApiYaml`).

A generated container is bootstrapped via its own `bootstrap.js`/`app.js`, structurally mirroring the
engine's own `App` class.

### Embedded containers (dev/sandbox mode)

`src/modules/engine/embedded/embedded.containers.service.js` runs a generated container as a child process
alongside the engine (via `forever`), allocating a free port starting at 10000
(`EmbeddedContainerService.portOffset`) and tracking PID files per deployment. This is the "debug your workflow
locally" path described in `readme.md` — as opposed to building a Docker image and deploying the container
elsewhere.

### Variables

Process-instance variables are persisted as strings (with their type recorded alongside) rather than as native
types, specifically to keep them easy to inspect/debug operationally (`src/modules/readme.md`).

### Deployment modes

The supported topologies are: engine + embedded container (single process, dev), engine +
external container (built/deployed separately, via container image), and galaxy either embedded with the engine or
deployed standalone for high workflow volume.


### Galaxy
is a separate app for querying workflow runtime state (process instances, variables, human-task forms).
Can run embedded with the engine (no HA for dev purpose) or as its own deployment when workflow volume is high; depends on
`persistence`.


### Persistence
Persistence is using event sourcing. And internally is using a repository pattern.
Is MongoDB-backed storage via (Mongoose). It's a choice for simplicity and flexibility.
We can use any other database, but we need to implement the persistence layer.
Persistence Gateway is the component used for communication with other layers like the engine and galaxy. 
It's the only reference used outside the persistence layer. 


