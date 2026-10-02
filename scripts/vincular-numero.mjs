// Vincula a una empresa un número que ya existe en Kapso (p. ej. el de Instant setup) y registra sus webhooks.
//   npm run vincular -- <phone_number_id> <tenant_id>
// Requiere APP_URL público (p. ej. un túnel https) porque Kapso debe poder llegar a los webhooks.
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const env = process.env
const [phoneNumberId, tenantId] = process.argv.slice(2)
if (!phoneNumberId || !tenantId) {
  console.error('Uso: npm run vincular -- <phone_number_id> <tenant_id>')
  process.exit(1)
}
for (const k of ['KAPSO_API_KEY', 'KAPSO_WEBHOOK_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_URL']) {
  if (!env[k]) {
    console.error(`Falta ${k} en .env.local`)
    process.exit(1)
  }
}
if (!env.APP_URL.startsWith('https://')) {
  console.error('APP_URL debe ser https público (Kapso no entrega webhooks a localhost). Usa un túnel, p. ej. cloudflared.')
  process.exit(1)
}

const kapsoBase = env.KAPSO_API_BASE_URL || 'https://api.kapso.ai'
const kapso = async (path, init = {}) => {
  const res = await fetch(`${kapsoBase}${path}`, {
    ...init,
    headers: { 'X-API-Key': env.KAPSO_API_KEY, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Kapso ${res.status} en ${path}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}
const sb = async (path, init = {}) => {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const { data: phones } = await kapso(`/platform/v1/whatsapp/phone_numbers?phone_number_id=${encodeURIComponent(phoneNumberId)}`)
const info = phones?.[0]
if (!info) throw new Error(`Kapso no conoce el número ${phoneNumberId}`)

const [tenant] = await sb(`/tenants?id=eq.${encodeURIComponent(tenantId)}&select=id,name`, { headers: { Prefer: '' } })
if (!tenant) throw new Error(`No existe la empresa ${tenantId}`)

await sb('/phone_numbers?on_conflict=phone_number_id', {
  method: 'POST',
  body: JSON.stringify({
    tenant_id: tenant.id,
    phone_number_id: phoneNumberId,
    waba_id: info.business_account_id ?? null,
    display_phone_number: info.display_phone_number ?? null,
    verified_name: info.verified_name ?? null,
    is_coexistence: info.is_coexistence ?? false,
    quality_rating: info.quality_rating ?? null,
    throughput_tier: info.throughput_tier ?? null,
    messaging_limit: info.whatsapp_business_manager_messaging_limit ?? null,
    connection_status: info.status ?? null,
  }),
})
console.log(`✔ ${info.display_phone_number} vinculado a "${tenant.name}"`)

const { data: hooks } = await kapso(`/platform/v1/whatsapp/phone_numbers/${phoneNumberId}/webhooks`)
const events = [
  'whatsapp.message.received', 'whatsapp.message.sent', 'whatsapp.message.delivered', 'whatsapp.message.read',
  'whatsapp.message.failed', 'whatsapp.conversation.created', 'whatsapp.conversation.ended',
  'whatsapp.contact.marketing_preference_changed',
]
for (const [kind, path] of [['kapso', '/api/webhooks/kapso'], ['meta', '/api/webhooks/meta']]) {
  const url = `${env.APP_URL}${path}`
  if ((hooks ?? []).some((h) => h.kind === kind && h.url === url)) {
    console.log(`• webhook ${kind} ya existía → ${url}`)
    continue
  }
  await kapso(`/platform/v1/whatsapp/phone_numbers/${phoneNumberId}/webhooks`, {
    method: 'POST',
    body: JSON.stringify({
      whatsapp_webhook: { url, kind, secret_key: env.KAPSO_WEBHOOK_SECRET, events: kind === 'kapso' ? events : [], active: true, buffer_enabled: false },
    }),
  })
  console.log(`✔ webhook ${kind} registrado → ${url}`)
}
console.log('\nListo. Escríbele a ese número desde tu celular y míralo llegar en /panel/bandeja.')
