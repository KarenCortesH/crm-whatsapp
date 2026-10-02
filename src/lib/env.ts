import { z } from 'zod'

const serverSchema = z.object({
  APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  KAPSO_API_KEY: z.string().min(1),
  KAPSO_API_BASE_URL: z.string().url().default('https://api.kapso.ai'),
  KAPSO_WEBHOOK_SECRET: z.string().min(16),
  KAPSO_META_GRAPH_VERSION: z.string().default('v24.0'),
  TEMPLATE_LLM_PROVIDER: z.enum(['deepseek']).default('deepseek'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  TYPESAFE_API_KEY: z.string().optional(),
  TYPESAFE_MODEL: z.string().default('jev-1.13.0'),
  CRON_SECRET: z.string().min(16).optional(),
  KAPSO_PROJECT_WEBHOOK_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().optional(),
  ALERTS_FROM_EMAIL: z.string().optional(),
  ALERTS_PHONE_NUMBER_ID: z.string().optional(),
  ALERTS_TEMPLATE_NAME: z.string().optional(),
  ALERTS_TEMPLATE_LANGUAGE: z.string().default('es'),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cached) return cached
  const blankToUndefined = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
  )
  const parsed = serverSchema.safeParse(blankToUndefined)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Variables de entorno inválidas o faltantes: ${missing}`)
  }
  cached = parsed.data
  return cached
}
