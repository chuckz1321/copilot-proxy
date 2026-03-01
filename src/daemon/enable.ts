import process from 'node:process'
import { defineCommand } from 'citty'
import consola from 'consola'

import { loadDaemonConfig } from '~/daemon/config'

export const enable = defineCommand({
  meta: {
    name: 'enable',
    description: 'Register as auto-start service',
  },
  async run() {
    const config = loadDaemonConfig()
    if (!config) {
      consola.error('No daemon config found. Start the daemon first with `start -d`')
      process.exit(1)
    }

    const execPath = process.argv[0]
    const scriptPath = process.argv[1]
    const args = [scriptPath, 'start', '--_supervisor']

    let success = false
    const { platform } = process
    if (platform === 'linux') {
      const { installAutoStart } = await import('~/daemon/platform/linux')
      success = await installAutoStart(execPath, args)
    }
    else if (platform === 'darwin') {
      const { installAutoStart } = await import('~/daemon/platform/darwin')
      success = await installAutoStart(execPath, args)
    }
    else if (platform === 'win32') {
      const { installAutoStart } = await import('~/daemon/platform/win32')
      success = await installAutoStart(execPath, args)
    }
    else {
      consola.error(`Unsupported platform: ${platform}`)
      process.exit(1)
    }

    if (!success) {
      process.exit(1)
    }
  },
})
