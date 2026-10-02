import { createHmac, timingSafeEqual } from 'node:crypto'

/** Kapso firma el cuerpo crudo con HMAC-SHA256 (hex) en `X-Webhook-Signature`. */
export function verifyKapsoSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const given = signature.trim().replace(/^sha256=/i, '')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(given, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function signForTest(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}
