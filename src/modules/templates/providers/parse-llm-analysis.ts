import { z } from 'zod'
import { normalizeProbabilities } from '../decide-verdict'
import type { LlmAnalysis } from '../types'

const schema = z.object({
  probabilities: z.object({
    utility: z.coerce.number(),
    marketing: z.coerce.number(),
    authentication: z.coerce.number(),
  }),
  promotional: z.boolean(),
  marketing_phrases: z
    .array(z.object({ phrase: z.string(), reason: z.string().default('') }))
    .default([]),
  suggested_rewrite: z.string().nullable().default(null),
})

/** Valida la respuesta del LLM. Las frases deben existir literalmente en la plantilla. */
export function parseLlmAnalysis(raw: string, body: string, model: string): LlmAnalysis {
  const json = JSON.parse(extractJson(raw))
  const data = schema.parse(json)
  const lowerBody = body.toLowerCase()
  return {
    probabilities: normalizeProbabilities(data.probabilities),
    promotional: data.promotional,
    marketingPhrases: data.marketing_phrases.filter((p) => p.phrase && lowerBody.includes(p.phrase.toLowerCase())),
    suggestedRewrite: data.promotional ? null : data.suggested_rewrite?.trim() || null,
    model,
  }
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1]
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw
}
