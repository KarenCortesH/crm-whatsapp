const STYLES: Record<string, { label: string; cls: string }> = {
  GREEN: { label: 'Calidad verde', cls: 'bg-green-100 text-green-900' },
  YELLOW: { label: 'Calidad amarilla', cls: 'bg-amber-100 text-amber-900' },
  RED: { label: 'Calidad roja', cls: 'bg-red-100 text-red-900' },
}

export function QualityBadge({ rating }: { rating: string | null }) {
  const s = STYLES[rating ?? ''] ?? { label: 'Calidad sin datos', cls: 'bg-slate-100 text-slate-700' }
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}
