# Remotion Agent Implementation Plan

## Purpose

Turn the architecture note into a buildable plan for a personal Remotion agent:
- Next.js control plane
- Deep Agents JS worker
- OpenShell sandbox runtime
- per-job cloned Remotion workspace
- NVIDIA API as the initial model provider

Roadmap and staged product evolution now live in:
- `ROADMAP.md`

## Reference Repo Decision

The cloned `openshell-deepagent` repo is a reference repo, not the base repo for this build.

Use it for:
- studying the OpenShell backend pattern
- studying sandbox policy structure
- understanding a minimal Deep Agents + OpenShell integration

Do not use it as the main application foundation because:
- it is a narrow Python sample app
- it does not provide the Next.js control plane we want
- it is not a reusable full-stack product scaffold
- this project is cleaner with a TypeScript worker
- we only need its OpenShell backend idea and NVIDIA wiring pattern

## Repo Layout

Suggested structure:

```text
/Users/terresa/Documents/Code/langgraph/remotionagent/
  ARCHITECTURE.md
  IMPLEMENTATION_PLAN.md
  apps/
    web/
    worker/
  packages/
    shared/
  workspaces/
    <job-id>/
      (copy of remotion-teaching-template)
  docs/
    jobs/
    prompts/
    runbooks/
  infra/
    docker/
    deployment/
```

### `apps/web`

Next.js control plane:
- create jobs
- show status and logs
- approve or retry steps
- browse artifacts and renders

### `apps/worker`

Deep Agents JS job runner:
- accepts one video job
- clones or opens a workspace
- runs the Remotion workflow
- reports progress and outputs

### `packages/shared`

Shared types and contracts:
- job payloads
- workspace metadata
- worker status events
- artifact descriptors

### `workspaces/<job-id>`

Per-job cloned Remotion project:
- copied from `remotion-teaching-template`
- modified only by the worker
- disposable after completion unless you want to preserve it

### Workspace Placement Rule

Local mode:
- the canonical job workspace lives on local persistent storage
- the sandbox gets access to that workspace
- the golden template stays separate and is never edited directly

Cloud mode:
- the canonical job workspace lives on persistent cloud storage or a mounted volume
- the sandbox gets access only to the assigned job workspace
- the sandbox filesystem itself is not treated as the long-term source of truth

### `infra/docker`

Local Docker definitions for:
- `web`
- `worker`
- optional local database

### `infra/deployment`

Future deployment manifests or notes for:
- Vercel frontend deployment
- cloud worker deployment
- queue and storage wiring

## Worker API Contracts

Keep the worker interface small and explicit.

### `CreateJob`

Input:
- `topic`
- `sourceUrl` or `sourceText`
- `targetLength`
- `styleNotes`
- `languagePrefs`
- `outputMode`

Output:
- `jobId`
- `workspaceId`
- `status`

### `GetJobStatus`

Input:
- `jobId`

Output:
- current stage
- progress percentage
- recent logs
- artifact list
- next required action

### `ApproveStep`

Input:
- `jobId`
- `stepId`
- approval decision

Output:
- updated step state

### `RetryStep`

Input:
- `jobId`
- `stepId`
- optional note

Output:
- step queued again

### `CancelJob`

Input:
- `jobId`

Output:
- cancelled state
- cleanup status

## Workspace Lifecycle

Use one workspace per job.

### 1. Provision

1. Create a new `workspaces/<job-id>` directory.
2. Copy the template repo contents into it.
3. Write job metadata and initial prompt files.
4. Expose or mount that workspace into the sandbox runtime.
5. Sync the seeded host workspace into `/sandbox/workspace`.

### 2. Execute

1. Worker enters the workspace through OpenShell.
2. Worker follows the template workflow:
   - brief
   - art direction
   - storyboard
   - caption timing
   - scene implementation
   - validation
   - render
3. Worker writes outputs back into the workspace and artifact store.

### 3. Validate

Run the existing checks from the template:
- `npm run audio:lint-text`
- `npm run audio:validate`
- `npm run audio:manifest`
- `npm run typecheck`
- `npm run validate:template`
- `npm run build`

### 4. Export

1. Copy final artifacts out of the workspace.
2. Store logs and run summaries in the control plane.
3. Mark the job complete.

### 5. Cleanup

Options:
- keep the workspace for inspection
- archive it
- delete it after export

## MVP Scope

The first version should support:
- Next.js UI with one job form
- one worker process
- one sandboxed workspace per job
- manual model key configuration
- Dockerized local app services
- validation and one render output

## Dependency Split

Use this as the initial package plan.

### MVP Dependencies Only

#### `apps/web`
- `next`
- `react`
- `react-dom`
- `typescript`
- `zod`
- `lucide-react`
- `@tanstack/react-query` or `zustand` for lightweight client/server state

#### `apps/worker`
- `typescript`
- `zod`
- `deepagents`
- `@langchain/core`
- `@langchain/openai` for the first NVIDIA adapter, because NVIDIA exposes an OpenAI-compatible chat endpoint
- `execa`
- `fs-extra` or Node built-ins
- a thin internal OpenShell adapter or CLI wrapper
- `vitest` for worker logic tests

#### `packages/shared`
- `zod`
- `typescript`

#### Remotion Runtime Dependencies
- `remotion`

## Worker Runtime Notes

