import {NextResponse} from 'next/server';
import {runJobStepSchema} from '@remotionagent/shared';
import {workerApiFetch} from '../../../../../lib/workerApi';

type Params = {params: Promise<{jobId: string}>};

export async function POST(request: Request, context: Params) {
  const {jobId} = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({error: 'Invalid JSON body'}, {status: 400});
  }

  const parsed = runJobStepSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {error: 'Invalid run-step payload', details: parsed.error.flatten()},
      {status: 400}
    );
  }

  const result = await workerApiFetch(`/jobs/${jobId}/run-step`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(parsed.data),
  });
  return NextResponse.json(result.data, {status: result.status});
}
