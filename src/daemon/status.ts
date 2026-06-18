import { defineCommand } from 'citty'
import consola from 'consola'

import { loadDaemonConfig } from '~/daemon/config'
import { loadInstalledNativeServiceCommands } from '~/daemon/native-service'
import { isDaemonRunning, readPid } from '~/daemon/pid'

export const status = defineCommand({
  meta: {
    name: 'status',
    description: 'Show native background service or legacy daemon status',
  },
  async run() {
    const nativeService = await loadInstalledNativeServiceCommands()
    if (nativeService) {
      if (!nativeService.showAutoStartStatus())
        consola.warn('Native service is installed, but its status command failed.')
    }
    else {
      consola.info('Native service is not installed')
    }

    const daemon = isDaemonRunning()
    if (!daemon.running) {
      consola.info('App-managed daemon is not running')
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
