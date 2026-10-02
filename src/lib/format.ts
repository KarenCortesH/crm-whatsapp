const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export function formatAgo(iso: string | null, now = new Date()): string {
  if (!iso) return 'nunca'
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`
}
