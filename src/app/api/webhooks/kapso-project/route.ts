import { serverEnv } from '@/lib/env'
import { ingestWebhook } from '@/lib/webhooks/ingest'
import { processKapsoEvent } from '@/lib/webhooks/process-kapso'

/** Webhook de proyecto (Platform webhooks): avisa cuando un cliente termina el setup link. */
export async function POST(request: Request) {
  const secret = serverEnv().KAPSO_PROJECT_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'KAPSO_PROJECT_WEBHOOK_SECRET no configurado' }, { status: 503 })
  return ingestWebhook(request, { source: 'kapso', secret, process: processKapsoEvent })
}
