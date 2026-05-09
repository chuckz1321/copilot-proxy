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
})

function setIsTTY(stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean | undefined): void {
  Object.defineProperty(stream, 'isTTY', {
    configurable: true,
    value,
  })
}
