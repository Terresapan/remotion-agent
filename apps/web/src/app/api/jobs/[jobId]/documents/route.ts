import {NextResponse} from 'next/server';
import {workerApiFetch} from '../../../../../lib/workerApi';

type Params = {params: Promise<{jobId: string}>};

export async function GET(_request: Request, context: Params) {
  const {jobId} = await context.params;
  const result = await workerApiFetch(`/jobs/${jobId}/documents`);
  return NextResponse.json(result.data, {status: result.status});
}
