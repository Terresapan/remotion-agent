# Remotion Agent Architecture

## Goal

Build a personal-use Remotion video creation agent with:
- a Next.js control plane
- a self-hosted sandbox worker
- the existing `remotion-teaching-template` as the project scaffold
- NVIDIA API as a pluggable model provider

This architecture is optimized for personal use, local development, and low recurring vendor cost.

## Core Recommendation

Treat the existing Remotion template as an artifact and workspace contract, not as the agent system itself.

Use this system shape:

```text
Next.js UI / control plane
  -> job API / orchestrator
    -> Deep Agents worker
      -> OpenShell sandbox runtime
        -> per-job Remotion workspace cloned from template
          -> edit manifests / scenes / scripts
          -> run validation / typecheck / render
```

This is closest to an `open-swe` style product boundary, but with a self-hosted OpenShell execution layer instead of paid sandbox providers.

## System Roles

### 1. Template Repo

Source:
- `/Users/terresa/Documents/Code/template/remotion-teaching-template`

Role:
- golden project scaffold
- workflow contract for the agent
- reusable scripts, manifests, and project conventions

The template should remain reusable and mostly agent-agnostic.

### 2. Next.js Control Plane

Role:
- user-facing UI
- create video jobs
- show status, logs, artifacts, and previews
- approve or retry steps
- persist job metadata

The control plane should live outside the sandbox.

### 3. Deep Agent Worker

Role:
- interpret the request
- plan the next steps
- edit the video workspace
- run existing project commands
- collect outputs and report progress

The worker should not own long-term state beyond the current job and workspace context.
The worker is also the only process that should own model-provider credentials.

### 4. OpenShell Sandbox Runtime

Role:
- isolated execution environment for the worker
- filesystem, process, and network policy boundary
- persistent workspace for the active job

This replaces third-party sandbox products for execution.

### 5. Model Provider

Initial choice:
- NVIDIA API

Later options:
- local model server
- other supported providers

The model provider should be treated as a swappable dependency, not fused to the rest of the stack.
For the first implementation, the worker talks to NVIDIA through an OpenAI-compatible endpoint configuration so the provider can be swapped without changing the web app.

## Workspace Model

Each video job should get its own workspace cloned from the template.

Suggested directory shape:

```text
/Users/terresa/Documents/Code/langgraph/remotionagent/
  ARCHITECTURE.md
  apps/
    web/
    worker/
  workspaces/
    <job-id>/
      (copy of remotion-teaching-template)
```

Rules:
- never edit the golden template directly during a job
- one workspace per video job
- delete or archive workspaces when done
- reruns should happen in the same workspace when continuity matters
- seed `.deepagents/AGENTS.md` and job input metadata into each cloned workspace before execution

## Execution Flow

1. User creates a new video job in the Next.js UI.
2. The control plane creates a job record.
3. A new workspace is created by copying the Remotion template.
4. The worker is assigned that workspace inside OpenShell.
5. The host workspace is synced into `/sandbox/workspace`.
6. The worker follows the template workflow:
   - research / brief
   - art direction
   - storyboard / manifests
   - caption pacing lock
   - scene implementation
   - validation and render
7. The worker runs existing commands such as:
   - `npm run audio:manifest`
   - `npm run audio:validate`
   - `npm run typecheck`
   - `npm run validate:template`
   - `npm run build`
8. Logs, artifacts, and status are streamed back to the UI.
9. Final outputs are stored outside the sandbox or exported from it.

## Why This Architecture Fits Remotion

Remotion work combines:
- long-running creative iteration
- deterministic build steps
- filesystem-heavy project edits
- expensive renders

That means the best split is:
- UI and orchestration outside the sandbox
- risky execution and edits inside the sandbox

Putting the entire app inside the sandbox would make the product harder to operate. Keeping execution outside the sandbox would reduce isolation and reproducibility.

## Why OpenShell Fits Personal Use

OpenShell is a good fit here because:
- it avoids depending on paid sandbox vendors as the core runtime
- it works with local Docker-based infrastructure
- it gives you a policy boundary around agent execution
- it lets the worker keep the golden template and long-lived memory on the host while executing only the per-job workspace inside the sandbox

Tradeoff:
- you now own the runtime setup and operations
- Docker, local storage, and any model/runtime compute costs are yours

## Recommended First Version

Build the smallest useful system first.

### Phase 1
- Next.js UI with a single "Create video job" flow
- one worker process
- one OpenShell-backed sandbox runtime
- NVIDIA API as the model provider
- workspace copy from the existing template
- log streaming and final artifact export

