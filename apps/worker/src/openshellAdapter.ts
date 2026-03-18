import path from 'node:path';
import os from 'node:os';
import {execa} from 'execa';

export type SandboxWorkspace = {
  id: string;
  rootPath: string;
  sandboxName: string;
};

export interface SandboxAdapter {
  createWorkspace(jobId: string): Promise<SandboxWorkspace>;
  runCommand(
    workspace: SandboxWorkspace,
    command: string,
    options?: {timeoutMs?: number}
  ): Promise<{exitCode: number; stdout: string; stderr: string}>;
  syncFromLocal(workspace: SandboxWorkspace, localPath: string): Promise<void>;
  readFile(workspace: SandboxWorkspace, path: string): Promise<string>;
  writeFile(workspace: SandboxWorkspace, path: string, content: string): Promise<void>;
  cleanupWorkspace(workspace: SandboxWorkspace): Promise<void>;
}

const BRIDGE_PATH = new URL('../scripts/openshell_bridge.py', import.meta.url).pathname;
const DEFAULT_OPENSHELL_PYTHON = path.join(
  os.homedir(),
  '.local',
  'share',
  'uv',
  'tools',
  'openshell',
  'bin',
  'python3'
);

export class OpenShellAdapter implements SandboxAdapter {
  constructor(
    private readonly pythonBin =
      process.env.OPENSHELL_BRIDGE_PYTHON ?? DEFAULT_OPENSHELL_PYTHON
  ) {}

  private resolveWorkspacePath(workspace: SandboxWorkspace, targetPath: string): string {
    const normalized = path.posix.normalize(targetPath);
    if (normalized.startsWith('../') || normalized === '..') {
      throw new Error(`Path escapes sandbox workspace: ${targetPath}`);
    }
    if (normalized.startsWith('/')) {
      return normalized;
    }
    return path.posix.join(workspace.rootPath, normalized);
  }

  private async invoke<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const {stdout} = await execa(this.pythonBin, [BRIDGE_PATH, action], {
      input: JSON.stringify(payload),
      env: process.env,
    });
    return JSON.parse(stdout) as T;
  }

  async createWorkspace(jobId: string): Promise<SandboxWorkspace> {
    return this.invoke<SandboxWorkspace>('create_workspace', {
      jobId,
      sandboxName: process.env.OPENSHELL_SANDBOX_NAME ?? '',
    });
  }

  async runCommand(
    workspace: SandboxWorkspace,
    command: string,
    options?: {timeoutMs?: number}
  ): Promise<{exitCode: number; stdout: string; stderr: string}> {
    return this.invoke('run_command', {
      sandboxName: workspace.sandboxName,
      rootPath: workspace.rootPath,
      command,
      timeoutSeconds: Math.ceil((options?.timeoutMs ?? 30 * 60_000) / 1000),
    });
  }

  async syncFromLocal(workspace: SandboxWorkspace, localPath: string): Promise<void> {
    await this.invoke('sync_to_workspace', {
      sandboxName: workspace.sandboxName,
      rootPath: workspace.rootPath,
      localPath,
      maxFileBytes: Number(process.env.OPENSHELL_SYNC_MAX_FILE_BYTES ?? '900000'),
    });
  }

  async readFile(workspace: SandboxWorkspace, path: string): Promise<string> {
    const result = await this.invoke<{content: string}>('read_file', {
      sandboxName: workspace.sandboxName,
      path: this.resolveWorkspacePath(workspace, path),
    });
    return result.content;
  }

  async writeFile(workspace: SandboxWorkspace, path: string, content: string): Promise<void> {
    await this.invoke('write_file', {
      sandboxName: workspace.sandboxName,
      path: this.resolveWorkspacePath(workspace, path),
      content,
    });
  }

  async cleanupWorkspace(workspace: SandboxWorkspace): Promise<void> {
    await this.invoke('cleanup_workspace', {
      sandboxName: workspace.sandboxName,
    });
  }
}
