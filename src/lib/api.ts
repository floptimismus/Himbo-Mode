export class ApiErr extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** JSON fetch against the Worker API. Throws ApiErr; status 0 means the network failed. */
export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiErr(0, 'network');
  }
  const data = (await res.json().catch(() => null)) as { error?: unknown; message?: string } | null;
  if (!res.ok) {
    const code = typeof data?.error === 'string' ? data.error : res.status === 400 ? 'validation' : 'generic';
    throw new ApiErr(res.status, code, data?.message);
  }
  return data as T;
}

export const isNetworkError = (e: unknown) => e instanceof ApiErr && e.status === 0;
export const isUnauthorized = (e: unknown) => e instanceof ApiErr && e.status === 401;
