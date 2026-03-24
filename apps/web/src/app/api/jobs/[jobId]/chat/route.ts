import {NextResponse} from 'next/server';
import {workerApiFetch} from '../../../../../lib/workerApi';

type Params = {params: Promise<{jobId: string}>};

export async function GET(_request: Request, context: Params) {
  const {jobId} = await context.params;
  const result = await workerApiFetch(`/jobs/${jobId}/chat`);
  return NextResponse.json(result.data, {status: result.status});
}

export async function POST(request: Request, context: Params) {
  const {jobId} = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({error: 'Invalid JSON body'}, {status: 400});
  }

  const body = payload as {content?: unknown};
  if (typeof body.content !== 'string' || body.content.trim() === '') {
    return NextResponse.json(
      {error: 'Invalid chat payload', details: 'content must be a non-empty string'},
      {status: 400}
    );
  }

  const result = await workerApiFetch(`/jobs/${jobId}/chat`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({content: body.content}),
  });
  return NextResponse.json(result.data, {status: result.status});
}
