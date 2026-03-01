import fs from 'node:fs'
import { defineCommand } from 'citty'
import consola from 'consola'

import { loadDaemonConfig } from '~/daemon/config'
import { isProcessRunning, readPid } from '~/daemon/pid'
import { PATHS } from '~/lib/paths'

export const status = defineCommand({
  meta: {
    name: 'status',
    description: 'Show daemon status',
  },
  run() {
    const pid = readPid()
    if (pid === null || !isProcessRunning(pid)) {
      consola.info('Daemon is not running')
      return
    }

    const config = loadDaemonConfig()
    let startedAt = 'unknown'
    try {
      const stat = fs.statSync(PATHS.DAEMON_PID)
      startedAt = stat.mtime.toLocaleString()
    }
    catch {}

    consola.info(`Daemon is running`)
    consola.info(`  PID:     ${pid}`)
    consola.info(`  Port:    ${config?.port ?? 'unknown'}`)
    consola.info(`  Started: ${startedAt}`)
  },
})
