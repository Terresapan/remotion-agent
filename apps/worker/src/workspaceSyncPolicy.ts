import fs from 'node:fs/promises';
import path from 'node:path';

export type WorkspaceSyncPolicy = {
  include: string[];
  excludeDirs: string[];
  excludeGlobs: string[];
  excludeExtensions: string[];
};

const DEFAULT_SYNC_POLICY: WorkspaceSyncPolicy = {
  include: [
    'src/**',
    'public/**',
    'scripts/**',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'remotion.config.ts',
    '.env',
  ],
  excludeDirs: ['.git', 'node_modules', '.next', 'dist', '.agents', '.windsurf'],
  excludeGlobs: ['**/*.mp4', '**/*.mov', '**/*.mkv', '**/*.wav', '**/*.aiff'],
  excludeExtensions: [],
};

function toPosix(input: string) {
  return input.split(path.sep).join(path.posix.sep);
}

function escapeRegex(input: string) {
  return input.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob: string) {
  const normalized = toPosix(glob);
  const escaped = escapeRegex(normalized)
    .replaceAll('\\*\\*', '___DOUBLE_STAR___')
    .replaceAll('\\*', '[^/]*')
    .replaceAll('___DOUBLE_STAR___', '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAnyGlob(candidate: string, globs: string[]) {
  const normalized = toPosix(candidate);
  return globs.some((glob) => globToRegex(glob).test(normalized));
}

export async function loadWorkspaceSyncPolicy(repoRoot: string): Promise<WorkspaceSyncPolicy> {
  const filePath =
    process.env.WORKSPACE_SYNC_ALLOWLIST_FILE ??
    path.join(repoRoot, 'infra', 'worker', 'workspace-sync-allowlist.json');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WorkspaceSyncPolicy>;
    return {
      include: parsed.include ?? DEFAULT_SYNC_POLICY.include,
      excludeDirs: parsed.excludeDirs ?? DEFAULT_SYNC_POLICY.excludeDirs,
      excludeGlobs: parsed.excludeGlobs ?? DEFAULT_SYNC_POLICY.excludeGlobs,
      excludeExtensions: parsed.excludeExtensions ?? DEFAULT_SYNC_POLICY.excludeExtensions,
    };
  } catch {
    return DEFAULT_SYNC_POLICY;
  }
}

export function shouldSyncPath(
  relativePath: string,
  isDirectory: boolean,
  policy: WorkspaceSyncPolicy
) {
  const normalized = toPosix(relativePath).replace(/^\.\/+/, '');
  if (!normalized) return true;

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => policy.excludeDirs.includes(segment))) {
    return false;
  }

  if (isDirectory) {
    return true;
  }

  const extension = path.extname(normalized).toLowerCase();
  if (extension && policy.excludeExtensions.map((value) => value.toLowerCase()).includes(extension)) {
    return false;
  }

  if (matchesAnyGlob(normalized, policy.excludeGlobs)) {
    return false;
  }

  return matchesAnyGlob(normalized, policy.include);
}

