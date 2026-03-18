type JobStep = 'create' | 'sync' | 'execute';
type JobEvent = 'step_started' | 'step_completed' | 'step_failed';

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
  };
}

export async function withJobStepLogging<T>(
  jobId: string,
  step: JobStep,
  action: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  logJobEvent({
    event: 'step_started',
    jobId,
    step,
    startedAt,
  });

  try {
    const result = await action();
    const finishedAt = Date.now();
    logJobEvent({
      event: 'step_completed',
      jobId,
      step,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
    });
    return result;
  } catch (error) {
    const failedAt = Date.now();
    logJobEvent({
      event: 'step_failed',
      jobId,
      step,
      startedAt,
      failedAt,
      durationMs: failedAt - startedAt,
      error: normalizeError(error),
    });
    throw error;
  }
}

function logJobEvent(payload: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      component: 'worker',
      ...payload,
    })
  );
}

export function logJobError(
  jobId: string,
  message: string,
  error: unknown,
  extras?: Record<string, unknown>
) {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      component: 'worker',
      event: 'job_error',
      jobId,
      message,
      error: normalizeError(error),
      ...extras,
    })
  );
}

