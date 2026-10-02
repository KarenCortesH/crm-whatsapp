import { formatUsd } from '@/lib/format'
import { CATEGORY_LABEL, type CategoryLine } from '@/modules/meter/compute-meter'

export function CategoryTable({ lines }: { lines: CategoryLine[] }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Por categoría</h2>
      <table className="mt-3 w-full min-w-[22rem] text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2 font-medium">Categoría</th>
            <th className="py-2 font-medium">Entregados</th>
            <th className="py-2 font-medium">Cobrables</th>
            <th className="py-2 text-right font-medium">Gasto</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.category} className="border-t border-slate-100">
              <td className="py-2">{CATEGORY_LABEL[l.category]}</td>
              <td className="py-2 tabular-nums">{l.count}</td>
              <td className="py-2 tabular-nums">{l.billableCount}</td>
              <td className="py-2 text-right tabular-nums">{l.costUsd === null ? '—' : formatUsd(l.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">Las reacciones son gratis y no aparecen aquí.</p>
    </section>
  )
}
