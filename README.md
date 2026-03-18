# RemotionAgent

RemotionAgent is a local-first agent system for generating and validating Remotion video workspaces from a reusable template.

The project uses:
- a `Next.js` web app as control plane and UI
- a Node worker API for job lifecycle and sandbox operations
- OpenShell as the sandbox runtime for isolated workspace execution

## Current Architecture

- `apps/web`: Next.js frontend + API routes that call the worker over HTTP.
- `apps/worker`: Worker API that creates jobs, seeds workspaces from template, syncs to sandbox, and runs job steps.
- `packages/shared`: Shared schemas and types.
- `infra/docker`: Docker Compose + Dockerfiles for local orchestration.

## How Jobs Work

1. Web creates a job via worker (`POST /jobs`).
2. Worker copies template into `workspaces/<jobId>` on host.
3. Worker creates an OpenShell sandbox workspace.
4. Worker syncs local workspace into sandbox.
5. Web can trigger step execution (`POST /jobs/:jobId/run-step`) such as:
   - `audio:manifest`
   - `audio:validate`
   - `typecheck`
   - `validate:template`
   - `build`

## Logging

Worker emits structured JSON logs for each job step:
- `step_started`
- `step_completed` (with `durationMs`)
- `step_failed` (with `durationMs` + normalized error)

This currently covers sandbox lifecycle execution points:
- `create` (create workspace)
- `sync` (sync local files into sandbox)
- `execute` (run command in sandbox)

## Local Run (Docker)

From project root:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

Services:
- Web UI: `http://localhost:3101`
- Worker API: container-internal `remotionagent-worker:3201` (called by web)

## OpenShell Requirements

- Docker Desktop running
- OpenShell config mounted into worker container (`~/.config/openshell`)
- gateway metadata configured for local OpenShell endpoint

## NVIDIA Model Provider

The worker already exposes NVIDIA runtime configuration summary (`modelProvider`) in job responses.
Set NVIDIA-related environment variables in compose/env when enabling live model calls.

## DeepAgent Status

- The worker package currently includes `deepagents` in dependencies.
- The current runtime path is still adapter-driven (`OpenShellAdapter`) and does not yet run a full DeepAgent graph loop for job execution.
- So: dependency is installed, but full DeepAgent orchestration is not yet fully wired in the active job flow.

## Known Constraint

Large template files can exceed sync limits. Keep the base template lean:
- exclude build artifacts
- exclude heavy media from baseline template
- inject large assets per-job or fetch inside sandbox when needed

