import { describe, expect, it, vi } from 'vitest'
import { computeCalibration } from './calibration'
import { allowRewrite, decideVerdict } from './decide-verdict'
import { gradeTemplate } from './grade-template'
import { DeepSeekAnalyzer } from './providers/deepseek-analyzer'
import { JevScorer, toCategoryProbabilities } from './providers/jev-scorer'
import { parseLlmAnalysis } from './providers/parse-llm-analysis'
import type { CategoryScorer, LlmAnalysis, TemplateAnalyzer, TemplateDraft } from './types'

const promo: TemplateDraft = {
  name: 'promo_octubre',
  body: 'Hola {{1}}, tu pedido llegó. ¡Aprovecha 20% de descuento en tu próxima compra!',
  requestedCategory: 'UTILITY',
}
const info: TemplateDraft = {
  name: 'pedido_enviado',
  body: 'Hola {{1}}, tu pedido {{2}} fue enviado y llega el {{3}}.',
  requestedCategory: 'UTILITY',
}

const fakeAnalyzer = (a: Partial<LlmAnalysis>): TemplateAnalyzer => ({
  name: 'fake',
  analyze: async () => ({
    probabilities: { utility: 0.8, marketing: 0.15, authentication: 0.05 },
    promotional: false,
    marketingPhrases: [],
    suggestedRewrite: 'texto reescrito',
    model: 'fake-1',
    ...a,
  }),
})

describe('decideVerdict', () => {
  it('lo promocional es marketing aunque las probabilidades digan utilidad', () => {
    expect(decideVerdict({ probabilities: { utility: 0.9, marketing: 0.1, authentication: 0 }, promotional: 0.8, requested: 'UTILITY' })).toBe('marketing')
  })
  it('utilidad clara', () => {
    expect(decideVerdict({ probabilities: { utility: 0.85, marketing: 0.1, authentication: 0.05 }, promotional: 0.05, requested: 'UTILITY' })).toBe('utilidad')
  })
  it('zona gris → dudosa', () => {
    expect(decideVerdict({ probabilities: { utility: 0.5, marketing: 0.35, authentication: 0.15 }, promotional: 0.2, requested: 'UTILITY' })).toBe('dudosa')
  })
  it('nunca se ofrece reescritura si es marketing o promocional', () => {
    expect(allowRewrite('marketing', 0)).toBe(false)
    expect(allowRewrite('dudosa', 0.9)).toBe(false)
    expect(allowRewrite('dudosa', 0.1)).toBe(true)
  })
})

describe('parseLlmAnalysis', () => {
  it('normaliza, filtra frases inventadas y anula la reescritura si es promocional', () => {
    const raw = '```json\n' + JSON.stringify({
      probabilities: { utility: 2, marketing: 6, authentication: 2 },
      promotional: true,
      marketing_phrases: [
        { phrase: '20% de descuento', reason: 'oferta' },
        { phrase: 'frase que no existe', reason: 'x' },
      ],
      suggested_rewrite: 'intento de disfrazar',
    }) + '\n```'
    const r = parseLlmAnalysis(raw, promo.body, 'm')
    expect(r.probabilities.marketing).toBeCloseTo(0.6)
    expect(r.marketingPhrases).toHaveLength(1)
    expect(r.suggestedRewrite).toBeNull()
  })
})

describe('gradeTemplate', () => {
  it('marketing disfrazado: dice "envíala como marketing" y no reescribe', async () => {
    const g = await gradeTemplate(promo, fakeAnalyzer({ promotional: true, suggestedRewrite: 'x' }), null)
    expect(g.verdict).toBe('marketing')
    expect(g.suggestedRewrite).toBeNull()
    expect(g.advice).toContain('envíala como marketing')
  })

  it('si Jev detecta promoción, gana aunque el LLM diga que no', async () => {
    const scorer: CategoryScorer = {
      name: 'jev',
      score: async () => ({ probabilities: { utility: 0.7, marketing: 0.3, authentication: 0 }, promotional: 0.93, model: 'jev-1.13.0' }),
    }
    const g = await gradeTemplate(promo, fakeAnalyzer({}), scorer)
    expect(g.verdict).toBe('marketing')
    expect(g.probabilitySource).toBe('jev')
    expect(g.suggestedRewrite).toBeNull()
    expect(g.models).toEqual(['fake-1', 'jev-1.13.0'])
  })

  it('informativa: conserva la reescritura y usa utilidad', async () => {
    const g = await gradeTemplate(info, fakeAnalyzer({}), null)
    expect(g.verdict).toBe('utilidad')
    expect(g.suggestedRewrite).toBe('texto reescrito')
  })

  it('si Jev falla, sigue con el analizador', async () => {
    const scorer: CategoryScorer = { name: 'jev', score: async () => { throw new Error('529') } }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const g = await gradeTemplate(info, fakeAnalyzer({}), scorer)
    expect(g.probabilitySource).toBe('fake')
  })
})

