import { setCampaignStatusAction } from '@/app/panel/actions/campaigns'
import type { RiskReport } from '@/modules/campaigns/risk-score'
import { RiskReportView } from './risk-report-view'

export type CampaignRow = {
  id: string
  name: string
  status: string
  risk_score: number | null
  risk_report: RiskReport | null
  batch_size: number
  paused_reason: string | null
  templates: { name: string } | null
  campaign_recipients: Array<{ status: string }>
}

const STATUS: Record<string, string> = {
  borrador: 'Borrador',
  enviando: 'Enviando por tandas',
  pausada: 'Pausada',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

const ACTIONS: Record<string, Array<{ accion: string; label: string }>> = {
  borrador: [{ accion: 'iniciar', label: 'Iniciar envío' }, { accion: 'cancelar', label: 'Cancelar' }],
  enviando: [{ accion: 'pausar', label: 'Pausar' }, { accion: 'cancelar', label: 'Cancelar' }],
  pausada: [{ accion: 'reanudar', label: 'Reanudar' }, { accion: 'cancelar', label: 'Cancelar' }],
}

export function CampaignCard({ campaign: c }: { campaign: CampaignRow }) {
  const counts = c.campaign_recipients.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{c.name}</h2>
          <p className="text-sm text-slate-600">
            {STATUS[c.status] ?? c.status} · plantilla {c.templates?.name ?? '—'} · tandas de {c.batch_size}
          </p>
        </div>
        <div className="flex gap-2">
          {(ACTIONS[c.status] ?? []).map((a) => (
            <form key={a.accion} action={setCampaignStatusAction}>
              <input type="hidden" name="campaignId" value={c.id} />
              <input type="hidden" name="accion" value={a.accion} />
              <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${a.accion === 'cancelar' ? 'border border-slate-300 bg-white' : 'bg-teal-700 text-white'}`}>
                {a.label}
              </button>
            </form>
          ))}
        </div>
      </div>
      {c.paused_reason && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{c.paused_reason}</p>}
      <p className="mt-3 text-sm">
        Pendientes {counts.pendiente ?? 0} · Enviados {counts.enviado ?? 0} · Fallidos {counts.fallido ?? 0} · Omitidos {counts.omitido ?? 0}
      </p>
      {c.risk_report && <RiskReportView report={c.risk_report} />}
    </article>
  )
}
