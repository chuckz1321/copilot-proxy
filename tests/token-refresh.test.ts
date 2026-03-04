import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { TOKEN_RETRY_DELAYS } from '~/lib/constants'
import { state } from '~/lib/state'
import { refreshTokenWithRetry } from '~/lib/token'

describe('refreshTokenWithRetry', () => {
  let originalCopilotToken: string | undefined
  let originalShowToken: boolean

  const createFailureState = () => ({ consecutiveFailures: 0 })

  beforeEach(() => {
    originalCopilotToken = state.copilotToken
    originalShowToken = state.showToken
    state.showToken = false
  })

  afterEach(() => {
    state.copilotToken = originalCopilotToken
    state.showToken = originalShowToken
  })

  test('refreshes token on first attempt', async () => {
    const fetchToken = mock(async () => ({
      token: 'token-success',
      refresh_in: 3600,
      expires_at: Date.now() + 3600 * 1000,
    }))
    const sleepFn = mock(async (_ms: number) => {})
    const failureState = createFailureState()

    await refreshTokenWithRetry({
      fetchToken,
      sleepFn,
      failureState,
    })

    expect(fetchToken).toHaveBeenCalledTimes(1)
    expect(sleepFn).toHaveBeenCalledTimes(0)
    expect(state.copilotToken).toBe('token-success')
  })

  test('retries with configured delays before succeeding', async () => {
    let attempts = 0
    const fetchToken = mock(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error(`temporary-${attempts}`)
      }
      return {
        token: 'token-after-retry',
        refresh_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      }
    })

    const sleepFn = mock(async (_ms: number) => {})
    const failureState = createFailureState()

    await refreshTokenWithRetry({
      fetchToken,
      sleepFn,
      failureState,
    })

    expect(fetchToken).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2)
    const sleepCalls = sleepFn.mock.calls as Array<[number]>
    expect(sleepCalls[0][0]).toBe(TOKEN_RETRY_DELAYS[0])
    expect(sleepCalls[1][0]).toBe(TOKEN_RETRY_DELAYS[1])
    expect(state.copilotToken).toBe('token-after-retry')
  })

  test('stops after max retries and keeps previous token', async () => {
    state.copilotToken = 'token-before-failures'
    const fetchToken = mock(async () => {
      throw new Error('always-fail')
    })
    const sleepFn = mock(async (_ms: number) => {})
    const failureState = createFailureState()

    await refreshTokenWithRetry({
      fetchToken,
      sleepFn,
      failureState,
    })

    // 1 initial attempt + 3 retries
    expect(fetchToken).toHaveBeenCalledTimes(4)
    expect(sleepFn).toHaveBeenCalledTimes(3)
    const sleepCalls = sleepFn.mock.calls as Array<[number]>
    expect(sleepCalls[0][0]).toBe(TOKEN_RETRY_DELAYS[0])
    expect(sleepCalls[1][0]).toBe(TOKEN_RETRY_DELAYS[1])
    expect(sleepCalls[2][0]).toBe(TOKEN_RETRY_DELAYS[2])
    expect(state.copilotToken).toBe('token-before-failures')
  })
})
