import { describe, expect, it } from 'vitest'
import { normalizeWaId, parseContactsCsv, toCsv } from './parse-contacts-csv'

describe('parseContactsCsv', () => {
  it('acepta encabezado, nombres, separadores y celulares colombianos sin indicativo', () => {
    const r = parseContactsCsv('telefono,nombre\n3001234567,Ana Pérez\n+52 1 55 1234 5678;Luis\n3001234567,Duplicado\nabc,Malo\n')
    expect(r.contacts).toEqual([
      { waId: '573001234567', name: 'Ana Pérez' },
      { waId: '5215512345678', name: 'Luis' },
    ])
    expect(r.rejected).toEqual([{ line: 5, value: 'abc', reason: 'Número inválido' }])
  })

  it('normalizeWaId rechaza longitudes imposibles', () => {
    expect(normalizeWaId('123')).toBeNull()
    expect(normalizeWaId('+57 300 123 4567')).toBe('573001234567')
  })
})

describe('toCsv', () => {
  it('escapa comillas y evita fórmulas', () => {
    const csv = toCsv([{ nombre: 'Ana "La jefa"', nota: '=HYPERLINK("x")' }])
    expect(csv).toBe('nombre,nota\n"Ana ""La jefa""","\'=HYPERLINK(""x"")"')
  })
})
