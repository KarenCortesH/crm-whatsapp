export function HealthStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  )
}
