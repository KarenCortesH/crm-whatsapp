import { adviceFor, allowRewrite, decideVerdict } from './decide-verdict'
import type { CategoryScorer, TemplateAnalyzer, TemplateDraft, TemplateGrade } from './types'

/**
 * Califica una plantilla antes de enviarla a Meta.
 * Si hay scorer calibrado (Jev) sus probabilidades mandan; el analizador aporta frases y reescritura.
 * Si el scorer falla, se sigue con las probabilidades del analizador.
 */
export async function gradeTemplate(
  draft: TemplateDraft,
  analyzer: TemplateAnalyzer,
  scorer: CategoryScorer | null,
): Promise<TemplateGrade> {
  const [analysis, scored] = await Promise.all([
    analyzer.analyze(draft),
    scorer ? scorer.score(draft).catch((err) => {
      console.warn('[plantillas] scorer no disponible, uso el analizador:', err instanceof Error ? err.message : err)
      return null
    }) : Promise.resolve(null),
  ])

  const probabilities = scored?.probabilities ?? analysis.probabilities
  // Lo promocional bloquea si CUALQUIERA de las dos fuentes lo detecta.
  const promotional = Math.max(scored?.promotional ?? 0, analysis.promotional ? 1 : 0)
  const verdict = decideVerdict({ probabilities, promotional, requested: draft.requestedCategory })

  return {
    verdict,
    probabilities,
    probabilitySource: scored ? scorer!.name : analyzer.name,
    marketingPhrases: analysis.marketingPhrases,
    suggestedRewrite: allowRewrite(verdict, promotional) ? analysis.suggestedRewrite : null,
    advice: adviceFor(verdict, draft.requestedCategory),
    models: [analysis.model, ...(scored ? [scored.model] : [])],
  }
}
