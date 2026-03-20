# Remotion Agent Roadmap

## Purpose

Track the staged evolution of the Remotion agent from a local personal tool into a complete system with:
- sandboxed execution
- reusable instruction memory
- explicit asset ingestion
- preview UX
- future cloud deployment

## Guiding Direction

The target system is:
- Next.js as the control plane and visual frontend
- worker API as execution orchestrator
- OpenShell as the sandbox backend
- template repo as code scaffold
- host-backed memory/skills as reusable instructions
- NVIDIA API as first model provider

## Current Status

### Completed

- `web` and `worker` run in Docker with stable project-specific ports.
- Worker API is separated into its own service and called over HTTP from web routes.
- Worker bootstrap moved into Dockerfile for deterministic startup.
- Structured worker logs added for job lifecycle steps (`create`, `sync`, `sync_assets`, `execute`).
- OpenShell is installed in worker image and verified importable at runtime.
- Local gateway recovered and verified healthy.
- Persistent sandbox `remotionagent-local` created and now in `Ready` phase.
- Workspace sync changed from broad recursive copy to configurable allowlist file:
  - `infra/worker/workspace-sync-allowlist.json`
- Per-job `AGENTS.md` generation removed from workspace seeding.
- Memory/skills are now env-configurable placeholders:
  - `AGENT_MEMORY_FILE`
  - `AGENT_SKILLS_ROOTS`
- Asset ingestion path implemented:
  - `POST /jobs/:jobId/assets`
  - `GET /jobs/:jobId/assets`
  - assets stored in `job-assets/<jobId>/public/assets` and synced before run steps.
- Empty policy placeholder added:
  - `infra/openshell/policy.yaml`

### Working but intentionally incomplete

- `policy.yaml` is not designed or applied yet.
- Memory/skills are configurable but not yet wired through a true deepagents `FilesystemBackend` route in this worker runtime.
- Asset upload currently accepts JSON + base64, not multipart streaming.
- No preview server lifecycle in worker yet.

## Next Steps

### Phase A: Stabilize sandbox + policy baseline

1. Define first project policy in `infra/openshell/policy.yaml`.
2. Apply policy to `remotionagent-local` and validate:
- required filesystem access for job execution
- required outbound endpoints for research/model/tool calls
3. Add runbook commands to docs for policy export/apply/check.

### Phase B: Memory/skills architecture completion

1. Bind real paths for:
- `AGENT_MEMORY_FILE` (template root `AGENTS.md`)
- `AGENT_SKILLS_ROOTS` (template `.agents`, `scripts`)
2. Add explicit worker-side loader contract for memory/skills files used by generation/editing steps.
3. Document precedence rules between reusable memory and per-job metadata.

### Phase C: Asset pipeline hardening

1. Add multipart upload support for large assets.
2. Add MIME/extension policy and per-type size caps.
3. Add cleanup lifecycle for `job-assets` after job archival/deletion.
4. Add API-level tests for upload/list/sync behaviors.

### Phase D: Preview UX

1. Implement worker-hosted preview endpoint lifecycle for active workspace.
2. Surface preview in Next.js UI.
3. Keep data model compatible with future Next.js-native Remotion player migration.

## Deployment Direction

### Local

- Docker Desktop: `web` + `worker`
- OpenShell gateway + persistent sandbox
- host filesystem for template/workspaces/memory/skills/assets

### Future Cloud

- Vercel for frontend
- cloud worker API runtime
- persistent storage for workspaces/assets/memory
- replaceable sandbox backend (OpenShell local now, cloud sandbox later)

## Invariants

The roadmap is on track if these stay true:
- control plane remains outside sandbox
- worker remains replaceable
- sandbox backend remains swappable
- template remains the workflow contract
