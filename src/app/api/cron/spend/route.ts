import { isAuthorizedCron } from '@/lib/cron-auth'
import { runSpendAlerts } from '@/modules/meter/run-spend-alerts'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: 'no autorizado' }, { status: 401 })
  return Response.json({ ok: true, ...(await runSpendAlerts()) })
}
