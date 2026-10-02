import { timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'

export function isAuthorizedCron(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET
  if (!secret) return false
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
