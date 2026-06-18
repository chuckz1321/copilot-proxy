import process from 'node:process'
import consola from 'consola'

import { HTTPError } from './error'

const DEFAULT_APPROVAL_TIMEOUT_MS = 30_000
let approvalQueue: Promise<void> = Promise.resolve()

export async function awaitApproval(options?: { timeoutMs?: number }) {
  const run = approvalQueue.then(
    () => awaitApprovalUnqueued(options),
    () => awaitApprovalUnqueued(options),
  )
  approvalQueue = run.catch(() => {})
  return run
}

async function awaitApprovalUnqueued(options?: { timeoutMs?: number }) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    consola.warn('Manual approval is enabled, but no interactive TTY is available; allowing request to avoid blocking the server.')
    return
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS
  const controller = new AbortController()
  let timedOut = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true
      controller.abort('manual approval timed out')
      resolve('timeout')
    }, timeoutMs)
    timeout.unref?.()
  })
  const promptPromise = consola.prompt(`Accept incoming request?`, {
    type: 'confirm',
    cancel: 'symbol',
    signal: controller.signal,
  } as Parameters<typeof consola.prompt>[1] & { signal: AbortSignal })

  const response = await Promise.race([
    promptPromise,
    timeoutPromise,
  ])
  if (timeout)
    clearTimeout(timeout)

  if (response === 'timeout' || timedOut) {
    consola.warn(`Manual approval timed out after ${timeoutMs}ms; allowing request to avoid blocking the server.`)
    return
  }

  if (typeof response === 'symbol') {
    throw new HTTPError(
      'Request rejected',
      Response.json({ message: 'Request rejected' }, { status: 403 }),
    )
  }

  if (!response) {
    throw new HTTPError(
      'Request rejected',
      Response.json({ message: 'Request rejected' }, { status: 403 }),
    )
  }
}
