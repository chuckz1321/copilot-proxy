/**
 * Runtime API probe cache.
 *
 * When a model returns `unsupported_api_for_model`, we cache the fact that
 * it doesn't support that API type, so future requests skip straight to
 * the correct backend.
 */

import type { BackendApiType } from './model-config'

import consola from 'consola'

interface ProbeResult {
  unsupported: BackendApiType
  timestamp: number
}

/** TTL for probe cache entries (30 minutes) */
const PROBE_CACHE_TTL_MS = 30 * 60 * 1000

/** model ID → probe result */
const probeCache = new Map<string, ProbeResult>()

/**
 * Check if we've previously probed this model and found an API unsupported.
 * Returns the alternative API type if so, undefined otherwise.
 */
export function getProbeOverride(modelId: string, requestedApi: BackendApiType): BackendApiType | undefined {
  const entry = probeCache.get(modelId)
  if (!entry)
    return undefined

  // Check TTL
  if (Date.now() - entry.timestamp > PROBE_CACHE_TTL_MS) {
    probeCache.delete(modelId)
    return undefined
  }

  // If the requested API was previously found unsupported, return the other one
  if (entry.unsupported === requestedApi) {
    return requestedApi === 'chat-completions' ? 'responses' : 'chat-completions'
  }

  return undefined
}

/**
 * Record that a model doesn't support a given API type.
 */
export function recordProbeResult(modelId: string, unsupportedApi: BackendApiType): void {
  consola.debug(`Probe cache: ${modelId} does not support ${unsupportedApi}`)
  probeCache.set(modelId, {
    unsupported: unsupportedApi,
    timestamp: Date.now(),
  })
}

/**
 * Check if an HTTPError indicates `unsupported_api_for_model`.
 * Parses the error body and returns the error code if found.
 */
export async function isUnsupportedApiError(response: Response): Promise<boolean> {
  try {
    const cloned = response.clone()
    const body = await cloned.json() as Record<string, unknown>
    const error = body?.error as Record<string, unknown> | undefined
    const code = error?.code
      ?? (typeof error?.message === 'string' && error.message.includes('unsupported_api_for_model')
        ? 'unsupported_api_for_model'
        : undefined)
    return code === 'unsupported_api_for_model'
  }
  catch {
    return false
  }
}

/** Clear the probe cache (for testing) */
export function clearProbeCache(): void {
  probeCache.clear()
}
