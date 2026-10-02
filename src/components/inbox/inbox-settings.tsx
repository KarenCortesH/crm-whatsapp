'use client'

import { useActionState } from 'react'
import { createTagAction, saveQuickReplyAction } from '@/app/panel/actions/inbox'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = {
  tags: Array<{ id: string; name: string; color: string }>
  quickReplies: Array<{ id: string; shortcut: string; body: string }>
}

export function InboxSettings({ tags, quickReplies }: Props) {
  const [tagState, tagAction] = useActionState(createTagAction, null)
  const [qrState, qrAction] = useActionState(saveQuickReplyAction, null)
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold">Etiquetas y respuestas rápidas</summary>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <form action={tagAction} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">Etiquetas: {tags.map((t) => `#${t.name}`).join(' ') || 'ninguna'}</p>
          <div className="flex gap-2">
            <input name="name" required maxLength={40} placeholder="Nueva etiqueta" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base" />
            <input name="color" type="color" defaultValue="#0f766e" aria-label="Color" className="h-11 w-12 rounded-lg border border-slate-300" />
          </div>
          <FormMessage state={tagState} />
          <SubmitButton variant="secondary">Crear etiqueta</SubmitButton>
        </form>
        <form action={qrAction} className="flex flex-col gap-3">
          <ul className="text-sm text-slate-600">
            {quickReplies.map((q) => (
              <li key={q.id}><code className="font-semibold">{q.shortcut}</code> — {q.body.slice(0, 60)}</li>
            ))}
          </ul>
          <input name="shortcut" required placeholder="/horario" className="rounded-lg border border-slate-300 px-3 py-2 text-base" />
          <textarea name="body" required rows={2} placeholder="Atendemos de lunes a sábado de 8 a 6." className="rounded-lg border border-slate-300 px-3 py-2 text-base" />
          <FormMessage state={qrState} />
          <SubmitButton variant="secondary">Guardar respuesta rápida</SubmitButton>
        </form>
      </div>
    </details>
  )
}
