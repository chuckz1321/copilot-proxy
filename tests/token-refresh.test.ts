import { describe, expect, test } from 'bun:test'

describe('refreshTokenWithRetry', () => {
  test('module exports refreshTokenWithRetry', async () => {
    const tokenModule = await import('~/lib/token')
    expect(typeof tokenModule.refreshTokenWithRetry).toBe('function')
  })
})
