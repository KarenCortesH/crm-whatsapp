'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' }) {
  const { pending } = useFormStatus()
  const styles = {
    primary: 'bg-teal-700 text-white hover:bg-teal-800',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    danger: 'bg-red-700 text-white hover:bg-red-800',
  }[variant]
  return (
    <button disabled={pending} className={`rounded-lg px-4 py-3 font-semibold disabled:opacity-60 ${styles}`}>
      {pending ? 'Procesando…' : children}
    </button>
  )
}
