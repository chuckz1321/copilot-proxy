import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const APP_DIR = path.join(os.homedir(), '.local', 'share', 'copilot-proxy')

const GITHUB_TOKEN_PATH = path.join(APP_DIR, 'github_token')
const DAEMON_PID = path.join(APP_DIR, 'daemon.pid')
const DAEMON_LOG = path.join(APP_DIR, 'daemon.log')
const DAEMON_JSON = path.join(APP_DIR, 'daemon.json')

export const PATHS = {
  APP_DIR,
  GITHUB_TOKEN_PATH,
  DAEMON_PID,
  DAEMON_LOG,
  DAEMON_JSON,
}

export async function ensurePaths(): Promise<void> {
  await fs.mkdir(PATHS.APP_DIR, { recursive: true })
  await ensureFile(PATHS.GITHUB_TOKEN_PATH)
}

async function ensureFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath, fs.constants.W_OK)
  }
  catch {
    await fs.writeFile(filePath, '')
    await fs.chmod(filePath, 0o600)
  }
}
