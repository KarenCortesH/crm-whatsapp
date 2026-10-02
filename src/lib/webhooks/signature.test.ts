import { describe, expect, it } from 'vitest'
import { signForTest, verifyKapsoSignature } from './signature'

const secret = 'secreto-de-prueba-123456'
const body = '{"message":{"id":"wamid.1","text":{"body":"Hola ñandú"}}}'

describe('verifyKapsoSignature', () => {
  it('acepta una firma válida sobre el cuerpo crudo', () => {
    expect(verifyKapsoSignature(body, signForTest(body, secret), secret)).toBe(true)
  })

  it('acepta el prefijo sha256=', () => {
    expect(verifyKapsoSignature(body, `sha256=${signForTest(body, secret)}`, secret)).toBe(true)
  })

  it('rechaza si el cuerpo cambió (aunque sea el espaciado)', () => {
    const reformatted = JSON.stringify(JSON.parse(body), null, 2)
    expect(verifyKapsoSignature(reformatted, signForTest(body, secret), secret)).toBe(false)
  })

  it('rechaza un secreto distinto', () => {
    expect(verifyKapsoSignature(body, signForTest(body, 'otro-secreto-xxxxxxxx'), secret)).toBe(false)
  })

  it('rechaza firma ausente o de largo distinto', () => {
    expect(verifyKapsoSignature(body, null, secret)).toBe(false)
    expect(verifyKapsoSignature(body, 'abc', secret)).toBe(false)
  })
})
