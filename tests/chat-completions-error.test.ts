import { describe, expect, test } from 'bun:test'

import { state } from '~/lib/state'
import { server } from '~/server'

describe('chat-completions error paths', () => {
  test('invalid JSON body returns 400 with invalid_request_error', async () => {
    const res = await server.request('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '<<<not json>>>',
    })

    expect(res.status).toBe(400)
    const json = await res.json() as { error: { type: string } }
    expect(json.error.type).toBe('invalid_request_error')
  })

  test('missing "model" field returns 400', async () => {
    const res = await server.request('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })

    expect(res.status).toBe(400)
    const json = await res.json() as { error: { type: string } }
    expect(json.error.type).toBe('invalid_request_error')
  })

  test('missing "messages" field returns 400', async () => {
    const res = await server.request('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o' }),
    })

    expect(res.status).toBe(400)
    const json = await res.json() as { error: { type: string } }
    expect(json.error.type).toBe('invalid_request_error')
  })

  test('rate limit exceeded returns 429', async () => {
    const origRateLimitSeconds = state.rateLimitSeconds
    const origRateLimitWait = state.rateLimitWait
    const origCopilotToken = state.copilotToken
    const origLastRequestTimestamp = state.lastRequestTimestamp

    try {
      state.rateLimitSeconds = 9999
      state.rateLimitWait = false
      state.copilotToken = 'fake-token'
      state.lastRequestTimestamp = undefined

      const validBody = JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      })

      // First request: passes rate limit check (sets timestamp), but will
      // fail downstream at createChatCompletions (no real backend) -> 500.
      // That's fine — we only care that the timestamp gets set.
      await server.request('/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: validBody,
      })

      // Second request: checkRateLimit sees the recent timestamp and
      // throws HTTPError(429) because rateLimitWait is false.
      const res = await server.request('/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: validBody,
      })

      expect(res.status).toBe(429)
    }
    finally {
      state.rateLimitSeconds = origRateLimitSeconds
      state.rateLimitWait = origRateLimitWait
      state.copilotToken = origCopilotToken
      state.lastRequestTimestamp = origLastRequestTimestamp
    }
  })
})
