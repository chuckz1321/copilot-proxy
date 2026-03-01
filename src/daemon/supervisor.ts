import process from 'node:process'
import consola from 'consola'

import { removePidFile } from '~/daemon/pid'

const MAX_BACKOFF_MS = 60_000
const STABLE_THRESHOLD_MS = 60_000

export async function runAsSupervisor(runFn: () => Promise<void>): Promise<void> {
  let backoffMs = 1000
  let lastStartTime = Date.now()

  const cleanup = () => {
    removePidFile()
    process.exit(0)
  }

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)

  // On Windows, SIGTERM doesn't fire - use 'exit' as fallback to clean up PID file
  if (process.platform === 'win32') {
    process.on('exit', () => {
      removePidFile()
    })
  }

  while (true) {
    lastStartTime = Date.now()
    try {
      await runFn()
      // runFn resolved normally — shouldn't happen for a long-running server,
      // but if it does, break the loop
      break
    }
    catch (error) {
      const uptime = Date.now() - lastStartTime
      consola.error('Server crashed:', error)

      if (uptime > STABLE_THRESHOLD_MS) {
        backoffMs = 1000
      }

      consola.info(`Restarting in ${backoffMs / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
    }
  }
}
