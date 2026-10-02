import { normalizeProbabilities } from '../decide-verdict'
import type { CategoryScorer, TemplateDraft, CategoryProbabilities } from '../types'
import { JEV_TEMPLATE_QUESTIONS } from './jev-questions'

type Options = { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch; maxRetries?: number }

type JevResponse = {
  model: string
  answers: {
    category?: { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
    promotional?: { type: 'noul'; noul: number }
  }
}

/**
 * Jev (TypeSafe System One): probabilidades calibradas de categoría.
 * No genera texto: las frases y la reescritura siguen viniendo del TemplateAnalyzer.
 */
export class JevScorer implements CategoryScorer {
  readonly name = 'jev'

  constructor(private readonly opts: Options) {}

  async score(draft: TemplateDraft) {
    const body = await this.request({
      model: this.opts.model,
      // El texto de la plantilla es contenido no confiable: va en su propio campo y se referencia por ruta.
      state: { template: { body: draft.body } },
      questions: JEV_TEMPLATE_QUESTIONS,
    })
    const category = body.answers.category
    const promotional = body.answers.promotional
    if (!category || !promotional) throw new Error('Jev no devolvió todas las respuestas')
    return {
      probabilities: toCategoryProbabilities(category.probabilities),
      promotional: promotional.noul,
      model: body.model,
    }
  }

  private async request(payload: unknown): Promise<JevResponse> {
    const doFetch = this.opts.fetchImpl ?? fetch
    const retries = this.opts.maxRetries ?? 3
    for (let attempt = 0; ; attempt++) {
      const res = await doFetch(`${this.opts.baseUrl ?? 'https://api.typesafe.ai'}/v1/systemone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) return (await res.json()) as JevResponse
      // El HTTP crudo no reintenta solo: 429 y 529 con espera exponencial.
      if ((res.status === 429 || res.status === 529) && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw new Error(`Jev respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
  }
}

/** Quita la opción de escape y renormaliza sobre las tres categorías reales. */
export function toCategoryProbabilities(p: Record<string, number>): CategoryProbabilities {
  return normalizeProbabilities({
    utility: p.utility ?? 0,
    marketing: p.marketing ?? 0,
    authentication: p.authentication ?? 0,
  })
}