### Phase 2
- reusable job state model
- checkpoint / resume
- prompt presets for different video types
- artifact browser for audio, captions, and final renders

### Phase 3
- optional local model serving on GPU hardware
- optional multiple workers
- richer approvals and step-level retries

## Local Deployment Model

For local development and personal use, use two layers:

- Docker Desktop for long-lived app services
- OpenShell for sandboxed job execution

Suggested local layout:

```text
Docker Desktop
  - Next.js web app
  - worker service
  - optional local database

Worker service
  -> OpenShell backend
    -> per-job sandbox workspace
```

Why this split works:
- the web app is stable and long-lived
- the worker is a normal service process
- OpenShell stays focused on per-job isolation
- you can keep the stack running without manually starting `npm run dev` each time

Recommended local behavior:
- run the web app and worker in containers
- keep OpenShell as the execution boundary for job workspaces
- mount only the directories you intentionally want the system to access
- install the OpenShell Python package and gateway tooling on the worker host so the bridge can create or attach to sandboxes

### Local Workspace Placement

For local Docker-based development:

- keep the golden template on the host filesystem
- create each job workspace on the host filesystem
- expose only the per-job workspace to the sandbox
- keep memory and skills in a separate persistent host path when needed

Recommended local shape:

```text
Host filesystem
  template/
  workspaces/<job-id>/
  agent-memory/
  agent-skills/

Docker / app services
  web
  worker

OpenShell sandbox
  sees only the mounted or exposed job workspace
```

This keeps the source template safe while making the active job reproducible and disposable.

## Future Cloud Deployment Model

Design the system so the app services and sandbox backend can evolve independently.

Suggested future deployment:

```text
Vercel
  - Next.js control plane

Cloud backend
  - worker service
  - job queue
  - metadata store

Sandbox provider
  - OpenShell-compatible self-hosted runtime
  - or a third-party cloud sandbox backend
```

Possible future split:
- Next.js on Vercel
- worker and job API on Google Cloud
- storage for artifacts in cloud object storage
- sandbox backend swapped from local OpenShell to a cloud execution provider

### Cloud Workspace Placement

In cloud deployment, the same model still applies, but the host filesystem becomes managed storage.

Typical replacement:

- template stored in a repository or object storage
- per-job workspace stored on persistent disk, network volume, or object-backed workspace storage
- memory and skills stored in a dedicated persistent location
- sandbox gets access only to the job workspace it needs

Recommended cloud shape:

```text
Cloud storage or persistent volume
  template snapshot
  workspaces/<job-id>/
  agent-memory/
  agent-skills/
  exported artifacts/

Cloud worker
  attaches or mounts job workspace

Cloud sandbox backend
  sees only the workspace assigned to that job
```

The important rule does not change:
- do not treat the sandbox filesystem as the canonical long-term source of truth
- treat persistent storage outside the sandbox as the source of truth
- let the sandbox operate on an assigned workspace view

This is why the worker should depend on a sandbox interface rather than on one specific runtime.

## Deployment Principle

Containerization and sandboxing are separate concerns.

- Docker is for packaging and running your app services.
- OpenShell is for isolating agent execution.

Do not use OpenShell as the runtime for the whole product.
Use it as the runtime for job workspaces and risky agent actions.

## OpenShell DeepAgent Repo Position

The cloned `openshell-deepagent` repo should be treated as a reference implementation, not as the base application for this project.

We are borrowing these ideas from it:
- the OpenShell backend integration pattern
- the policy-driven sandbox model
- the concept of mapping Deep Agents backend operations onto OpenShell sessions

We are not using it as the product foundation because:
- it is a very small Python example app, not a full reusable platform
- this project's control plane is Next.js
- the edited workspaces are Remotion and TypeScript
- a TypeScript worker keeps the stack more coherent than introducing Python as the main worker language

Project stance:
- use Deep Agents as the worker library
- implement our own OpenShell adapter in the worker
- use the cloned `openshell-deepagent` repo only as a design reference

## Design Principles

- Keep the template as a stable contract.
- Keep the UI outside the sandbox.
- Keep execution inside the sandbox.
- Treat model choice as pluggable.
- Prefer one workspace per job.
- Reuse the template's existing commands instead of inventing a second workflow.

## Recommendation Summary

Use:
- `remotion-teaching-template` as the scaffold
- Next.js as the control plane
- Deep Agents as the worker logic
- OpenShell as the self-hosted sandbox runtime
- NVIDIA API initially as the model provider

Do not:
- put the whole product inside the sandbox
- edit the golden template directly for each run
- tie the architecture too tightly to one model vendor
