import {randomUUID} from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export type UploadAssetInput = {
  filename: string;
  contentBase64: string;
  mimeType?: string;
};

export type JobAssetRecord = {
  assetId: string;
  filename: string;
  mimeType: string;
  size: number;
  hostPath: string;
  relativePath: string;
};

function sanitizeFilename(filename: string) {
  return filename.replace(/[^\w.\-]/g, '_');
}

const DEFAULT_MAX_ASSET_BYTES = 25 * 1024 * 1024;

export function resolveAssetsRoot(repoRoot: string) {
  return process.env.JOB_ASSETS_ROOT ?? path.join(repoRoot, 'job-assets');
}

export function resolveJobAssetsPath(repoRoot: string, jobId: string) {
  return path.join(resolveAssetsRoot(repoRoot), jobId);
}

export async function uploadJobAsset(repoRoot: string, jobId: string, input: UploadAssetInput) {
  const maxBytes = Number(process.env.JOB_ASSET_MAX_FILE_BYTES ?? DEFAULT_MAX_ASSET_BYTES);
  const safeFilename = sanitizeFilename(input.filename);
  if (!safeFilename) {
    throw new Error('Invalid filename');
  }

  const content = Buffer.from(input.contentBase64, 'base64');
  if (content.byteLength > maxBytes) {
    throw new Error(`Asset exceeds max size of ${maxBytes} bytes`);
  }

  const assetId = randomUUID();
  const storedFilename = `${assetId}-${safeFilename}`;
  const relativePath = path.posix.join('public', 'assets', storedFilename);
  const jobAssetsPath = resolveJobAssetsPath(repoRoot, jobId);
  const hostPath = path.join(jobAssetsPath, ...relativePath.split('/'));
  await fs.mkdir(path.dirname(hostPath), {recursive: true});
  await fs.writeFile(hostPath, content);

  return {
    assetId,
    filename: safeFilename,
    mimeType: input.mimeType ?? 'application/octet-stream',
    size: content.byteLength,
    hostPath,
    relativePath,
  } satisfies JobAssetRecord;
}

export async function listJobAssets(repoRoot: string, jobId: string): Promise<JobAssetRecord[]> {
  const jobAssetsPath = resolveJobAssetsPath(repoRoot, jobId);
  const publicAssetsPath = path.join(jobAssetsPath, 'public', 'assets');
  if (!fsSync.existsSync(publicAssetsPath)) {
    return [];
  }

  const entries = await fs.readdir(publicAssetsPath, {withFileTypes: true});
  const files = entries.filter((entry) => entry.isFile());

  const results = await Promise.all(
    files.map(async (entry) => {
      const hostPath = path.join(publicAssetsPath, entry.name);
      const stats = await fs.stat(hostPath);
      const [assetId, ...rest] = entry.name.split('-');
      return {
        assetId,
        filename: rest.join('-') || entry.name,
        mimeType: 'application/octet-stream',
        size: stats.size,
        hostPath,
        relativePath: path.posix.join('public', 'assets', entry.name),
      } satisfies JobAssetRecord;
    })
  );

  return results.sort((a, b) => a.filename.localeCompare(b.filename));
}

