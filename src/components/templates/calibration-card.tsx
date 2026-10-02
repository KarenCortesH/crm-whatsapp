import { formatPct } from '@/lib/format'
import type { CalibrationReport } from '@/modules/templates/calibration'

export function CalibrationCard({ report }: { report: CalibrationReport }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">¿Qué tan bien acierta el calificador?</h2>
      {report.total === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Aún no hay plantillas con categoría final de Meta. Cada vez que Meta decide, comparamos y afinamos el porcentaje.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            Acertó la categoría en <strong>{formatPct(report.accuracy ?? 0)}</strong> de {report.total} plantillas.
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-medium">Cuando dijimos marketing…</th>
                <th className="py-1 font-medium">Meta dijo marketing</th>
                <th className="py-1 font-medium">Casos</th>
              </tr>
            </thead>
            <tbody>
              {report.marketingBuckets.map((b) => (
                <tr key={b.from} className="border-t border-slate-100">
                  <td className="py-1">{formatPct(b.from)}–{formatPct(b.to)}</td>
                  <td className="py-1">{formatPct(b.observedRate)}</td>
                  <td className="py-1">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
