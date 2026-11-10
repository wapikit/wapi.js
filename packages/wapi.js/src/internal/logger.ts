/**
 * Minimal logger contract. `console`, `pino`, `winston` and most loggers
 * satisfy it directly.
 */
export interface Logger {
	debug(message: string, meta?: Record<string, unknown>): void
	info(message: string, meta?: Record<string, unknown>): void
	warn(message: string, meta?: Record<string, unknown>): void
	error(message: string, meta?: Record<string, unknown>): void
}

const noop = () => undefined

/** A logger that discards everything. */
export const silentLogger: Logger = {
	debug: noop,
	info: noop,
	warn: noop,
	error: noop
}

/**
 * Default logger: forwards warnings and errors to `console`, drops debug and
 * info so a library never spams the host application's output.
 */
export const defaultLogger: Logger = {
	debug: noop,
	info: noop,
	warn: (message, meta) =>
		meta ? console.warn(`[wapi.js] ${message}`, meta) : console.warn(`[wapi.js] ${message}`),
	error: (message, meta) =>
		meta ? console.error(`[wapi.js] ${message}`, meta) : console.error(`[wapi.js] ${message}`)
}
