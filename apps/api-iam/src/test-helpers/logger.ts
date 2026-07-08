import { Writable } from 'node:stream'
import pino from 'pino'
import type { Logger } from '../lib/logger.js'

export const silentLogger: Logger = pino({ level: 'silent' })

export function createMemoryLogger(): { logger: Logger; getRecords: () => object[] } {
  const records: object[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      records.push(JSON.parse(chunk.toString()) as object)
      callback()
    },
  })
  return {
    logger: pino({ level: 'trace' }, stream),
    getRecords: () => records,
  }
}
