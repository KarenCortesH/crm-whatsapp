import { serverEnv } from '@/lib/env'

export class KapsoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown,
  ) {
    super(`Kapso respondió ${status} en ${path}`)
    this.name = 'KapsoApiError'
  }
}

type KapsoRequest = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

export async function kapsoFetch<T>({ method = 'GET', path, body, query }: KapsoRequest): Promise<T> {
  const env = serverEnv()
  const url = new URL(path, env.KAPSO_API_BASE_URL)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key': env.KAPSO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })

  const text = await res.text()
  const parsed: unknown = text ? safeJson(text) : null
  if (!res.ok) throw new KapsoApiError(res.status, url.pathname, parsed)
  return parsed as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
