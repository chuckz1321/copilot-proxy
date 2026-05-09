import { describe, expect, test } from 'bun:test'

import { generateEnvScript } from '~/lib/shell'

describe('generateEnvScript', () => {
  test('quotes POSIX environment values', () => {
    const command = generateEnvScript(
      {
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:4899/v1?x=1&y=2',
        ANTHROPIC_MODEL: `model with 'quote`,
        EMPTY: undefined,
      },
      'claude',
      { shell: 'bash' },
    )

    expect(command).toBe(
      `export ANTHROPIC_BASE_URL='http://127.0.0.1:4899/v1?x=1&y=2' ANTHROPIC_MODEL='model with '\\''quote' && claude`,
    )
  })

  test('quotes fish environment values', () => {
    const command = generateEnvScript(
      {
        ANTHROPIC_MODEL: 'model with spaces',
      },
      'claude',
      { shell: 'fish' },
    )

    expect(command).toBe(`set -gx ANTHROPIC_MODEL 'model with spaces' && claude`)
  })

  test('quotes PowerShell environment values and uses a compatible separator', () => {
    const command = generateEnvScript(
      {
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:4899/v1',
        ANTHROPIC_MODEL: `model with 'quote`,
      },
      'claude',
      { shell: 'powershell' },
    )

    expect(command).toBe(
      `$env:ANTHROPIC_BASE_URL = 'http://127.0.0.1:4899/v1'; $env:ANTHROPIC_MODEL = 'model with ''quote'; claude`,
    )
  })

  test('uses safe cmd set syntax for values with spaces', () => {
    const command = generateEnvScript(
      {
        ANTHROPIC_MODEL: 'model with spaces',
      },
      'claude',
      { shell: 'cmd' },
    )

    expect(command).toBe(`set "ANTHROPIC_MODEL=model with spaces" & claude`)
  })

  test('returns the command when there are no environment values', () => {
    expect(generateEnvScript({ EMPTY: undefined }, 'claude', { shell: 'bash' })).toBe('claude')
  })
})
