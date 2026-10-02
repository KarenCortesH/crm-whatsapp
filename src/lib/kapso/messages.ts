import { serverEnv } from '@/lib/env'
import { kapsoFetch } from './http'

type SendResult = { messages: Array<{ id: string }>; contacts?: Array<{ wa_id: string }> }

function messagesPath(phoneNumberId: string) {
  return `/meta/whatsapp/${serverEnv().KAPSO_META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`
}

export async function sendText(phoneNumberId: string, to: string, body: string) {
  return kapsoFetch<SendResult>({
    method: 'POST',
    path: messagesPath(phoneNumberId),
    body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body } },
  })
}

export type TemplateParam = { type: 'text'; text: string; parameter_name?: string }

export async function sendTemplate(
  phoneNumberId: string,
  to: string,
  template: { name: string; language: string; bodyParams?: TemplateParam[] },
) {
  return kapsoFetch<SendResult>({
    method: 'POST',
    path: messagesPath(phoneNumberId),
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        components: template.bodyParams?.length ? [{ type: 'body', parameters: template.bodyParams }] : [],
      },
    },
  })
}
