/**
 * Base class for every error thrown by wapi.js. Use `instanceof WapiError` to
 * tell library errors apart from errors thrown by your own code.
 */
export class WapiError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'WapiError'
	}
}

/**
 * Meta's error envelope, `{ "error": { ... } }`, as returned by the Graph API.
 */
export interface GraphApiErrorEnvelope {
	message?: string
	type?: string
	code?: number
	error_subcode?: number
	fbtrace_id?: string
	error_user_title?: string
	error_user_msg?: string
	error_data?: { messaging_product?: string; details?: string } | string
}

/**
 * Thrown when the Graph API answers with a non-2xx status, or with a 2xx body
 * that still carries an `error` envelope.
 *
 * @example
 * ```ts
 * try {
 *   await messaging.message.send({ to, message });
 * } catch (error) {
 *   if (error instanceof GraphApiError && error.isRetryable) {
 *     // back off and retry
 *   }
 * }
 * ```
 */
export class GraphApiError extends WapiError {
	/** HTTP status code of the response. */
	readonly status: number
	/** `error.code` from Meta's envelope, when present. */
	readonly code?: number
	/** `error.error_subcode`, when present. */
	readonly subcode?: number
	/** `error.type` (for example `OAuthException`), when present. */
	readonly type?: string
	/** `error.fbtrace_id`, quote it when contacting Meta support. */
	readonly fbtraceId?: string
	/** `error.error_data.details`, Meta's human readable explanation. */
	readonly details?: string
	/** Raw response body. Never dropped, even when it is not JSON. */
	readonly body: string

	constructor(params: { status: number; body: string }) {
		const envelope = parseErrorEnvelope(params.body)
		const message = envelope?.message
			? `Graph API error (status ${params.status}, code ${envelope.code ?? 'unknown'}): ${envelope.message}`
			: `Graph API error (status ${params.status}): ${params.body.slice(0, 300)}`
		super(message)
		this.name = 'GraphApiError'
		this.status = params.status
		this.body = params.body
		this.code = envelope?.code
		this.subcode = envelope?.error_subcode
		this.type = envelope?.type
		this.fbtraceId = envelope?.fbtrace_id
		const errorData = envelope?.error_data
		this.details = typeof errorData === 'string' ? errorData : errorData?.details
	}

	/**
	 * Whether retrying may succeed: rate limits (HTTP 429 or Meta throttling
	 * codes 4, 17, 32, 80007, 130429, 131048, 131056) and transient server errors
	 * (HTTP 5xx, Meta codes 1, 2, 131000). The caller owns any backoff policy.
	 */
	get isRetryable(): boolean {
		if (this.status === 429 || this.status >= 500) return true
		return this.code !== undefined && RETRYABLE_CODES.has(this.code)
	}
}

const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 80007, 130429, 131000, 131048, 131056])

function parseErrorEnvelope(body: string): GraphApiErrorEnvelope | undefined {
	try {
		const parsed = JSON.parse(body) as { error?: GraphApiErrorEnvelope }
		if (parsed && typeof parsed === 'object' && parsed.error) {
			return parsed.error
		}
	} catch {
		// body is not JSON (for example an HTML error page from a proxy)
	}
	return undefined
}

/**
 * Thrown when a request to the Graph API could not be completed at all: DNS,
 * connection reset, TLS failure, or the request timed out.
 */
export class RequestError extends WapiError {
	/** True when the request was aborted because it exceeded `timeoutMs`. */
	readonly timedOut: boolean

	constructor(message: string, options: { cause?: unknown; timedOut?: boolean }) {
		super(message, { cause: options.cause })
		this.name = 'RequestError'
		this.timedOut = options.timedOut ?? false
	}
}

/**
 * Thrown when a message component is built with invalid input, for example a
 * button title longer than WhatsApp allows.
 */
export class ValidationError extends WapiError {
	constructor(message: string) {
		super(message)
		this.name = 'ValidationError'
	}
}

/**
 * Returned by {@link verifyWebhookSignature} (and used by the webhook handler)
 * when the `X-Hub-Signature-256` header is missing, malformed or does not
 * match the body.
 */
export class InvalidWebhookSignatureError extends WapiError {
	constructor() {
		super('Invalid webhook signature')
		this.name = 'InvalidWebhookSignatureError'
	}
}
