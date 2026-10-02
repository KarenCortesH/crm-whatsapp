'use client'

import { useRef } from 'react'
import { assignAction } from '@/app/panel/actions/inbox'

type Props = { conversationId: string; assignedTo: string | null; members: Array<{ id: string; name: string }> }

export function AssignSelect({ conversationId, assignedTo, members }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <form ref={formRef} action={assignAction} className="rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Asignada a
        <select
          name="assignee"
          defaultValue={assignedTo ?? ''}
          onChange={() => formRef.current?.requestSubmit()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base font-normal"
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
    </form>
  )
}
