import { isAuthorizedCron } from '@/lib/cron-auth'
import { runHealthChecks } from '@/modules/health/run-health-check'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: 'no autorizado' }, { status: 401 })
  const results = await runHealthChecks()
  return Response.json({ ok: true, checked: results.length, results })
}
