import { type MessagingClient } from '../client/messaging-client'
import { type WapiEventMap } from '../events'
import { type Logger } from '../internal/logger'
import { dispatchBusinessChange } from './business-dispatch'
import { type DispatchContext } from './dispatch-context'
import { dispatchMessagesChange } from './message-dispatch'
import { type WebhookPayload } from './payload'
import { isValidWebhookSignature } from './signature'

type HeaderBag = Headers | Record<string, string | string[] | undefined>
type QueryBag = URLSearchParams | Record<string, string | string[] | undefined>

/**
 * A framework independent view of an incoming webhook request. The adapters
 * (`fetchHandler`, `nodeHandler`) build it for you; use it directly to plug
 * wapi.js into any other server or a queue consumer.
 */
export interface WebhookRequest {
	method: string
	query?: QueryBag
	headers?: HeaderBag
	/**
	 * The body exactly as received. Required to verify `X-Hub-Signature-256`
	 * when `appSecret` is configured.
	 */
	rawBody?: string | Uint8Array | ArrayBuffer
	/**
	 * An already parsed JSON body, for frameworks that parse it before you get
	 * the request. Ignored when `rawBody` is given. Signature verification is
	 * impossible from a parsed body, so this is rejected when `appSecret` is set.
	 */
	parsedBody?: unknown
}

/** What to answer Meta with. */
export interface WebhookResponse {
	status: number
	body: string
	headers: Record<string, string>
	/**
	 * Settles when every event listener triggered by this request has settled
	 * (never rejects). Pass it to `waitUntil` on serverless runtimes so the
	 * runtime is not frozen before your handlers finish.
	 */
	done: Promise<void>
}

/** @internal */
export interface WebhookHandlerOptions {
	verifyToken: string
	appSecret?: string
	logger: Logger
	emit: <K extends keyof WapiEventMap>(event: K, data: WapiEventMap[K]) => Promise<void>
	messagingFor: (phoneNumberId: string) => MessagingClient
}

const decoder = new TextDecoder()

function readHeader(headers: HeaderBag | undefined, name: string): string | undefined {
	if (!headers) return undefined
	if (typeof (headers as Headers).get === 'function') {
		return (headers as Headers).get(name) ?? undefined
	}
	// Plain objects keep whatever casing the platform used (API Gateway REST,
	// ALB, Netlify...), so match the key case-insensitively.
	const bag = headers as Record<string, string | string[] | undefined>
	const wanted = name.toLowerCase()
	const key = Object.keys(bag).find(candidate => candidate.toLowerCase() === wanted)
	const value = key === undefined ? undefined : bag[key]
	return Array.isArray(value) ? value[0] : value
}

function readQuery(query: QueryBag | undefined, name: string): string | undefined {
	if (!query) return undefined
	if (query instanceof URLSearchParams) return query.get(name) ?? undefined
	const value = query[name]
	return Array.isArray(value) ? value[0] : value
}

function textResponse(
	status: number,
	body: string,
	done: Promise<void> = Promise.resolve()
): WebhookResponse {
	return { status, body, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, done }
}

/**
 * Processes WhatsApp webhook requests: subscription verification (`GET`) and
 * event notifications (`POST`).
 *
 * Behaviour, matching wapi.go:
 * - `GET` answers `hub.challenge` when `hub.mode` is `subscribe` and the token
 *   matches, `403` otherwise.
 * - `POST` with `appSecret` set rejects a missing or wrong signature with `401`.
 * - Invalid JSON gets `400`. Once a payload is accepted the answer is always
 *   `200`: a change or message that cannot be decoded is skipped and reported
 *   through the `Error` event, so Meta does not retry (and re-deliver) the
 *   whole batch.
 */
export class WebhookHandler {
	private warnedAboutSignature = false

	constructor(private readonly options: WebhookHandlerOptions) {}

