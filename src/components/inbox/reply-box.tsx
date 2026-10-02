'use client'

import { useActionState, useRef, useState } from 'react'
import { sendReplyAction, type InboxState } from '@/app/panel/actions/inbox'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = {
  conversationId: string
  windowOpen: boolean
  hoursLeft: number
  quickReplies: Array<{ shortcut: string; body: string }>
}

export function ReplyBox({ conversationId, windowOpen, hoursLeft, quickReplies }: Props) {
  const [text, setText] = useState('')
  const [state, action] = useActionState(async (prev: InboxState, formData: FormData) => {
    const result = await sendReplyAction(prev, formData)
    if (result?.ok) setText('')
    return result
  }, null)
  const formRef = useRef<HTMLFormElement>(null)

  if (!windowOpen) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Pasaron más de 24 h desde el último mensaje del cliente. Solo puedes escribirle con una plantilla aprobada.
      </p>
    )
  }

  const suggestions = text.startsWith('/') ? quickReplies.filter((q) => q.shortcut.startsWith(text.split(' ')[0])) : []

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <li key={q.shortcut}>
              <button type="button" onClick={() => setText(q.body)} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                {q.shortcut}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        name="text"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            formRef.current?.requestSubmit()
          }
        }}
        placeholder="Escribe una respuesta… (/ para respuestas rápidas)"
        className="rounded-lg border border-slate-300 px-3 py-2 text-base"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Ventana abierta: quedan {Math.floor(hoursLeft)} h</span>
        <SubmitButton>Enviar</SubmitButton>
      </div>
      <FormMessage state={state?.error ? state : null} />
    </form>
  )
}
