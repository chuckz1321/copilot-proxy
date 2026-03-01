import { defineCommand } from 'citty'
import consola from 'consola'

import { loadDaemonConfig } from '~/daemon/config'
import { isDaemonRunning, readPid } from '~/daemon/pid'

export const status = defineCommand({
  meta: {
    name: 'status',
    description: 'Show daemon status',
  },
  run() {
    const daemon = isDaemonRunning()
    if (!daemon.running) {
      consola.info('Daemon is not running')
      return
    }

    const config = loadDaemonConfig()
    const info = readPid()

    const startedAt = info && info.startTime > 0
      ? new Date(info.startTime).toLocaleString()
      : 'unknown'

    consola.info(`Daemon is running`)
    consola.info(`  PID:     ${daemon.pid}`)
    consola.info(`  Port:    ${config?.port ?? 'unknown'}`)
    consola.info(`  Started: ${startedAt}`)
  },
})
