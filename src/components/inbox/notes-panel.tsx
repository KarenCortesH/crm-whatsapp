'use client'

import { useActionState } from 'react'
import { addNoteAction } from '@/app/panel/actions/inbox'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'

export type NoteRow = { id: string; body: string; created_at: string; author_id: string | null }

export function NotesPanel({ conversationId, notes }: { conversationId: string; notes: Array<NoteRow & { author: string }> }) {
  const [state, action] = useActionState(addNoteAction, null)
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="font-semibold">Notas internas</h2>
      <p className="text-xs text-amber-900">El cliente no las ve.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg bg-white p-2 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-xs text-slate-500">{n.author}</p>
          </li>
        ))}
      </ul>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea name="body" rows={2} required className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-base" placeholder="Agregar nota" />
        <FormMessage state={state?.error ? state : null} />
        <SubmitButton variant="secondary">Guardar nota</SubmitButton>
      </form>
    </section>
  )
}
