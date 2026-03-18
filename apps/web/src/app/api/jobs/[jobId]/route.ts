import {NextResponse} from 'next/server';
import {workerApiFetch} from '../../../../lib/workerApi';

export async function GET(
  _request: Request,
  context: {params: Promise<{jobId: string}>}
) {
  const {jobId} = await context.params;
  const result = await workerApiFetch(`/jobs/${jobId}`);
  return NextResponse.json(result.data, {status: result.status});
}
