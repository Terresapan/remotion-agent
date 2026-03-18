const WORKER_API_BASE_URL = process.env.WORKER_API_BASE_URL ?? 'http://localhost:3201';

export async function workerApiFetch(
  path: string,
  init?: RequestInit
): Promise<{ok: boolean; status: number; data: unknown}> {
  const response = await fetch(`${WORKER_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as unknown;
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  }

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: {error: 'Non-JSON worker response', details: text},
  };
}
