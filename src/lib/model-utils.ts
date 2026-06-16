import type { Model, ModelsResponse } from '~/services/copilot/get-models'

/**
 * Find a model by ID, with fallback suffix stripping for future model variants.
 * e.g., "gpt-5.2-codex-experimental-latency" tries exact, then falls back to
 * "gpt-5.2-codex" when that base model is present.
 */
export function findModelWithFallback(modelId: string, models: Array<Model> | undefined): Model | undefined {
  if (!models)
    return undefined

  const exact = models.find(model => model.id === modelId)
  if (exact)
    return exact

  const prefixMatch = models
    .filter(model => modelId.startsWith(`${model.id}-`))
    .sort((a, b) => b.id.length - a.id.length)[0]
  if (prefixMatch)
    return prefixMatch

  return undefined
}

/**
 * Get a model's max_output_tokens from the models list.
 * Returns undefined if model not found or has no limit.
 */
export function findModelMaxOutputTokens(modelId: string, models: ModelsResponse | undefined): number | undefined {
  const model = findModelWithFallback(modelId, models?.data)
  return model?.capabilities?.limits?.max_output_tokens
}
