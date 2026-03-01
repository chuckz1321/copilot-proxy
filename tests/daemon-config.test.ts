import type { DaemonConfig } from '../src/daemon/config'
import fs from 'node:fs'

import { afterEach, describe, expect, test } from 'bun:test'
import { loadDaemonConfig, saveDaemonConfig } from '../src/daemon/config'
import { PATHS } from '../src/lib/paths'

afterEach(() => {
  try {
    fs.unlinkSync(PATHS.DAEMON_JSON)
  }
  catch {}
})

const sampleConfig: DaemonConfig = {
  port: 4399,
  verbose: false,
  accountType: 'individual',
  manual: false,
  rateLimitWait: false,
  showToken: false,
  proxyEnv: false,
}

describe('saveDaemonConfig / loadDaemonConfig', () => {
  test('saves and loads config', () => {
    saveDaemonConfig(sampleConfig)
    expect(loadDaemonConfig()).toEqual(sampleConfig)
  })

  test('saves config with optional fields', () => {
    const config = { ...sampleConfig, rateLimit: 5, githubToken: 'ghu_xxx' }
    saveDaemonConfig(config)
    expect(loadDaemonConfig()).toEqual({ ...sampleConfig, rateLimit: 5 })
  })

  test('does not persist githubToken in file', () => {
    const config = { ...sampleConfig, githubToken: 'ghu_secret' }
    saveDaemonConfig(config)
    const raw = fs.readFileSync(PATHS.DAEMON_JSON, 'utf8')
    expect(raw).not.toContain('githubToken')
    expect(raw).not.toContain('ghu_secret')
  })

  test('returns null when no config file', () => {
    expect(loadDaemonConfig()).toBeNull()
  })
})
