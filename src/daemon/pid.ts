import fs from 'node:fs'
import process from 'node:process'

import { PATHS } from '~/lib/paths'

export function writePid(pid: number): void {
  fs.mkdirSync(PATHS.APP_DIR, { recursive: true })
  fs.writeFileSync(PATHS.DAEMON_PID, String(pid))
}

export function readPid(): number | null {
  try {
    const content = fs.readFileSync(PATHS.DAEMON_PID, 'utf8').trim()
    const pid = Number.parseInt(content, 10)
    if (Number.isNaN(pid) || pid <= 0 || String(pid) !== content) {
      return null
    }
    return pid
  }
  catch {
    return null
  }
}

export function removePidFile(): void {
  try {
    fs.unlinkSync(PATHS.DAEMON_PID)
  }
  catch {}
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'EPERM') {
      return true
    }
    return false
  }
}
