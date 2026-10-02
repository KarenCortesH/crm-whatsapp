// Prueba de punta a punta de los webhooks contra un "mini Supabase" local (Postgres + PostgREST en Docker).
// Requiere haber corrido `npm run build`. Uso: npm run test:e2e
import { execFileSync, spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { join } from 'node:path'

const root = process.cwd()
const NET = 'crm-e2e-net'
const DB = 'crm-e2e-db'
const REST = 'crm-e2e-rest'
const JWT_SECRET = 'e2e-jwt-secret-que-tiene-mas-de-32-caracteres'
const WEBHOOK_SECRET = 'e2e-webhook-secret-123456'
const PROXY_PORT = 54329
const KAPSO_PORT = 54330
const APP_PORT = 3107
const CRON_SECRET = 'e2e-cron-secret-1234567'

// Kapso falso: salud con calidad AMARILLA y envíos aceptados.
const kapsoCalls = []
let sentCounter = 0
const fakeKapso = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    kapsoCalls.push({ method: req.method, url: req.url, apiKey: req.headers['x-api-key'], body })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.endsWith('/health')) {
      return res.end(JSON.stringify({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          phone_number_access: { passed: true, details: { quality_rating: 'YELLOW', throughput_tier: 'TIER_1K' } },
          phone_number_connection: { passed: true, details: { status: 'CONNECTED' } },
          messaging_health: { passed: true, overall_status: 'AVAILABLE', details: { entities: [] } },
          webhook_subscription: { passed: true, details: { subscribed: true } },
          webhook_verified: { passed: true },
        },
      }))
    }
    if (req.method === 'POST' && req.url.endsWith('/messages')) {
      sentCounter++
      return res.end(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: `wamid.CAMP${sentCounter}` }] }))
    }
    res.statusCode = 404
    res.end('{}')
  })
}).listen(KAPSO_PORT)

