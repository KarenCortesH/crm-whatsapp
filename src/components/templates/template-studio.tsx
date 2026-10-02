'use client'

import { useActionState, useState } from 'react'
import { gradeTemplateAction, submitTemplateAction } from '@/app/panel/actions/templates'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'
import { GradeResult } from './grade-result'

export function TemplateStudio() {
  const [graded, gradeAction] = useActionState(gradeTemplateAction, null)
  const [submitted, submitAction] = useActionState(submitTemplateAction, null)
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('UTILITY')

  const grade = graded?.grade
  const unchanged = graded?.draft?.body === body.trim()
  const canSubmit = grade && graded?.predictionId && unchanged

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={gradeAction} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre
          <input name="name" required defaultValue={graded?.draft?.name} className="rounded-lg border border-slate-300 px-3 py-3 text-base" placeholder="confirmacion_pedido" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Categoría con la que la quieres enviar
          <select name="requestedCategory" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-3 text-base">
            <option value="UTILITY">Utilidad</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Autenticación</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Texto (usa {'{{1}}'}, {'{{2}}'}… para las variables)
          <textarea
            name="body"
            required
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-3 text-base"
            placeholder="Hola {{1}}, tu pedido {{2}} fue enviado y llega el {{3}}."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ejemplos de las variables, separados por coma
          <input name="examples" defaultValue={graded?.draft?.examples} className="rounded-lg border border-slate-300 px-3 py-3 text-base" placeholder="Ana, 10234, 5 de octubre" />
        </label>
        <FormMessage state={graded?.error ? graded : null} />
        <SubmitButton>Calificar</SubmitButton>
      </form>

      <div className="flex flex-col gap-4">
        {grade ? (
          <GradeResult grade={grade} onUseRewrite={(text) => setBody(text)} />
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
            Escribe tu plantilla y presiona “Calificar” para ver el resultado aquí.
          </p>
        )}
        {canSubmit && (
          <form action={submitAction} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <input type="hidden" name="predictionId" value={graded.predictionId} />
            <input type="hidden" name="name" value={graded.draft?.name} />
            <input type="hidden" name="body" value={graded.draft?.body} />
            <input type="hidden" name="examples" value={graded.draft?.examples} />
            <input type="hidden" name="requestedCategory" value={grade.verdict === 'marketing' ? 'MARKETING' : category} />
            <p className="text-sm text-slate-700">
              Se enviará a Meta como <strong>{grade.verdict === 'marketing' ? 'Marketing' : labelFor(category)}</strong>.
            </p>
            <FormMessage state={submitted} />
            <SubmitButton>Enviar a revisión de Meta</SubmitButton>
          </form>
        )}
        {grade && !unchanged && <p className="text-sm text-amber-800">Cambiaste el texto: vuelve a calificar antes de enviarla.</p>}
      </div>
    </div>
  )
}

function labelFor(c: string) {
  return c === 'MARKETING' ? 'Marketing' : c === 'AUTHENTICATION' ? 'Autenticación' : 'Utilidad'
}
