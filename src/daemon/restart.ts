import process from 'node:process'
import { defineCommand } from 'citty'
import consola from 'consola'

import { loadDaemonConfig } from '~/daemon/config'
import { isDaemonRunning, isProcessRunning, removePidFile } from '~/daemon/pid'
import { daemonStart } from '~/daemon/start'

export const restart = defineCommand({
  meta: {
    name: 'restart',
    description: 'Restart the background daemon',
  },
  run() {
    const config = loadDaemonConfig()
    if (!config) {
      consola.error('No daemon config found. Start the daemon first with `start -d`')
      process.exit(1)
    }

    // Stop existing daemon if running
    const daemon = isDaemonRunning()
    if (daemon.running) {
      const { pid } = daemon
      consola.info(`Stopping daemon (PID: ${pid})...`)
      try {
        process.kill(pid, 'SIGTERM')
      }
      catch {}

      const deadline = Date.now() + 10_000
      while (isProcessRunning(pid) && Date.now() < deadline) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
      }

      if (isProcessRunning(pid)) {
        try {
          process.kill(pid, 'SIGKILL')
        }
        catch {}
      }
      removePidFile()
    }

    // Start with saved config
    daemonStart(config)
  },
})
