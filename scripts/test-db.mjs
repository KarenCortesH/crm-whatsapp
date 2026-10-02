// Levanta un Postgres desechable en Docker, aplica las migraciones y corre las aserciones de RLS.
import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const name = 'crm-whatsapp-testdb'
const root = process.cwd()

function docker(args, input) {
  return execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

function psql(sql, label) {
  try {
    const out = docker(['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], sql)
    if (out.trim()) console.log(out.trim())
    console.log(`✔ ${label}`)
  } catch (err) {
    console.error(`✘ ${label}\n${err.stderr || err.message}`)
    throw err
  }
}

try { docker(['rm', '-f', name]) } catch {}
docker(['run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=postgres', 'postgres:16-alpine'])

for (let i = 0; ; i++) {
  try { docker(['exec', name, 'pg_isready', '-U', 'postgres']); break } catch {
    if (i > 60) throw new Error('Postgres no arrancó')
    await new Promise((r) => setTimeout(r, 1000))
  }
}
await new Promise((r) => setTimeout(r, 1500))

let failed = false
try {
  psql(readFileSync(join(root, 'tests/db/auth-stub.sql'), 'utf8'), 'stub de auth')
  const dir = join(root, 'supabase/migrations')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    psql(readFileSync(join(dir, f), 'utf8'), `migración ${f}`)
  }
  const run = spawnSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: readFileSync(join(root, 'tests/db/rls-assertions.sql'), 'utf8'),
    encoding: 'utf8',
  })
  const notices = (run.stderr || '').split('\n').filter((l) => l.includes('NOTICE') || l.includes('ERROR'))
  console.log([...notices, run.stdout.trim()].join('\n'))
  if (run.status !== 0) throw new Error('Fallaron las aserciones de RLS')
} catch (err) {
  failed = true
  if (err.stderr) console.error(err.stderr)
} finally {
  try { docker(['rm', '-f', name]) } catch {}
}
process.exit(failed ? 1 : 0)
