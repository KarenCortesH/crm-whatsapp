export function FormMessage({ state }: { state: { error?: string; ok?: string } | null }) {
  if (!state) return null
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
  if (state.ok) return <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{state.ok}</p>
  return null
}
