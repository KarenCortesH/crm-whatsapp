export type ParsedContact = { waId: string; name: string | null }

export type CsvParseResult = { contacts: ParsedContact[]; rejected: Array<{ line: number; value: string; reason: string }> }

/** Normaliza a dígitos con indicativo (E.164 sin "+"). Asume Colombia (57) si llegan 10 dígitos que empiezan por 3. */
export function normalizeWaId(raw: string, defaultCountry = '57'): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('3') && defaultCountry === '57') return `57${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

/** Acepta "telefono" o "telefono,nombre" por línea, con o sin encabezado; separador coma o punto y coma. */
export function parseContactsCsv(text: string, defaultCountry = '57'): CsvParseResult {
  const contacts: ParsedContact[] = []
  const rejected: CsvParseResult['rejected'] = []
  const seen = new Set<string>()
  const lines = text.split(/\r?\n/)

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const [phone, ...rest] = line.split(/[;,\t]/).map((s) => s.trim().replace(/^"|"$/g, ''))
    if (i === 0 && /tel|phone|n[uú]mero|celular/i.test(phone)) return
    const waId = normalizeWaId(phone, defaultCountry)
    if (!waId) {
      rejected.push({ line: i + 1, value: phone, reason: 'Número inválido' })
      return
    }
    if (seen.has(waId)) return
    seen.add(waId)
    contacts.push({ waId, name: rest.join(' ').trim() || null })
  })
  return { contacts, rejected }
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    // Evita inyección de fórmulas al abrir en Excel.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}
