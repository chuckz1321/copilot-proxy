import process from 'node:process'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import consola from 'consola'

import { awaitApproval } from '~/lib/approval'

const originalPrompt = consola.prompt
const originalStdinIsTTY = process.stdin.isTTY
const originalStdoutIsTTY = process.stdout.isTTY

afterEach(() => {
  consola.prompt = originalPrompt
  setIsTTY(process.stdin, originalStdinIsTTY)
  setIsTTY(process.stdout, originalStdoutIsTTY)
})

describe('awaitApproval', () => {
  test('allows without prompting when no TTY is available', async () => {
    const prompt = mock(async () => true)
    consola.prompt = prompt as unknown as typeof consola.prompt
    setIsTTY(process.stdin, false)
    setIsTTY(process.stdout, false)

    await expect(awaitApproval()).resolves.toBeUndefined()
    expect(prompt).toHaveBeenCalledTimes(0)
  })

  test('allows after prompt timeout to avoid blocking the server', async () => {
    consola.prompt = mock(async () => new Promise<boolean>(() => {})) as unknown as typeof consola.prompt
    setIsTTY(process.stdin, true)
    setIsTTY(process.stdout, true)

    await expect(awaitApproval({ timeoutMs: 5 })).resolves.toBeUndefined()
  })

  test('aborts the prompt when approval times out', async () => {
    let signal: AbortSignal | undefined
    consola.prompt = mock(async (_message: string, options?: { signal?: AbortSignal }) => {
      signal = options?.signal
      return new Promise<boolean>(() => {})
    }) as unknown as typeof consola.prompt
    setIsTTY(process.stdin, true)
    setIsTTY(process.stdout, true)

    await expect(awaitApproval({ timeoutMs: 5 })).resolves.toBeUndefined()
    expect(signal?.aborted).toBe(true)
  })

  test('serializes concurrent approval prompts', async () => {
    const resolvers: Array<(value: boolean) => void> = []
    consola.prompt = mock(async () => {
      return await new Promise<boolean>((resolve) => {
        resolvers.push(resolve)
      })
    }) as unknown as typeof consola.prompt
    setIsTTY(process.stdin, true)
    setIsTTY(process.stdout, true)

    const first = awaitApproval({ timeoutMs: 1000 })
    const second = awaitApproval({ timeoutMs: 1000 })

    await waitFor(() => resolvers.length === 1)
    expect(consola.prompt).toHaveBeenCalledTimes(1)

    resolvers[0](true)
    await first

    await waitFor(() => resolvers.length === 2)
    expect(consola.prompt).toHaveBeenCalledTimes(2)

    resolvers[1](true)
    await second
  })
})

function setIsTTY(stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean | undefined): void {
  Object.defineProperty(stream, 'isTTY', {
    configurable: true,
    value,
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 500
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
