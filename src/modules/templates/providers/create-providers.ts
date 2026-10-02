import 'server-only'
import { serverEnv } from '@/lib/env'
import type { CategoryScorer, TemplateAnalyzer } from '../types'
import { DeepSeekAnalyzer } from './deepseek-analyzer'
import { JevScorer } from './jev-scorer'

export function createTemplateAnalyzer(): TemplateAnalyzer {
  const env = serverEnv()
  switch (env.TEMPLATE_LLM_PROVIDER) {
    case 'deepseek':
      if (!env.DEEPSEEK_API_KEY) throw new Error('Falta DEEPSEEK_API_KEY para calificar plantillas')
      return new DeepSeekAnalyzer({ apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL })
  }
}

export function createCategoryScorer(): CategoryScorer | null {
  const env = serverEnv()
  return env.TYPESAFE_API_KEY ? new JevScorer({ apiKey: env.TYPESAFE_API_KEY, model: env.TYPESAFE_MODEL }) : null
}
