import { formatAgo } from '@/lib/format'

type Alert = {
  id: number
  source: string
  severity: string
  title: string
  body: string
  created_at: string
  channels: string[]
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Alertas recientes</h2>
      {alerts.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Sin alertas. 🎉</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.id} className={`rounded-lg p-3 text-sm ${a.severity === 'critico' ? 'bg-red-50' : 'bg-amber-50'}`}>
              <p className="font-semibold">{a.title}</p>
              <p className="mt-1 text-slate-700">{a.body}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatAgo(a.created_at)}
                {a.channels.length ? ` · avisado por ${a.channels.join(' y ')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
