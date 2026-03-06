import { describe, expect, test } from 'bun:test'

import {
  clearProbeCache,
  getProbeOverride,
  isUnsupportedApiError,
  recordProbeResult,
} from '../src/lib/api-probe'

describe('API probe cache', () => {
  test('returns undefined when no probe exists', () => {
    clearProbeCache()
    expect(getProbeOverride('unknown-model', 'chat-completions')).toBeUndefined()
  })

  test('records and retrieves probe result', () => {
    clearProbeCache()
    recordProbeResult('gpt-new', 'chat-completions')
    expect(getProbeOverride('gpt-new', 'chat-completions')).toBe('responses')
    expect(getProbeOverride('gpt-new', 'responses')).toBeUndefined()
  })

  test('records responses as unsupported', () => {
    clearProbeCache()
    recordProbeResult('claude-new', 'responses')
    expect(getProbeOverride('claude-new', 'responses')).toBe('chat-completions')
    expect(getProbeOverride('claude-new', 'chat-completions')).toBeUndefined()
  })

  test('expires entries after TTL', () => {
    clearProbeCache()

    const realNow = Date.now
    Object.defineProperty(Date, 'now', { value: () => 0, configurable: true })
    recordProbeResult('expiring-model', 'chat-completions')
    Object.defineProperty(Date, 'now', { value: () => 31 * 60 * 1000, configurable: true })

    expect(getProbeOverride('expiring-model', 'chat-completions')).toBeUndefined()

    Object.defineProperty(Date, 'now', { value: realNow, configurable: true })
  })

  test('clearProbeCache clears all entries', () => {
    clearProbeCache()
    recordProbeResult('model-a', 'chat-completions')
    recordProbeResult('model-b', 'responses')
    clearProbeCache()
    expect(getProbeOverride('model-a', 'chat-completions')).toBeUndefined()
    expect(getProbeOverride('model-b', 'responses')).toBeUndefined()
  })
})

describe('unsupported_api_for_model detection', () => {
  test('matches code field', async () => {
    const response = new Response(JSON.stringify({
      error: {
        message: 'unsupported_api_for_model',
        code: 'unsupported_api_for_model',
      },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

    expect(await isUnsupportedApiError(response)).toBe(true)
  })

  test('matches message fallback when code is absent', async () => {
    const response = new Response(JSON.stringify({
      error: {
        message: 'model failed: unsupported_api_for_model',
      },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

    expect(await isUnsupportedApiError(response)).toBe(true)
  })

  test('returns false for unrelated errors', async () => {
    const response = new Response(JSON.stringify({
      error: {
        message: 'nope',
        code: 'different_error',
      },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

    expect(await isUnsupportedApiError(response)).toBe(false)
  })
})

describe('Anthropic error format', () => {
  test('/v1/messages returns Anthropic-style errors', async () => {
    const { server } = await import('../src/server')

    const response = await server.request('/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    expect(response.status).toBe(400)
    const body = await response.json() as Record<string, unknown>
    expect(body.type).toBe('error')
    expect(body.error).toBeDefined()
    const error = body.error as Record<string, unknown>
    expect(error.type).toBe('invalid_request_error')
    expect(typeof error.message).toBe('string')
  })

  test('/v1/chat/completions returns OpenAI-style errors', async () => {
    const { server } = await import('../src/server')

    const response = await server.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    expect(response.status).toBe(400)
    const body = await response.json() as Record<string, unknown>
    expect(body.error).toBeDefined()
    const error = body.error as Record<string, unknown>
    expect(typeof error.message).toBe('string')
    expect(body.type).toBeUndefined()
  })

  test('/v1/messages validation error returns Anthropic format', async () => {
    const { server } = await import('../src/server')

    const response = await server.request('/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json() as Record<string, unknown>
    expect(body.type).toBe('error')
    expect(body.error).toBeDefined()
  })
})
