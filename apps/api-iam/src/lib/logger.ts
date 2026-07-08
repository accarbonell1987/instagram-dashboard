import pino from 'pino'
import type { Logger, LoggerOptions } from 'pino'

export type { Logger }

export interface CreateLoggerOptions {
  level: string
  toConsole: boolean
  filePath: string
  format: 'json' | 'pretty'
  serviceName: string
  environment: string
}

export async function createLogger(options: CreateLoggerOptions): Promise<Logger> {
  const streams: pino.StreamEntry[] = []

  // File stream (always)
  streams.push({
    stream: pino.destination({ dest: options.filePath, sync: false, mkdir: true }),
  })

  // Console stream (optional)
  if (options.toConsole) {
    if (options.format === 'pretty') {
      try {
        const transport = pino.transport({
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        })
        streams.push({ stream: transport })
      } catch {
        process.stderr.write('[logger] pino-pretty not available, falling back to json console\n')
        streams.push({ stream: process.stdout })
      }
    } else {
      streams.push({ stream: process.stdout })
    }
  }

  const loggerOptions: LoggerOptions = {
    level: options.level,
    base: { service: options.serviceName, env: options.environment },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.refreshToken',
        '*.otp',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  }

  return pino(loggerOptions, pino.multistream(streams))
}

export function createSilentLogger(): Logger {
  return pino({ level: 'silent' })
}
