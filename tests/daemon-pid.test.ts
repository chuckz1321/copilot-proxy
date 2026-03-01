import fs from 'node:fs'
import { afterEach, describe, expect, test } from 'bun:test'

import { isProcessRunning, readPid, removePidFile, writePid } from '../src/daemon/pid'
import { PATHS } from '../src/lib/paths'

afterEach(() => {
  try {
    fs.unlinkSync(PATHS.DAEMON_PID)
  }
  catch {}
})

describe('writePid / readPid', () => {
  test('writes and reads PID', () => {
    writePid(12345)
    expect(readPid()).toBe(12345)
  })

  test('returns null when no PID file', () => {
    expect(readPid()).toBeNull()
  })

  test('returns null for invalid PID file content', () => {
    fs.writeFileSync(PATHS.DAEMON_PID, 'garbage')
    expect(readPid()).toBeNull()
  })

  test('returns null for trailing garbage after number', () => {
    fs.writeFileSync(PATHS.DAEMON_PID, '123garbage')
    expect(readPid()).toBeNull()
  })

  test('returns null for PID 0', () => {
    fs.writeFileSync(PATHS.DAEMON_PID, '0')
    expect(readPid()).toBeNull()
  })

  test('returns null for negative PID', () => {
    fs.writeFileSync(PATHS.DAEMON_PID, '-1')
    expect(readPid()).toBeNull()
  })
})

describe('removePidFile', () => {
  test('removes PID file', () => {
    writePid(12345)
    removePidFile()
    expect(readPid()).toBeNull()
  })

  test('does not throw when no PID file', () => {
    expect(() => removePidFile()).not.toThrow()
  })
})

describe('isProcessRunning', () => {
  test('returns true for current process', () => {
    expect(isProcessRunning(process.pid)).toBe(true)
  })

  test('returns false for non-existent PID', () => {
    expect(isProcessRunning(999999)).toBe(false)
  })
})
