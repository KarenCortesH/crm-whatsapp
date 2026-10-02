import type { CategoryProbabilities } from '@/modules/templates/types'

const ROWS: Array<{ key: keyof CategoryProbabilities; label: string; color: string }> = [
  { key: 'utility', label: 'Utilidad', color: 'bg-green-600' },
  { key: 'marketing', label: 'Marketing', color: 'bg-amber-500' },
  { key: 'authentication', label: 'Autenticación', color: 'bg-sky-600' },
]

export function ProbabilityBars({ probabilities }: { probabilities: CategoryProbabilities }) {
  return (
    <dl className="flex flex-col gap-2">
      {ROWS.map((r) => {
        const pct = Math.round(probabilities[r.key] * 100)
        return (
          <div key={r.key} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
            <dt>{r.label}</dt>
            <dd className="h-3 overflow-hidden rounded-full bg-white">
              <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
            </dd>
            <dd className="text-right font-semibold tabular-nums">{pct}%</dd>
          </div>
        )
      })}
    </dl>
  )
}
