import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createJobSchema, runJobStepSchema, uploadJobAssetSchema} from '@remotionagent/shared';
import {addJobAsset, createJob, getJob, getJobAssets, listJobs, runJobStep} from './index';
import {logJobError} from './jobLogger';

const WORKER_PORT = Number(process.env.WORKER_PORT ?? '3201');

function sendJson(
  response: ServerResponse<IncomingMessage>,
  status: number,
  payload: unknown
) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) return {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (method === 'GET' && path === '/health') {
    sendJson(response, 200, {ok: true});
    return;
  }

  if (method === 'GET' && path === '/jobs') {
    sendJson(response, 200, {jobs: listJobs()});
    return;
  }

  if (method === 'POST' && path === '/jobs') {
    try {
      const payload = await readJsonBody(request);
      const parsed = createJobSchema.safeParse(payload);
      if (!parsed.success) {
        sendJson(response, 400, {
          error: 'Invalid job payload',
          details: parsed.error.flatten(),
        });
        return;
      }

      const job = await createJob(parsed.data);
      sendJson(response, 201, job);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      logJobError('unknown', 'Failed to create job', error);
      sendJson(response, 500, {error: 'Failed to create job', details: message});
      return;
    }
  }

  if (method === 'GET' && /^\/jobs\/[^/]+$/.test(path)) {
    const jobId = path.split('/')[2];
    const job = getJob(jobId);
    if (!job) {
      sendJson(response, 404, {error: 'Job not found'});
      return;
    }
    sendJson(response, 200, {
      ...job,
      previewUrl: `/preview/${jobId}`,
    });
    return;
  }

  if (method === 'POST' && /^\/jobs\/[^/]+\/run-step$/.test(path)) {
    const jobId = path.split('/')[2];
    try {
      const payload = await readJsonBody(request);
      const parsed = runJobStepSchema.safeParse(payload);
      if (!parsed.success) {
        sendJson(response, 400, {
          error: 'Invalid run-step payload',
          details: parsed.error.flatten(),
        });
        return;
      }

      const result = await runJobStep(jobId, parsed.data);
      if (!result) {
        sendJson(response, 404, {error: 'Job not found'});
        return;
      }
      sendJson(response, 200, result);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      logJobError(jobId, 'Failed to execute run-step', error);
      sendJson(response, 500, {error: 'Failed to execute run-step', details: message});
      return;
    }
  }

  if (method === 'GET' && /^\/jobs\/[^/]+\/assets$/.test(path)) {
    const jobId = path.split('/')[2];
    try {
      const assets = await getJobAssets(jobId);
      if (!assets) {
        sendJson(response, 404, {error: 'Job not found'});
        return;
      }
      sendJson(response, 200, {assets});
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      logJobError(jobId, 'Failed to list assets', error);
      sendJson(response, 500, {error: 'Failed to list assets', details: message});
      return;
    }
  }

  if (method === 'POST' && /^\/jobs\/[^/]+\/assets$/.test(path)) {
    const jobId = path.split('/')[2];
    try {
      const payload = await readJsonBody(request);
      const parsed = uploadJobAssetSchema.safeParse(payload);
      if (!parsed.success) {
        sendJson(response, 400, {
          error: 'Invalid asset payload',
          details: parsed.error.flatten(),
        });
        return;
      }

      const asset = await addJobAsset(jobId, parsed.data);
      if (!asset) {
        sendJson(response, 404, {error: 'Job not found'});
        return;
      }
      sendJson(response, 201, asset);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      logJobError(jobId, 'Failed to upload asset', error);
      sendJson(response, 500, {error: 'Failed to upload asset', details: message});
      return;
    }
  }

  sendJson(response, 404, {error: 'Not found'});
});

server.listen(WORKER_PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Worker API listening on http://0.0.0.0:${WORKER_PORT}`);
});
