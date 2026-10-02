import { serverEnv } from '@/lib/env'
import { kapsoFetch } from './http'

type CreateTemplateInput = {
  wabaId: string
  name: string
  language: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  body: string
  /** Un ejemplo por cada {{n}} del cuerpo, en orden. */
  examples: string[]
}

type CreateTemplateResult = { id: string; status: string; category: string }

/** Envía la plantilla a revisión de Meta a través del proxy de Graph de Kapso. */
export async function createMetaTemplate(input: CreateTemplateInput): Promise<CreateTemplateResult> {
  const env = serverEnv()
  const component: Record<string, unknown> = { type: 'BODY', text: input.body }
  if (input.examples.length) component.example = { body_text: [input.examples] }
  return kapsoFetch<CreateTemplateResult>({
    method: 'POST',
    path: `/meta/whatsapp/${env.KAPSO_META_GRAPH_VERSION}/${encodeURIComponent(input.wabaId)}/message_templates`,
    body: {
      name: input.name,
      language: input.language,
      category: input.category,
      parameter_format: 'POSITIONAL',
      components: [component],
    },
  })
}

/** Cuenta las variables {{1}}, {{2}}… y verifica que sean consecutivas desde 1. */
export function templateVariables(body: string): { count: number; valid: boolean } {
  const nums = [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]))
  const unique = [...new Set(nums)].sort((a, b) => a - b)
  return { count: unique.length, valid: unique.every((n, i) => n === i + 1) }
}

/** Meta exige nombres en minúsculas con guion bajo. */
export function toTemplateName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512)
}
