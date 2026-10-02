import { serverEnv } from '@/lib/env'
import { ingestWebhook } from '@/lib/webhooks/ingest'
import { processKapsoEvent } from '@/lib/webhooks/process-kapso'

export async function POST(request: Request) {
  return ingestWebhook(request, {
    source: 'kapso',
    secret: serverEnv().KAPSO_WEBHOOK_SECRET,
    process: processKapsoEvent,
  })
}
