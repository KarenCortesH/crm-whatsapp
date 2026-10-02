import type { TemplateAnalyzer, TemplateDraft, LlmAnalysis } from '../types'
import { ANALYZER_SYSTEM_PROMPT, analyzerUserPrompt } from './analyzer-prompt'
import { parseLlmAnalysis } from './parse-llm-analysis'

type Options = { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch }

/** DeepSeek expone una API compatible con OpenAI (chat/completions con modo JSON). */
export class DeepSeekAnalyzer implements TemplateAnalyzer {
  readonly name = 'deepseek'

  constructor(private readonly opts: Options) {}

  async analyze(draft: TemplateDraft): Promise<LlmAnalysis> {
    const doFetch = this.opts.fetchImpl ?? fetch
    const res = await doFetch(`${this.opts.baseUrl ?? 'https://api.deepseek.com'}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.opts.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
          { role: 'user', content: analyzerUserPrompt(draft) },
        ],
      }),
    })
    if (!res.ok) throw new Error(`DeepSeek respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = (await res.json()) as { model?: string; choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek no devolvió contenido')
    return parseLlmAnalysis(content, draft.body, data.model ?? this.opts.model)
  }
}
