'use client'

import { useActionState } from 'react'
import { recheckHealthAction } from '@/app/panel/actions/health'
import { SubmitButton } from '@/components/ui/submit-button'

export function RecheckButton() {
  const [state, action] = useActionState(recheckHealthAction, null)
  return (
    <form action={action} className="flex items-center gap-3">
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      <SubmitButton variant="secondary">Revisar ahora</SubmitButton>
    </form>
  )
}