The current worker shape should be:
- a TypeScript process outside the sandbox
- an OpenShell bridge for sandbox operations
- a host-side workspace copy from the golden template
- a sync step from host workspace into `/sandbox/workspace`
- NVIDIA model configuration owned only by the worker

Important environment variables:
- `REMOTION_TEMPLATE_PATH`
- `REMOTION_WORKSPACES_ROOT`
- `OPENSHELL_BRIDGE_PYTHON`
- `OPENSHELL_SANDBOX_NAME`
- `NVIDIA_API_KEY`
- `NVIDIA_BASE_URL`
- `NVIDIA_MODEL`

The OpenShell bridge requires the OpenShell Python SDK and gateway tooling on the worker host. The Next.js web app does not need those dependencies or the NVIDIA API key.
- `@remotion/cli`
- `@remotion/google-fonts`
- `@remotion/media`
- `three` if needed by scenes
- `@react-three/fiber` if needed by scenes

### Nice-To-Have Later Dependencies

#### Product and UI
- `tailwindcss`
- `shadcn/ui`
- `sonner`
- `framer-motion`

#### Queue and Persistence
- `bullmq`
- `ioredis`
- `better-sqlite3`
- `prisma`
- `drizzle-orm`

#### Runtime and Validation
- `playwright`
- `sharp`
- `ws`
- `pino`
- `dotenv`

#### Provider Expansion
- `openai`
- `@langchain/openai`
- `@langchain/anthropic`
- NVIDIA or OpenAI-compatible provider adapters as needed

### Package JSON Shape

#### `apps/web/package.json`

Purpose:
- Next.js control plane
- UI, job creation, job status, and artifact browsing

Likely dependencies:
- `next`
- `react`
- `react-dom`
- `zod`
- `lucide-react`
- `@tanstack/react-query` or `zustand`

Likely scripts:
- `dev`
- `build`
- `start`
- `typecheck`

#### `apps/worker/package.json`

Purpose:
- sandboxed Deep Agents JS runtime
- job execution
- workspace manipulation
- validation and render orchestration

Likely dependencies:
- `deepagents`
- `@langchain/core`
- `@langchain/openai` or another LangChain JS model package
- `zod`
- `execa`
- internal OpenShell adapter
- provider SDK or adapter for NVIDIA API
- `remotion` only if the worker also imports project code directly

Likely scripts:
- `dev`
- `start`
- `test`
- `typecheck`

#### `packages/shared/package.json`

Purpose:
- shared types and contracts between UI and worker

Likely dependencies:
- `zod`

Likely exports:
- job schema
- workspace schema
- worker event schema
- artifact schema

Likely scripts:
- `build`
- `typecheck`

## Where The Model API Lives

Only the worker needs direct model API access.

Recommended rule:
- `apps/web` never calls the model API directly in the first version.
- `apps/worker` owns the NVIDIA API key and model calls.
- `OpenShell` only runs the worker and the sandboxed commands.

Why:
- the UI should stay thin and local
- the worker already owns the job execution lifecycle
- the API key stays inside the most constrained runtime boundary

If the framework does not expose NVIDIA natively, add a small provider adapter in the worker:
- keep the adapter behind a single interface
- do not leak provider-specific logic into the UI
- switch providers later by changing one worker module, not the whole app

Important implementation note:
- `openshell-deepagent` should be treated as a reference application, not as a required library dependency.
- `deepagents` or `deepagentsjs` is the reusable agent library layer.
- OpenShell should be integrated as the worker execution backend, typically via a thin adapter in your own code.
- Editing TypeScript Remotion files from a Python agent is technically fine, but for this project a TypeScript worker is the cleaner design because the app stack is already Next.js + Remotion + TypeScript.

## Package Json Sketch

Use this as the first-pass shape for the repo once you scaffold it.

### `apps/web/package.json`

```json
{
  "name": "@remotionagent/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0",
    "lucide-react": "^0.5.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0"
  }
}
```

### `apps/worker/package.json`

```json
{
  "name": "@remotionagent/worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.0.0",
    "execa": "^9.0.0",
    "deepagents": "^0.1.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.5.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsx": "^4.0.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

### `packages/shared/package.json`

```json
{
  "name": "@remotionagent/shared",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/node": "^22.0.0"
  }
}
```

### Notes On The Sketch

- Keep the first version minimal and easy to install.
- Add Remotion packages to the worker or to the workspace root only if the worker imports project code directly.
- Add a provider SDK only when you wire up the NVIDIA API path.
- Add database or queue packages only when the in-memory or file-based MVP stops being enough.
- Prefer Deep Agents JS for the worker so the worker and the edited codebase share the same language runtime.

## Deployment Notes

Local and future deployment strategy are described in:
- `ARCHITECTURE.md`
- `ROADMAP.md`

## Suggested Build Order

1. Create the control plane shell.
2. Define shared job and status types.
3. Implement the workspace copier.
4. Containerize local `web` and `worker` services.
5. Hook the worker to OpenShell.
6. Add the first deterministic validation loop.
7. Add rendering and artifact export.

## Design Rules

- Keep the template repo as the source of truth for video workflow.
- Keep the control plane outside the sandbox.
- Keep execution inside the sandbox.
- Treat the model provider as replaceable.
- Prefer simple file-based contracts before introducing a database.

## Minimum Success Criteria

The first version is good enough if it can:
- create a workspace from the template
- open that workspace in a sandboxed worker
- edit a Remotion project
- run validation commands
- render one video
- return artifacts to the UI