	/** Handles one request. Never throws. */
	async handle(request: WebhookRequest): Promise<WebhookResponse> {
		try {
			const method = request.method.toUpperCase()
			if (method === 'GET') return this.handleVerification(request)
			if (method === 'POST') return await this.handleNotification(request)
			return { ...textResponse(405, 'Method Not Allowed'), headers: { Allow: 'GET, POST' } }
		} catch (error) {
			this.options.logger.error('webhook request failed', { error })
			return textResponse(500, 'Internal Server Error')
		}
	}

	private handleVerification(request: WebhookRequest): WebhookResponse {
		const mode = readQuery(request.query, 'hub.mode')
		const token = readQuery(request.query, 'hub.verify_token')
		const challenge = readQuery(request.query, 'hub.challenge')
		if (mode === 'subscribe' && token === this.options.verifyToken && challenge !== undefined) {
			return textResponse(200, challenge)
		}
		return textResponse(403, 'Forbidden')
	}

	private async handleNotification(request: WebhookRequest): Promise<WebhookResponse> {
		const { appSecret, logger } = this.options
		const hasRawBody = request.rawBody !== undefined

		if (appSecret) {
			if (!hasRawBody) {
				logger.error(
					'appSecret is set but the raw request body is not available, so the signature cannot be verified. ' +
						"Pass the raw body (for Express use express.raw({ type: 'application/json' }))."
				)
				return textResponse(401, 'Unauthorized')
			}
			const signature = readHeader(request.headers, 'x-hub-signature-256')
			const rawBody = request.rawBody as string | Uint8Array | ArrayBuffer
			if (!(await isValidWebhookSignature(appSecret, rawBody, signature))) {
				return textResponse(401, 'Unauthorized')
			}
		} else if (!this.warnedAboutSignature) {
			this.warnedAboutSignature = true
			logger.warn(
				'Webhook signature verification is disabled. Set `webhook.appSecret` so forged requests are rejected.'
			)
		}

		let payload: unknown
		if (hasRawBody) {
			const raw = request.rawBody
			const text = typeof raw === 'string' ? raw : decoder.decode(raw)
			try {
				payload = JSON.parse(text)
			} catch {
				return textResponse(400, 'Invalid JSON')
			}
		} else {
			payload = request.parsedBody
		}

		if (
			!payload ||
			typeof payload !== 'object' ||
			!Array.isArray((payload as WebhookPayload).entry)
		) {
			return textResponse(400, 'Invalid payload')
		}

		const done = this.dispatch(payload as WebhookPayload)
		return textResponse(200, 'OK', done)
	}

	/**
	 * Dispatches an already authenticated and parsed payload. Useful when the
	 * request is verified elsewhere (for example a queue worker). Resolves when
	 * every listener has settled.
	 */
	dispatch(payload: WebhookPayload): Promise<void> {
		const pending: Promise<void>[] = []
		const context: DispatchContext = {
			logger: this.options.logger,
			messagingFor: this.options.messagingFor,
			emit: (event, data) => {
				pending.push(this.options.emit(event, data))
			}
		}

		if (payload.object && payload.object !== 'whatsapp_business_account') {
			context.emit('Warn', {
				message: 'Ignoring webhook payload for a non WhatsApp object',
				details: { object: payload.object }
			})
			return Promise.all(pending).then(() => undefined)
		}

		for (const entry of payload.entry ?? []) {
			for (const change of entry?.changes ?? []) {
				try {
					if (change.field === 'messages') {
						dispatchMessagesChange(context, entry, change.value)
					} else if (!dispatchBusinessChange(context, entry, change)) {
						context.emit('Warn', {
							message: `Unhandled webhook field "${change.field}"`,
							details: { field: change.field, businessAccountId: entry.id }
						})
					}
				} catch (error) {
					this.options.logger.error('skipping undecodable webhook change', {
						field: change?.field,
						error
					})
					context.emit('Error', error instanceof Error ? error : new Error(String(error)))
				}
			}
		}
		return Promise.all(pending).then(() => undefined)
	}
}
