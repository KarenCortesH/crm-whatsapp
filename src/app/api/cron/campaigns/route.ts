import { isAuthorizedCron } from '@/lib/cron-auth'
import { runCampaignBatches } from '@/modules/campaigns/run-campaign-batches'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: 'no autorizado' }, { status: 401 })
  return Response.json({ ok: true, campaigns: await runCampaignBatches() })
}
