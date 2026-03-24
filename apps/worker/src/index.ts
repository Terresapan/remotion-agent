import {randomUUID} from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createJobSchema,
  jobRecordSchema,
  runJobStepSchema,
  type CreateJobInput,
  type JobStatus,
  type RunJobStepInput,
  type UploadJobAssetInput,
} from '@remotionagent/shared';
import type {SandboxAdapter, SandboxWorkspace} from './openshellAdapter';
import {OpenShellAdapter} from './openshellAdapter';
import {getNvidiaRuntimeSummary} from './model';
import {withJobStepLogging} from './jobLogger';
import {loadWorkspaceSyncPolicy, shouldSyncPath} from './workspaceSyncPolicy';
import {listJobAssets, resolveJobAssetsPath, uploadJobAsset} from './assets';

function resolveRepoRoot() {
  if (process.env.REMOTION_REPO_ROOT) {
    return process.env.REMOTION_REPO_ROOT;
  }

  const cwd = process.cwd();
  const direct = cwd;
  const fromWorkspace = path.resolve(cwd, '..', '..');

  if (fsSync.existsSync(path.join(direct, 'workspaces'))) {
    return direct;
  }
  if (fsSync.existsSync(path.join(fromWorkspace, 'workspaces'))) {
    return fromWorkspace;
  }

  return fromWorkspace;
}

const REPO_ROOT = resolveRepoRoot();
if (!process.env.REMOTION_TEMPLATE_PATH) {
  throw new Error('REMOTION_TEMPLATE_PATH env var is required');
}
const DEFAULT_TEMPLATE_PATH = process.env.REMOTION_TEMPLATE_PATH;
const WORKSPACES_ROOT = process.env.REMOTION_WORKSPACES_ROOT ?? path.join(REPO_ROOT, 'workspaces');
const JOB_MEMORY_DIR = '.deepagents';
const MODULE_PATH = fileURLToPath(import.meta.url);
const AGENT_MEMORY_FILE = process.env.AGENT_MEMORY_FILE ?? '';
const AGENT_SKILLS_ROOTS = (process.env.AGENT_SKILLS_ROOTS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const inMemoryJobs = new Map<string, ReturnType<typeof jobRecordSchema.parse>>();
const inMemoryRuntime = new Map<
  string,
  {
    workspace: SandboxWorkspace;
    hostWorkspacePath: string;
  }
>();

const STEP_COMMANDS: Record<RunJobStepInput['stepId'], string> = {
  'audio:manifest': 'npm run audio:manifest',
  'audio:validate': 'npm run audio:validate',
  typecheck: 'npm run typecheck',
  'validate:template': 'npm run validate:template',
  build: 'npm run build',
};

async function copyTemplateWorkspace(targetPath: string) {
  const syncPolicy = await loadWorkspaceSyncPolicy(REPO_ROOT);
  await fs.rm(targetPath, {recursive: true, force: true});
  await fs.mkdir(path.dirname(targetPath), {recursive: true});
  await fs.cp(DEFAULT_TEMPLATE_PATH, targetPath, {
    recursive: true,
    filter(source) {
      const relativePath = path.relative(DEFAULT_TEMPLATE_PATH, source);
      const isDirectory = fsSync.statSync(source).isDirectory();
      return shouldSyncPath(relativePath, isDirectory, syncPolicy);
    },
  });
}

async function seedWorkspaceMetadata(jobId: string, input: CreateJobInput, targetPath: string) {
  const memoryPath = path.join(targetPath, JOB_MEMORY_DIR);
  await fs.mkdir(memoryPath, {recursive: true});
  await fs.writeFile(
    path.join(memoryPath, 'job-input.json'),
    JSON.stringify(input, null, 2),
    'utf8'
  );
}

export async function createJob(
  input: CreateJobInput,
  adapter: SandboxAdapter = new OpenShellAdapter()
) {
  const parsed = createJobSchema.parse(input);
  const jobId = randomUUID();
  const hostWorkspacePath = path.join(WORKSPACES_ROOT, jobId);

  await copyTemplateWorkspace(hostWorkspacePath);
  await seedWorkspaceMetadata(jobId, parsed, hostWorkspacePath);

  const workspace = await withJobStepLogging(jobId, 'create', async () =>
    adapter.createWorkspace(jobId)
  );
  await withJobStepLogging(jobId, 'sync', async () =>
    adapter.syncFromLocal(workspace, hostWorkspacePath)
  );

  const job = jobRecordSchema.parse({
    jobId,
    topic: parsed.topic,
    status: 'provisioning',
    workspaceId: workspace.id,
    stage: 'workspace-seeded',
  });

  inMemoryJobs.set(jobId, job);
  inMemoryRuntime.set(jobId, {
    workspace,
    hostWorkspacePath,
  });

  return {
    ...job,
    hostWorkspacePath,
    sandboxName: workspace.sandboxName,
    memory: {
      memoryFile: AGENT_MEMORY_FILE || null,
      skillsRoots: AGENT_SKILLS_ROOTS,
    },
    modelProvider: getNvidiaRuntimeSummary(),
  };
}

export function listJobs() {
  return Array.from(inMemoryJobs.values());
}

export function getJob(jobId: string) {
  return inMemoryJobs.get(jobId) ?? null;
}

export async function addJobAsset(jobId: string, input: UploadJobAssetInput) {
  const job = inMemoryJobs.get(jobId);
  if (!job) return null;
  return uploadJobAsset(REPO_ROOT, jobId, input);
}

export async function getJobAssets(jobId: string) {
  const job = inMemoryJobs.get(jobId);
  if (!job) return null;
  return listJobAssets(REPO_ROOT, jobId);
}

export async function runJobStep(
  jobId: string,
  input: RunJobStepInput,
  adapter: SandboxAdapter = new OpenShellAdapter()
) {
  const parsed = runJobStepSchema.parse(input);
  const job = inMemoryJobs.get(jobId);
  const runtime = inMemoryRuntime.get(jobId);

  if (!job || !runtime) {
    return null;
  }

  const command = STEP_COMMANDS[parsed.stepId];

  inMemoryJobs.set(jobId, {
    ...job,
    status: 'running',
    stage: `running:${parsed.stepId}`,
  });

  const jobAssetsPath = resolveJobAssetsPath(REPO_ROOT, jobId);
  if (fsSync.existsSync(jobAssetsPath)) {
    await withJobStepLogging(jobId, 'sync_assets', async () =>
      adapter.syncFromLocal(runtime.workspace, jobAssetsPath)
    );
  }

  const result = await withJobStepLogging(jobId, 'execute', async () =>
    adapter.runCommand(runtime.workspace, command, {
      timeoutMs: parsed.timeoutMs,
    })
  );

  const nextStatus: JobStatus = result.exitCode === 0 ? 'completed' : 'failed';
  const updated = {
    ...job,
    status: nextStatus,
    stage: result.exitCode === 0 ? `completed:${parsed.stepId}` : `failed:${parsed.stepId}`,
  };
  inMemoryJobs.set(jobId, updated);

  return {
    job: updated,
    stepId: parsed.stepId,
    command,
    result,
  };
}

export async function main() {
  console.log('Remotion agent worker scaffold');
  console.log(
    JSON.stringify(
      {
        templatePath: DEFAULT_TEMPLATE_PATH,
        workspacesRoot: WORKSPACES_ROOT,
        modelProvider: getNvidiaRuntimeSummary(),
      },
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  void main();
}
