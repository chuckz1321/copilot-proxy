import fs from 'node:fs'

import { PATHS } from '~/lib/paths'

export interface DaemonConfig {
  port: number
  verbose: boolean
  accountType: string
  manual: boolean
  rateLimit?: number
  rateLimitWait: boolean
  githubToken?: string
  showToken: boolean
  proxyEnv: boolean
}

export function saveDaemonConfig(config: DaemonConfig): void {
  fs.mkdirSync(PATHS.APP_DIR, { recursive: true })
  fs.writeFileSync(PATHS.DAEMON_JSON, JSON.stringify(config, null, 2))
}

export function loadDaemonConfig(): DaemonConfig | null {
  try {
    const content = fs.readFileSync(PATHS.DAEMON_JSON, 'utf8')
    return JSON.parse(content) as DaemonConfig
  }
  catch {
    return null
  }
}
