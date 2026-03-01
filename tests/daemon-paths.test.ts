import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'bun:test'

import { PATHS } from '../src/lib/paths'

const APP_DIR = path.join(os.homedir(), '.local', 'share', 'copilot-proxy')

test('PATHS includes DAEMON_PID path', () => {
  expect(PATHS.DAEMON_PID).toBe(path.join(APP_DIR, 'daemon.pid'))
})

test('PATHS includes DAEMON_LOG path', () => {
  expect(PATHS.DAEMON_LOG).toBe(path.join(APP_DIR, 'daemon.log'))
})

test('PATHS includes DAEMON_JSON path', () => {
  expect(PATHS.DAEMON_JSON).toBe(path.join(APP_DIR, 'daemon.json'))
})
