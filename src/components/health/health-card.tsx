import type { HealthFinding } from '@/modules/health/diagnose'
import { SOURCE_LABEL } from '@/modules/health/diagnose'
import { formatAgo } from '@/lib/format'
import { QualityBadge } from './quality-badge'
import { HealthStat } from './health-stat'

type Props = {
  phone: {
    display_phone_number: string | null
    quality_rating: string | null
    throughput_tier: string | null
    messaging_limit: string | null
    last_inbound_at: string | null
    last_webhook_at: string | null
    is_coexistence: boolean
  }
  snapshot: { color: string; headline: string; findings: HealthFinding[]; checked_at: string; messaging: string | null } | null
}

const LIGHT: Record<string, { ring: string; dot: string; label: string }> = {
  verde: { ring: 'border-green-300 bg-green-50', dot: 'bg-green-500', label: 'Verde' },
  amarillo: { ring: 'border-amber-300 bg-amber-50', dot: 'bg-amber-500', label: 'Amarillo' },
  rojo: { ring: 'border-red-300 bg-red-50', dot: 'bg-red-600', label: 'Rojo' },
}

export function HealthCard({ phone, snapshot }: Props) {
  const light = LIGHT[snapshot?.color ?? ''] ?? { ring: 'border-slate-200 bg-white', dot: 'bg-slate-400', label: 'Sin revisar' }
  return (
    <article className={`rounded-xl border p-5 ${light.ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className={`h-4 w-4 rounded-full ${light.dot}`} />
          <div>
            <p className="text-lg font-semibold">{phone.display_phone_number ?? 'Tu número'}</p>
            <p className="text-sm text-slate-600">Estado: {light.label}</p>
          </div>
        </div>
        <QualityBadge rating={phone.quality_rating} />
      </div>

      <p className="mt-4 text-base font-medium">{snapshot?.headline ?? 'Todavía no hemos revisado este número.'}</p>

      {snapshot && snapshot.findings.length > 1 && (
        <ul className="mt-3 flex flex-col gap-2">
          {snapshot.findings.map((f) => (
            <li key={f.code} className="rounded-lg bg-white/70 p-3 text-sm">
              <span className="font-semibold">{SOURCE_LABEL[f.source]}:</span> {f.message}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthStat label="Límite de envío" value={phone.messaging_limit ?? phone.throughput_tier ?? '—'} />
        <HealthStat label="Envío" value={snapshot?.messaging === 'AVAILABLE' ? 'Disponible' : (snapshot?.messaging ?? '—')} />
        <HealthStat label="Último mensaje recibido" value={formatAgo(phone.last_inbound_at)} />
        <HealthStat label="Último evento (webhook)" value={formatAgo(phone.last_webhook_at)} />
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        {phone.is_coexistence ? 'Coexistencia con la app WhatsApp Business. ' : ''}
        Revisado {formatAgo(snapshot?.checked_at ?? null)}.
      </p>
    </article>
  )
}
