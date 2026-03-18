# Remotion Agent Roadmap

## Purpose

Track the staged evolution of the Remotion agent from a local personal tool into a more complete product with visual preview, sandboxed execution, and future cloud deployment.

## Guiding Direction

The target system is:
- Next.js as the control plane and visual frontend
- Deep Agents JS as the worker runtime
- OpenShell as the local sandbox backend
- the Remotion template as the reusable scaffold
- NVIDIA API as the first pluggable model provider

## Phase 1

Local single-user MVP:
- Next.js UI for job creation and status
- one worker process
- one sandboxed workspace per job
- Docker Desktop for app services
- OpenShell for per-job execution
- workspace copied from the template
- worker can validate and render one video

What the product looks like:
- chat/instruction form
- job list
- logs
- basic artifact output

## Phase 2

Worker-hosted preview:
- keep the Next.js app as the control plane
- let the worker manage a preview/dev server for a workspace
- surface the preview inside the UI through an iframe, proxy, or preview pane

Why this phase matters:
- it is the shortest path from the current `npm run dev` workflow
- it keeps preview fidelity high
- it avoids building a browser-native preview system too early

This is the recommended MVP preview path.

## Phase 3

Hybrid preview:
- keep worker-hosted preview as a fallback
- add structured scene and caption inspection in Next.js
- add scene list, manifest browser, and timing inspection panels

Goal:
- reduce dependency on the worker preview server for every visual action
- move toward a more product-like editing experience

## Phase 4

Next.js-native visual preview:
- embed a Remotion-based player/editor surface directly in the Next.js UI
- drive preview from structured state rather than only from a worker-hosted dev server
- use the worker mainly for file edits, heavy validation, and final render

What the product becomes:
- not just a chatbox
- a lightweight video editing and preview tool

## Preview Architecture Options

### Option A

Next.js-native preview:
- Remotion player embedded in the frontend
- preview driven by structured manifests and scene state
- better long-term product design
- better cloud story
- more engineering work upfront

### Option B

Worker-hosted preview:
- worker runs a preview/dev process for the active workspace
- frontend consumes the preview
- faster to build first
- closer to the current workflow
- less elegant long term

## Preview Recommendation

Recommended path:
1. Start with Option B.
2. Keep the data model clean so it can later support Option A.
3. Move to Option A once the core job system, workspace lifecycle, and validation loop are stable.

## Deployment Roadmap

### Local

Use:
- Docker Desktop for `web` and `worker`
- OpenShell for sandboxed job execution
- host filesystem for template, workspaces, memory, and skills

### Future Cloud

Use:
- Vercel for the Next.js frontend
- Google Cloud or another backend platform for worker and job API
- persistent storage for workspaces and artifacts
- a replaceable sandbox backend so local OpenShell can later be swapped for cloud execution

## Key Milestone Test

The roadmap is on track if each phase preserves this invariant:
- the control plane stays outside the sandbox
- the worker stays replaceable
- the sandbox backend stays swappable
- the template remains the workflow contract
