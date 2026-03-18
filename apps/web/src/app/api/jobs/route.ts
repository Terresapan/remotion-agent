import {NextResponse} from 'next/server';
import {createJobSchema} from '@remotionagent/shared';
import {workerApiFetch} from '../../../lib/workerApi';

export async function GET() {
  const result = await workerApiFetch('/jobs');
  return NextResponse.json(result.data, {status: result.status});
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  let body: Record<string, unknown>;

  if (contentType.includes('application/json')) {
    body = await request.json();
  } else {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
    if (typeof body.targetLength === 'string' && body.targetLength !== '') {
      body.targetLength = Number(body.targetLength);
    }
  }

  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {error: 'Invalid job payload', details: parsed.error.flatten()},
      {status: 400}
    );
  }

  const result = await workerApiFetch('/jobs', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(parsed.data),
  });
  return NextResponse.json(result.data, {status: result.status});
}
