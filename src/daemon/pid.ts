import { execSync } from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'

import { PATHS } from '~/lib/paths'

export interface DaemonPidInfo {
  pid: number
  startTime: number
}

export function writePid(pid: number): void {
  fs.mkdirSync(PATHS.APP_DIR, { recursive: true })
  const pidPath = PATHS.DAEMON_PID
  fs.writeFileSync(pidPath, `${pid}\n${Date.now()}`, { mode: 0o600 })
  // Ensure permissions are correct even if file already existed with wider perms
  try {
    fs.chmodSync(pidPath, 0o600)
  }
  catch {}
}

export function readPid(): DaemonPidInfo | null {
  try {
    const content = fs.readFileSync(PATHS.DAEMON_PID, 'utf8').trim()
    const lines = content.split('\n')
    if (lines.length < 2) {
      // Legacy format: just PID
      const pid = Number.parseInt(lines[0], 10)
      if (Number.isNaN(pid) || pid <= 0 || String(pid) !== lines[0])
        return null
      return { pid, startTime: 0 }
    }
    const pid = Number.parseInt(lines[0], 10)
    const startTime = Number.parseInt(lines[1], 10)
    if (Number.isNaN(pid) || pid <= 0 || String(pid) !== lines[0])
      return null
    if (Number.isNaN(startTime))
      return null
    return { pid, startTime }
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

/**
 * Check if a running process is actually our daemon supervisor,
 * by inspecting its command line for the _supervisor flag.
 */
function isOurDaemonProcess(pid: number): boolean {
  try {
    if (process.platform === 'win32') {
      const output = execSync(
        `wmic process where ProcessId=${pid} get CommandLine /format:list`,
        { stdio: 'pipe', encoding: 'utf8' },
      )
      return output.includes('_supervisor')
    }
    else {
      // Linux: /proc/<pid>/cmdline, macOS: ps
      try {
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
        return cmdline.includes('_supervisor')
      }
      catch {
        // macOS or /proc not available
        const output = execSync(`ps -p ${pid} -o command=`, {
          stdio: 'pipe',
          encoding: 'utf8',
        })
        return output.includes('_supervisor')
      }
    }
  }
  catch {
    // Can't read process info — can't confirm identity
    return false
  }
}

/**
 * Check if the PID from the PID file is likely still our daemon process.
 * Verifies that the process is alive AND that its command line contains
 * the _supervisor flag (proving it's our daemon, not a random process
 * that happens to have the same PID).
 */
export function isDaemonRunning(): { running: true, pid: number } | { running: false } {
  const info = readPid()
  if (info === null)
    return { running: false }
  if (!isProcessRunning(info.pid))
    return { running: false }

  // Verify the process is actually our daemon by checking its command line
  if (!isOurDaemonProcess(info.pid))
    return { running: false }

  return { running: true, pid: info.pid }
}
