import type { State } from './state'

import consola from 'consola'

import { HTTPError } from './error'
import { sleep } from './utils'

export async function checkRateLimit(state: State) {
  if (state.rateLimitSeconds === undefined)
    return

  const now = Date.now()

  if (!state.lastRequestTimestamp) {
    state.lastRequestTimestamp = now
    return
  }

  const requiredGapMs = state.rateLimitSeconds * 1000
  const elapsedMs = now - state.lastRequestTimestamp

  if (elapsedMs >= requiredGapMs) {
    state.lastRequestTimestamp = now
    return
  }

  const waitTimeMs = requiredGapMs - elapsedMs
  const waitTimeSeconds = Math.ceil(waitTimeMs / 1000)

  if (!state.rateLimitWait) {
    consola.warn(
      `Rate limit exceeded. Need to wait ${waitTimeSeconds} more seconds.`,
    )
    throw new HTTPError(
      'Rate limit exceeded',
      Response.json({ message: 'Rate limit exceeded' }, { status: 429 }),
    )
  }

  // Reserve the slot this request will occupy after waiting. Concurrent
  // requests see this future timestamp and queue behind it instead of waking
  // up in the same burst.
  state.lastRequestTimestamp = now + waitTimeMs

  consola.warn(
    `Rate limit reached. Waiting ${waitTimeSeconds} seconds before proceeding...`,
  )
  await sleep(waitTimeMs)

  consola.info('Rate limit wait completed, proceeding with request')
}
