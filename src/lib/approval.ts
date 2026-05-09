import process from 'node:process'
import consola from 'consola'

import { HTTPError } from './error'

const DEFAULT_APPROVAL_TIMEOUT_MS = 30_000

export async function awaitApproval(options?: { timeoutMs?: number }) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    consola.warn('Manual approval is enabled, but no interactive TTY is available; allowing request to avoid blocking the server.')
    return
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS
  const response = await Promise.race([
    consola.prompt(`Accept incoming request?`, {
      type: 'confirm',
    }),
    approvalTimeout(timeoutMs),
  ])

  if (response === 'timeout') {
    consola.warn(`Manual approval timed out after ${timeoutMs}ms; allowing request to avoid blocking the server.`)
    return
  }

  if (!response) {
    throw new HTTPError(
      'Request rejected',
      Response.json({ message: 'Request rejected' }, { status: 403 }),
    )
  }
}

function approvalTimeout(timeoutMs: number): Promise<'timeout'> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs, 'timeout')
    timer.unref?.()
  })
}
