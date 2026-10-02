// Verifica cada conexión externa con las claves de .env.local, sin imprimir secretos.
//   npm run verificar                      → revisa Supabase, Kapso, DeepSeek y Jev
//   npm run verificar -- --enviar <phone_number_id> <destino>  → además envía un WhatsApp de prueba
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const env = process.env
const results = []

async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail })
  } catch (err) {
    results.push({ name, ok: false, detail: err.message })
  }
}

function need(...keys) {
  const missing = keys.filter((k) => !env[k])
  if (missing.length) throw new Error(`faltan ${missing.join(', ')}`)
}

async function json(res) {
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

await check('Supabase (service role + tablas)', async () => {
  need('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?select=id&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  await json(res)
  return 'conectado; la tabla tenants existe (migraciones aplicadas)'
})

await check('Supabase (anon + RLS)', async () => {
  need('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/contacts?select=id&limit=1`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  })
  const rows = await json(res)
  if (rows.length) throw new Error('¡un usuario anónimo puede leer contactos! Revisa la RLS')
  return 'anónimo no ve datos (RLS activa)'
})

await check('Kapso (API key)', async () => {
  need('KAPSO_API_KEY')
  const base = env.KAPSO_API_BASE_URL || 'https://api.kapso.ai'
  const res = await fetch(`${base}/platform/v1/whatsapp/phone_numbers?per_page=50`, { headers: { 'X-API-Key': env.KAPSO_API_KEY } })
  const body = await json(res)
  const phones = body.data ?? []
  return `${phones.length} número(s): ${phones.map((p) => `${p.display_phone_number} [${p.phone_number_id}] calidad ${p.quality_rating ?? '?'}`).join('; ') || 'ninguno aún'}`
})

await check('Kapso (secreto de webhooks)', async () => {
  need('KAPSO_WEBHOOK_SECRET')
  if (env.KAPSO_WEBHOOK_SECRET.length < 16) throw new Error('muy corto (mínimo 16 caracteres)')
  return 'presente'
})

await check('DeepSeek (calificador)', async () => {
  need('DEEPSEEK_API_KEY')
  const res = await fetch('https://api.deepseek.com/models', { headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` } })
  const body = await json(res)
  return `ok (${(body.data ?? []).map((m) => m.id).join(', ')})`
})

await check('Jev / TypeSafe (opcional)', async () => {
  if (!env.TYPESAFE_API_KEY) return 'no configurado: se usarán las probabilidades de DeepSeek'
  const res = await fetch('https://api.typesafe.ai/v1/models', { headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}` } })
  await json(res)
  return 'ok'
})

const sendIdx = process.argv.indexOf('--enviar')
if (sendIdx > -1) {
  const [phoneNumberId, to] = process.argv.slice(sendIdx + 1)
  await check(`Envío de prueba a ${to ?? '?'}`, async () => {
    need('KAPSO_API_KEY')
    if (!phoneNumberId || !to) throw new Error('uso: --enviar <phone_number_id> <destino>')
    const base = env.KAPSO_API_BASE_URL || 'https://api.kapso.ai'
    const version = env.KAPSO_META_GRAPH_VERSION || 'v24.0'
    const res = await fetch(`${base}/meta/whatsapp/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'X-API-Key': env.KAPSO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { body: 'Prueba de Canal Seguro ✅' },
      }),
    })
    const body = await json(res)
    return `aceptado por Meta, wamid ${body.messages?.[0]?.id}`
  })
}

for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}: ${r.detail}`)
process.exit(results.some((r) => !r.ok) ? 1 : 0)
