import { describe, expect, it } from 'vitest'
import { expandQuickReply, serviceWindow } from './service-window'

describe('serviceWindow', () => {
  const now = new Date('2026-10-01T12:00:00Z')
  it('abierta dentro de 24 h', () => {
    const w = serviceWindow('2026-10-01T00:00:00Z', now)
    expect(w.open).toBe(true)
    expect(w.hoursLeft).toBeCloseTo(12)
  })
  it('cerrada después de 24 h o sin mensajes del cliente', () => {
    expect(serviceWindow('2026-09-30T11:59:00Z', now).open).toBe(false)
    expect(serviceWindow(null, now).open).toBe(false)
  })
})

describe('expandQuickReply', () => {
  const replies = [{ shortcut: '/horario', body: 'Atendemos de 8 a 6.' }]
  it('expande el atajo exacto', () => {
    expect(expandQuickReply('/horario', replies)).toBe('Atendemos de 8 a 6.')
    expect(expandQuickReply('/HORARIO', replies)).toBe('Atendemos de 8 a 6.')
  })
  it('deja el texto normal intacto', () => {
    expect(expandQuickReply('hola /horario', replies)).toBe('hola /horario')
    expect(expandQuickReply('/otro', replies)).toBe('/otro')
  })
})