describe('JevScorer (HTTP)', () => {
  it('envía el contrato de /v1/systemone y quita la opción de escape', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body))
      expect(sent.state).toEqual({ template: { body: info.body } })
      expect(Object.keys(sent.questions)).toEqual(['category', 'promotional'])
      return new Response(
        JSON.stringify({
          model: 'jev-1.13.0',
          answers: {
            category: { type: 'choice', choice: 'utility', confidence: 0.8, probabilities: { utility: 0.72, marketing: 0.18, authentication: 0, none_of_the_above: 0.1 } },
            promotional: { type: 'noul', noul: 0.04 },
          },
          usage: { input_tokens: 300, output_tokens: 10 },
        }),
        { status: 200 },
      )
    })
    const r = await new JevScorer({ apiKey: 'k', model: 'jev-1.13.0', fetchImpl: fetchImpl as typeof fetch }).score(info)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.typesafe.ai/v1/systemone')
    expect(r.probabilities.utility).toBeCloseTo(0.8)
    expect(r.promotional).toBe(0.04)
  })

  it('reintenta ante 429', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls++
      if (calls === 1) return new Response('lento', { status: 429, headers: { 'retry-after': '0' } })
      return new Response(JSON.stringify({ model: 'jev', answers: { category: { type: 'choice', choice: 'utility', confidence: 1, probabilities: { utility: 1 } }, promotional: { type: 'noul', noul: 0 } } }))
    })
    await new JevScorer({ apiKey: 'k', model: 'jev', fetchImpl: fetchImpl as typeof fetch }).score(info)
    expect(calls).toBe(2)
  })

  it('toCategoryProbabilities renormaliza sin la opción de escape', () => {
    const p = toCategoryProbabilities({ utility: 0.45, marketing: 0.45, authentication: 0, none_of_the_above: 0.1 })
    expect(p.utility + p.marketing + p.authentication).toBeCloseTo(1)
    expect(p.utility).toBeCloseTo(0.5)
  })
})

describe('DeepSeekAnalyzer (HTTP)', () => {
  it('pide modo JSON y parsea la respuesta', async () => {
    const fetchImpl = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body))
      expect(sent.response_format).toEqual({ type: 'json_object' })
      expect(sent.temperature).toBe(0)
      return new Response(JSON.stringify({
        model: 'deepseek-chat',
        choices: [{ message: { content: JSON.stringify({ probabilities: { utility: 0.9, marketing: 0.05, authentication: 0.05 }, promotional: false, marketing_phrases: [], suggested_rewrite: null }) } }],
      }))
    })
    const a = await new DeepSeekAnalyzer({ apiKey: 'k', model: 'deepseek-chat', fetchImpl: fetchImpl as typeof fetch }).analyze(info)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions')
    expect(a.probabilities.utility).toBeCloseTo(0.9)
  })
})

describe('computeCalibration', () => {
  it('mide acierto, Brier y calibración de marketing', () => {
    const r = computeCalibration([
      { p_utility: 0.9, p_marketing: 0.1, p_authentication: 0, final_meta_category: 'UTILITY' },
      { p_utility: 0.2, p_marketing: 0.8, p_authentication: 0, final_meta_category: 'MARKETING' },
      { p_utility: 0.7, p_marketing: 0.3, p_authentication: 0, final_meta_category: 'MARKETING' },
      { p_utility: 0.1, p_marketing: 0.1, p_authentication: 0.8, final_meta_category: 'basura' },
    ])
    expect(r.total).toBe(3)
    expect(r.accuracy).toBeCloseTo(2 / 3)
    expect(r.brier).toBeGreaterThan(0)
    expect(r.marketingBuckets.reduce((a, b) => a + b.count, 0)).toBe(3)
  })

  it('sin datos resueltos no inventa números', () => {
    expect(computeCalibration([])).toEqual({ total: 0, accuracy: null, brier: null, marketingBuckets: [] })
  })
})
