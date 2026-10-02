import { serverEnv } from '@/lib/env'
import { ingestWebhook } from '@/lib/webhooks/ingest'
import { processMetaEvent } from '@/lib/webhooks/process-meta'

export async function POST(request: Request) {
  return ingestWebhook(request, {
    source: 'meta',
    secret: serverEnv().KAPSO_WEBHOOK_SECRET,
    process: processMetaEvent,
  })
}
