import type { RiskReport } from '@/modules/campaigns/risk-score'

const LEVEL: Record<RiskReport['level'], string> = {
  bajo: 'bg-green-100 text-green-900',
  medio: 'bg-amber-100 text-amber-900',
  alto: 'bg-red-100 text-red-900',
}

export function RiskReportView({ report }: { report: RiskReport }) {
  return (
    <div className="mt-3">
      <p className="text-sm">
        Riesgo de bloqueo:{' '}
        <span className={`rounded-full px-2 py-0.5 font-semibold ${LEVEL[report.level]}`}>
          {report.level} ({report.score}/100)
        </span>
      </p>
      {report.factors.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          {report.factors.map((f) => (
            <li key={f.key}>{f.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