const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const psql = (sql) => docker(['exec', '-i', DB, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA'], sql).trim()

function jwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
  return `${head}.${createHmac('sha256', JWT_SECRET).update(head).digest('base64url')}`
}
const SERVICE_KEY = jwt({ role: 'service_role', iss: 'supabase', exp: 4102444800 })
const ANON_KEY = jwt({ role: 'anon', iss: 'supabase', exp: 4102444800 })

function cleanup() {
  for (const c of [REST, DB]) try { docker(['rm', '-f', c]) } catch {}
  try { docker(['network', 'rm', NET]) } catch {}
}

let app
let proxy
const results = []
function assert(name, cond, detail = '') {
  results.push({ name, ok: Boolean(cond), detail })
  console.log(`${cond ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function waitFor(fn, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { if (await fn()) return } catch {}
    await sleep(500)
  }
  throw new Error(`timeout esperando ${label}`)
}

function signed(body) {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

async function post(path, payload, headers = {}) {
  const body = JSON.stringify(payload)
  const res = await fetch(`http://localhost:${APP_PORT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signed(body), ...headers },
    body,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

try {
  cleanup()
  docker(['network', 'create', NET])
  docker(['run', '-d', '--name', DB, '--network', NET, '-e', 'POSTGRES_PASSWORD=postgres', 'postgres:16-alpine'])
  await waitFor(() => { docker(['exec', DB, 'pg_isready', '-U', 'postgres']); return true }, 'postgres')
  await sleep(1500)

  psql(readFileSync(join(root, 'tests/db/auth-stub.sql'), 'utf8'))
  for (const f of readdirSync(join(root, 'supabase/migrations')).sort()) psql(readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
  // Privilegios que Supabase da por defecto a sus roles.
  psql(`
    create role authenticator login password 'authpass' noinherit;
    grant anon, authenticated, service_role to authenticator;
    grant usage on schema public to anon, service_role;
    grant all on all tables in schema public to service_role;
    grant all on all sequences in schema public to service_role;
    grant execute on all functions in schema public to service_role;
    insert into public.tenants (id, name) values ('11111111-1111-1111-1111-111111111111', 'Tienda E2E');
    insert into public.phone_numbers (tenant_id, phone_number_id, display_phone_number)
      values ('11111111-1111-1111-1111-111111111111', 'pn-e2e', '+57 300 000 0000');
  `)
  console.log('✔ base de datos con migraciones y datos de prueba')

  docker(['run', '-d', '--name', REST, '--network', NET, '-p', '3009:3000',
    '-e', `PGRST_DB_URI=postgres://authenticator:authpass@${DB}:5432/postgres`,
    '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
    '-e', `PGRST_JWT_SECRET=${JWT_SECRET}`, 'postgrest/postgrest:v12.2.3'])
  await waitFor(async () => (await fetch('http://localhost:3009/')).ok, 'PostgREST')
  console.log('✔ PostgREST arriba')

  proxy = http.createServer((req, res) => {
    const path = req.url.replace(/^\/rest\/v1/, '') || '/'
    const upstream = http.request({ host: 'localhost', port: 3009, path, method: req.method, headers: { ...req.headers, host: 'localhost:3009' } }, (up) => {
      res.writeHead(up.statusCode, up.headers)
      up.pipe(res)
    })
    upstream.on('error', () => { res.writeHead(502); res.end() })
    req.pipe(upstream)
  }).listen(PROXY_PORT)

  app = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(APP_PORT)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      APP_URL: `http://localhost:${APP_PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${PROXY_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      KAPSO_API_KEY: 'e2e-kapso-key',
      KAPSO_API_BASE_URL: `http://localhost:${KAPSO_PORT}`,
      KAPSO_WEBHOOK_SECRET: WEBHOOK_SECRET,
      CRON_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let appLog = ''
  app.stdout.on('data', (d) => (appLog += d))
  app.stderr.on('data', (d) => (appLog += d))
  await waitFor(async () => (await fetch(`http://localhost:${APP_PORT}/`)).ok, 'la app')
  console.log('✔ app en producción arriba\n')

  // 1. Firma inválida
  const bad = await fetch(`http://localhost:${APP_PORT}/api/webhooks/kapso`, {
    method: 'POST', headers: { 'X-Webhook-Signature': 'deadbeef', 'Content-Type': 'application/json' }, body: '{}',
  })
  assert('firma inválida → 401', bad.status === 401, `HTTP ${bad.status}`)

  // 2. Mensaje entrante firmado
  const inbound = {
    message: { id: 'wamid.E2E1', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', from: '573005551234', text: { body: 'Hola, ¿tienen envíos a Cali?' }, kapso: { direction: 'inbound', status: 'received' } },
    conversation: { id: 'conv_e2e', contact_name: 'Cliente Prueba', phone_number: '573005551234', phone_number_id: 'pn-e2e' },
    is_new_conversation: true,
    phone_number_id: 'pn-e2e',
  }
  const r1 = await post('/api/webhooks/kapso', inbound, { 'X-Webhook-Event': 'whatsapp.message.received', 'X-Idempotency-Key': 'idem-e2e-1' })
  assert('mensaje firmado → 200', r1.status === 200, JSON.stringify(r1.json))

  await waitFor(() => psql(`select count(*) from messages where wamid = 'wamid.E2E1'`) === '1', 'que el mensaje se procese', 30)
  const row = psql(`select m.body || ' | ' || c.wa_id || ' | ' || coalesce(c.name,'') || ' | ' || v.unread_count from messages m join contacts c on c.id = m.contact_id join conversations v on v.id = m.conversation_id where m.wamid = 'wamid.E2E1'`)
  assert('el mensaje llegó a la bandeja (mensaje, contacto, conversación)', row.startsWith('Hola, ¿tienen envíos a Cali? | 573005551234 | Cliente Prueba | 1'), row)
  assert('evento crudo guardado y marcado procesado', psql(`select count(*) from webhook_events where processed_at is not null and error is null`) === '1')
  assert('last_inbound_at del número actualizado', psql(`select last_inbound_at is not null from phone_numbers where phone_number_id='pn-e2e'`) === 't')

  // 3. Reenvío duplicado (Kapso reintenta)
  const r2 = await post('/api/webhooks/kapso', inbound, { 'X-Webhook-Event': 'whatsapp.message.received', 'X-Idempotency-Key': 'idem-e2e-1' })
  assert('reintento duplicado → 200 sin reprocesar', r2.status === 200 && r2.json?.duplicate === true, JSON.stringify(r2.json))
  await sleep(800)
  assert('sigue habiendo un solo mensaje y unread = 1', psql(`select count(*) || '/' || max(v.unread_count) from messages m join conversations v on v.id=m.conversation_id`) === '1/1')

  // 4. Webhook crudo de Meta: estado entregado con precio de servicio
  psql(`insert into messages (tenant_id, phone_id, wamid, direction, msg_type, body, status)
        select tenant_id, id, 'wamid.E2EOUT', 'outbound', 'text', 'Sí, enviamos', 'sent' from phone_numbers where phone_number_id='pn-e2e'`)
  const meta = { object: 'whatsapp_business_account', entry: [{ id: 'waba-e2e', changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'pn-e2e' }, statuses: [{ id: 'wamid.E2EOUT', status: 'delivered', timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: '573005551234', pricing: { billable: true, pricing_model: 'PMP', type: 'regular', category: 'service' } }] } }] }] }
  const r3 = await post('/api/webhooks/meta', meta, { 'X-Idempotency-Key': 'idem-e2e-meta-1' })
  assert('webhook de Meta firmado → 200', r3.status === 200)
  await waitFor(() => psql(`select status from messages where wamid='wamid.E2EOUT'`) === 'delivered', 'estado de Meta', 30)
  assert('precio de Meta registrado (servicio, cobrable)', psql(`select pricing_category || '/' || billable from messages where wamid='wamid.E2EOUT'`) === 'service/true')

  // 5. Baja de marketing
  const optout = { contact: { wa_id: '573005551234' }, marketing_preference: { status: 'stopped', sequence: 3, occurred_at: new Date().toISOString() }, phone_number_id: 'pn-e2e' }
  await post('/api/webhooks/kapso', optout, { 'X-Webhook-Event': 'whatsapp.contact.marketing_preference_changed', 'X-Idempotency-Key': 'idem-e2e-optout' })
  await waitFor(() => psql(`select marketing_opted_out from contacts where wa_id='573005551234'`) === 't', 'baja de marketing', 30)
  assert('baja de marketing aplicada al contacto', true)

  // 6. Cron protegido
  const cron = await fetch(`http://localhost:${APP_PORT}/api/cron/health`)
  assert('cron sin secreto → 401', cron.status === 401)

  // 6b. Monitor de salud con Kapso (falso) reportando calidad amarilla
  const authCron = (path) => fetch(`http://localhost:${APP_PORT}${path}`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
  const health = await authCron('/api/cron/health')
  const healthJson = await health.json()
  assert('cron de salud con secreto → 200', health.status === 200, JSON.stringify(healthJson))
  assert('usa la API key de Kapso en el header X-API-Key', kapsoCalls.some((c) => c.url.endsWith('/health') && c.apiKey === 'e2e-kapso-key'))
  assert('snapshot amarillo guardado', psql(`select color || '/' || quality_rating from health_snapshots order by id desc limit 1`) === 'amarillo/YELLOW')
  assert('alerta "Es tu número" creada', psql(`select count(*) from alerts where source='numero' and body like '%AMARILLO%'`) === '1')
  await authCron('/api/cron/health')
  assert('la alerta no se repite en la segunda revisión', psql(`select count(*) from alerts where source='numero' and body like '%AMARILLO%'`) === '1')

  // 6c. Campaña: tanda 1 se envía; la calidad bajó (GREEN→YELLOW) → freno automático antes de la tanda 2
  psql(`
    insert into templates (id, tenant_id, name, body, requested_category, status)
      values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'promo_e2e', 'Hola {{1}}, tenemos novedades', 'MARKETING', 'APPROVED');
    insert into contacts (id, tenant_id, wa_id, name) values
      ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '573110000001', 'Ana María'),
      ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '573110000002', 'Beto');
    insert into consents (tenant_id, contact_id, purpose, method, source_detail, granted_at)
      select '11111111-1111-1111-1111-111111111111', id, 'marketing', 'formulario_web', 'e2e', now() - interval '3 days'
      from contacts where wa_id in ('573110000001', '573110000002');
    insert into campaigns (id, tenant_id, phone_id, template_id, name, status, batch_size, risk_report)
      select '44444444-4444-4444-4444-444444444444', tenant_id, id, '22222222-2222-2222-2222-222222222222', 'Campaña E2E', 'enviando', 1,
             '{"quality_at_start":"GREEN"}'::jsonb
      from phone_numbers where phone_number_id = 'pn-e2e';
    insert into campaign_recipients (tenant_id, campaign_id, contact_id)
      select '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', id
      from contacts where wa_id in ('573110000001', '573110000002');
  `)
  await authCron('/api/cron/campaigns')
  const sends = kapsoCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/messages'))
  assert('tanda 1: un solo envío de plantilla', sends.length === 1, `${sends.length} envío(s)`)
  const sentBody = JSON.parse(sends[0]?.body ?? '{}')
  assert('la plantilla lleva el nombre del contacto en {{1}}', sentBody.template?.name === 'promo_e2e' && ['Ana', 'Beto'].includes(sentBody.template?.components?.[0]?.parameters?.[0]?.text), JSON.stringify(sentBody.template))
  await authCron('/api/cron/campaigns')
  assert('freno automático: no se envió la tanda 2', kapsoCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/messages')).length === 1)
  const campaign = psql(`select status || ' | ' || coalesce(paused_reason,'') from campaigns where id='44444444-4444-4444-4444-444444444444'`)
  assert('campaña pausada por baja de calidad', campaign.startsWith('pausada | La calidad bajó de GREEN a YELLOW'), campaign)
  assert('alerta de campaña pausada creada', psql(`select count(*) from alerts where source='campana'`) === '1')

  // 7. Panel exige sesión
  const panel = await fetch(`http://localhost:${APP_PORT}/panel`, { redirect: 'manual' })
  assert('panel sin sesión redirige a /ingresar', panel.status === 307 && (panel.headers.get('location') ?? '').includes('/ingresar'), `${panel.status} → ${panel.headers.get('location')}`)

  if (results.some((r) => !r.ok)) console.log('\n--- log de la app ---\n' + appLog.slice(-3000))
} catch (err) {
  console.error('✘ error en la prueba:', err.message)
  results.push({ ok: false })
} finally {
  app?.kill()
  proxy?.close()
  fakeKapso.close()
  cleanup()
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${failed ? `✘ ${failed} verificación(es) fallaron` : `✔ ${results.length} verificaciones de punta a punta pasaron`}`)
process.exit(failed ? 1 : 0)
