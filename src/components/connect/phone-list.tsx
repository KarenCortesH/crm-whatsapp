import { QualityBadge } from '@/components/health/quality-badge'

type Phone = {
  id: string
  display_phone_number: string | null
  verified_name: string | null
  is_coexistence: boolean
  quality_rating: string | null
  connection_status: string | null
}

export function PhoneList({ phones }: { phones: Phone[] }) {
  if (!phones.length) {
    return <p className="rounded-lg bg-amber-50 p-4 text-amber-900">Todavía no tienes un número conectado.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {phones.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="font-semibold">{p.display_phone_number ?? 'Número sin nombre'}</p>
            <p className="text-sm text-slate-600">
              {p.verified_name ?? '—'} · {p.is_coexistence ? 'Coexistencia con la app' : 'Solo CRM'} ·{' '}
              {p.connection_status === 'CONNECTED' ? 'Conectado' : (p.connection_status ?? 'Estado desconocido')}
            </p>
          </div>
          <QualityBadge rating={p.quality_rating} />
        </li>
      ))}
    </ul>
  )
}
