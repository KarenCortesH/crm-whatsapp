'use client'

import type { TemplateGrade } from '@/modules/templates/types'
import { ProbabilityBars } from './probability-bars'

const VERDICT_STYLE: Record<TemplateGrade['verdict'], { label: string; cls: string }> = {
  utilidad: { label: 'Probablemente UTILIDAD', cls: 'bg-green-50 border-green-300' },
  marketing: { label: 'Esto es MARKETING', cls: 'bg-amber-50 border-amber-300' },
  autenticacion: { label: 'AUTENTICACIÓN', cls: 'bg-sky-50 border-sky-300' },
  dudosa: { label: 'Dudosa', cls: 'bg-slate-50 border-slate-300' },
}

export function GradeResult({ grade, onUseRewrite }: { grade: TemplateGrade; onUseRewrite: (text: string) => void }) {
  const style = VERDICT_STYLE[grade.verdict]
  return (
    <section className={`flex flex-col gap-4 rounded-xl border p-5 ${style.cls}`}>
      <div>
        <p className="text-lg font-bold">{style.label}</p>
        <p className="mt-1">{grade.advice}</p>
      </div>
      <ProbabilityBars probabilities={grade.probabilities} />
      <p className="text-xs text-slate-500">
        Probabilidades de: {grade.probabilitySource === 'jev' ? 'Jev (calibrado)' : grade.probabilitySource}. Es una
        estimación: la decisión final es de Meta.
      </p>

      {grade.marketingPhrases.length > 0 && (
        <div>
          <p className="font-semibold">Frases que la empujan a marketing</p>
          <ul className="mt-2 flex flex-col gap-2">
            {grade.marketingPhrases.map((p) => (
              <li key={p.phrase} className="rounded-lg bg-white/80 p-3 text-sm">
                <mark className="bg-amber-200 px-1">{p.phrase}</mark>
                {p.reason && <span className="block text-slate-600">{p.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.suggestedRewrite && (
        <div>
          <p className="font-semibold">Reescritura sugerida (solo informativa)</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/80 p-3 text-sm">{grade.suggestedRewrite}</p>
          <button
            type="button"
            onClick={() => onUseRewrite(grade.suggestedRewrite!)}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
          >
            Usar esta versión
          </button>
        </div>
      )}
    </section>
  )
}
