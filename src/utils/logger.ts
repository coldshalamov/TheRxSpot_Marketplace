import pino from "pino"
import { AsyncLocalStorage } from "async_hooks"

type LogContext = {
  request_id: string | null
  tenant_id: string | null
  user_id: string | null
  order_id: string | null
}

const DEFAULT_CONTEXT: LogContext = {
  request_id: null,
  tenant_id: null,
  user_id: null,
  order_id: null,
}

const storage = new AsyncLocalStorage<LogContext>()

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: "message",
})

export function runWithLogContext<T>(context: Partial<LogContext>, fn: () => T): T {
  const merged: LogContext = { ...DEFAULT_CONTEXT, ...context }
  return storage.run(merged, fn)
}

export function updateLogContext(context: Partial<LogContext>) {
  const current = storage.getStore()
  if (!current) return
  Object.assign(current, context)
}

export function getLogContext(): LogContext {
  return storage.getStore() ?? { ...DEFAULT_CONTEXT }
}

type LogPayload = Record<string, unknown>
type LogInput = string | Error | LogPayload

function normalizeArgs(arg1: LogInput, arg2?: LogInput) {
  let message: string | undefined
  let error: Error | undefined
  let payload: LogPayload = {}

  const assignPayload = (obj?: LogInput) => {
    if (obj && typeof obj === "object" && !(obj instanceof Error)) {
      payload = { ...payload, ...(obj as LogPayload) }
    }
  }

  if (arg1 instanceof Error) {
    error = arg1
    message = arg1.message
  } else if (typeof arg1 === "string") {
    message = arg1
  } else {
    assignPayload(arg1)
  }

  if (arg2 instanceof Error) {
    error = arg2
    message = message || arg2.message
  } else if (typeof arg2 === "string") {
    message = message || arg2
  } else {
    assignPayload(arg2)
  }

  return { message, error, payload }
}

function log(level: "info" | "warn" | "error" | "debug", arg1: LogInput, arg2?: LogInput) {
  const { message, error, payload } = normalizeArgs(arg1, arg2)
  const context = getLogContext()
  const merged = { ...context, ...payload }

  if (error) {
    // Pino expects (obj, msg, ...args) or (msg, ...args)
    // We merge error into the object for proper logging
    baseLogger[level]({ ...merged, err: error }, message)
    return
  }

  if (message) {
    baseLogger[level](merged, message)
    return
  }

  baseLogger[level](merged)
}

export const logger = {
  info: (a: LogInput, b?: LogInput) => log("info", a, b),
  warn: (a: LogInput, b?: LogInput) => log("warn", a, b),
  error: (a: LogInput, b?: LogInput) => log("error", a, b),
  debug: (a: LogInput, b?: LogInput) => log("debug", a, b),
}

export function getLogger() {
  return logger
}

