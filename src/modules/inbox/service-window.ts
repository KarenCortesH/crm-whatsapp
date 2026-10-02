export const SERVICE_WINDOW_HOURS = 24

/** Dentro de las 24 h desde el último mensaje del cliente se puede responder con texto libre. */
export function serviceWindow(lastInboundAt: string | Date | null, now = new Date()) {
  if (!lastInboundAt) return { open: false, closesAt: null as Date | null, hoursLeft: 0 }
  const closesAt = new Date(new Date(lastInboundAt).getTime() + SERVICE_WINDOW_HOURS * 3_600_000)
  const msLeft = closesAt.getTime() - now.getTime()
  return { open: msLeft > 0, closesAt, hoursLeft: Math.max(0, msLeft / 3_600_000) }
}

/** Expande un atajo "/saludo" con las respuestas rápidas del equipo. */
export function expandQuickReply(text: string, replies: Array<{ shortcut: string; body: string }>): string {
  const m = text.match(/^\/(\S+)$/)
  if (!m) return text
  const hit = replies.find((r) => r.shortcut.replace(/^\//, '').toLowerCase() === m[1].toLowerCase())
  return hit ? hit.body : text
}
