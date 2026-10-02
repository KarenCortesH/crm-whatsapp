import { formatUsd } from '@/lib/format'
import { FREE_SERVICE_PER_NUMBER, type MeterReport } from '@/modules/meter/compute-meter'
import { HealthStat } from '@/components/health/health-stat'

export function MeterSummary({ report }: { report: MeterReport }) {
  const pct = report.capUsedPct
  const bar = pct === null ? null : Math.min(100, pct)
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthStat label="Gasto del mes" value={formatUsd(report.totalUsd)} />
        <HealthStat label="Proyección a fin de mes" value={formatUsd(report.projectedUsd)} />
        <HealthStat label="Servicio gratis restante" value={`${report.freeServiceRemaining} de ${FREE_SERVICE_PER_NUMBER}/número`} />
        <HealthStat label="Tope" value={report.capUsd === null ? 'Sin tope' : formatUsd(report.capUsd)} />
      </dl>
      {bar !== null && (
        <div className="mt-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={bar} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${bar >= 100 ? 'bg-red-600' : bar >= 80 ? 'bg-amber-500' : 'bg-teal-600'}`} style={{ width: `${bar}%` }} />
          </div>
          <p className="mt-1 text-sm text-slate-600">{Math.round(pct!)}% del tope. Te avisamos al 50, 80 y 100%.</p>
        </div>
      )}
    </section>
  )
}
