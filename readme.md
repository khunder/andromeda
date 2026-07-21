# Andromeda

Andromeda is a workflow engine, built around **code generation**: a BPMN diagram is translated into a
fully functional, standalone Node.js app (a **container**).

This is an npm-workspaces monorepo with two packages today:

- **[`packages/engine`](packages/engine/readme.md)** — the workflow engine, code generator, and REST APIs
  (plain ES6 JavaScript, no build step, no TypeScript — see `packages/engine/readme.md` /
  `packages/engine/docs/index.md` for why).
- **[`packages/designer`](packages/designer)** — a BPMN diagramming UI (TypeScript + Vite) for authoring
  the diagrams the engine compiles.

## Getting started

```bash
npm install          # installs both packages from the repo root
npm start             # runs the engine (packages/engine), hot reload at localhost:8080
npm run designer:dev  # runs the designer dev server (packages/designer)
```

Anything not aliased at the root is reachable via `npm run <script> --workspace=@andromeda/engine` (or
`@andromeda/designer`), or by `cd`-ing into the package directly. See each package's own readme for
prerequisites, environment variables, and its full script list.
