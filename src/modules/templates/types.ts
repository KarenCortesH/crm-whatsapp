export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'

export type CategoryProbabilities = { utility: number; marketing: number; authentication: number }

export type Verdict = 'utilidad' | 'marketing' | 'autenticacion' | 'dudosa'

export type TemplateDraft = {
  name: string
  body: string
  requestedCategory: TemplateCategory
  /** Contexto del negocio, para entender si el mensaje responde a algo que el cliente pidió. */
  businessContext?: string
}

/** Lo que entrega el LLM generativo: probabilidades, frases y reescritura. */
export type LlmAnalysis = {
  probabilities: CategoryProbabilities
  promotional: boolean
  marketingPhrases: Array<{ phrase: string; reason: string }>
  suggestedRewrite: string | null
  model: string
}

/** Proveedor intercambiable de análisis (DeepSeek por defecto). */
export interface TemplateAnalyzer {
  readonly name: string
  analyze(draft: TemplateDraft): Promise<LlmAnalysis>
}

/** Proveedor opcional de probabilidades calibradas (Jev). */
export interface CategoryScorer {
  readonly name: string
  score(draft: TemplateDraft): Promise<{ probabilities: CategoryProbabilities; promotional: number; model: string }>
}

export type TemplateGrade = {
  verdict: Verdict
  probabilities: CategoryProbabilities
  probabilitySource: string
  marketingPhrases: Array<{ phrase: string; reason: string }>
  suggestedRewrite: string | null
  advice: string
  models: string[]
}
