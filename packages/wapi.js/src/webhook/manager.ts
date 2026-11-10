import { type MessagingClient } from '../client/messaging-client'
import { type WapiEventMap } from '../events'
import { type Logger } from '../internal/logger'
import {
	createFetchHandler,
	createNodeHandler,
	type FetchWebhookHandler,
	type NodeWebhookHandler
} from './adapters'
import { type WebhookRequest, type WebhookResponse, WebhookHandler } from './handler'
import { type WebhookPayload } from './payload'
import { WebhookServer, type WebhookServerAddress, type WebhookServerOptions } from './server'

/** Webhook settings of the client. */
export interface WebhookOptions extends WebhookServerOptions {
	/** The verify token you entered in the Meta app dashboard. */
	verifyToken: string
	/**
	 * Your Meta app secret. When set, every POST must carry a valid
	 * `X-Hub-Signature-256` or it is rejected with 401. Strongly recommended.
	 */
	appSecret?: string
}

/** @internal */
export interface WebhookManagerInit {
	options?: WebhookOptions
	logger: Logger
	emit: <K extends keyof WapiEventMap>(event: K, data: WapiEventMap[K]) => Promise<void>
	messagingFor: (phoneNumberId: string) => MessagingClient
}

/**
 * Receives WhatsApp webhooks. Either let wapi.js run a small server
 * (`listen()`), or mount a handler in the server you already have:
 *
 * - `fetchHandler` for Next.js, Hono, Bun, Deno, Cloudflare Workers, Vercel
 * - `nodeHandler` for `node:http`, Express, Fastify, Koa
 * - `handle()` for anything else (AWS Lambda, queues, tests)
 */
export class WebhookManager {
	private readonly init: WebhookManagerInit
	private handlerInstance?: WebhookHandler
	private server?: WebhookServer
	private fetchHandlerFn?: FetchWebhookHandler
	private nodeHandlerFn?: NodeWebhookHandler

	constructor(init: WebhookManagerInit) {
		this.init = init
	}

	private get handler(): WebhookHandler {
		if (!this.handlerInstance) {
			const options = this.init.options
			if (!options?.verifyToken) {
				throw new TypeError(
					'wapi.js: set `webhook.verifyToken` in the client config to receive webhooks.'
				)
			}
			this.handlerInstance = new WebhookHandler({
				verifyToken: options.verifyToken,
				appSecret: options.appSecret,
				logger: this.init.logger,
				emit: this.init.emit,
				messagingFor: this.init.messagingFor
			})
		}
		return this.handlerInstance
	}

	/** Handles a framework independent request. Never throws. */
	handle(request: WebhookRequest): Promise<WebhookResponse> {
		return this.handler.handle(request)
	}

	/**
	 * Dispatches a payload you already authenticated and parsed (for example
	 * after pulling it from a queue). Resolves when every listener has settled.
	 */
	dispatch(payload: WebhookPayload): Promise<void> {
		return this.handler.dispatch(payload)
	}

	/** `(request: Request, ctx?) => Promise<Response>` for Fetch API runtimes. */
	get fetchHandler(): FetchWebhookHandler {
		this.fetchHandlerFn ??= createFetchHandler(this.handler)
		return this.fetchHandlerFn
	}

	/** `(req, res) => Promise<void>` for `node:http`, Express, Fastify, Koa. */
	get nodeHandler(): NodeWebhookHandler {
		this.nodeHandlerFn ??= createNodeHandler(this.handler)
		return this.nodeHandlerFn
	}

	/** True while the built-in server is listening. */
	get listening(): boolean {
		return this.server?.listening ?? false
	}

	/**
	 * Starts the built-in `node:http` server and emits `Ready`. Options override
	 * the ones from the client config.
	 */
	async listen(options?: WebhookServerOptions): Promise<WebhookServerAddress> {
		if (this.server?.listening) return this.server.address()
		const merged = { ...this.init.options, ...options }
		this.server = new WebhookServer(
			this.nodeHandler,
			{
				port: merged.port ?? 8080,
				host: merged.host,
				path: merged.path ?? '/webhook',
				maxBodyBytes: merged.maxBodyBytes ?? 3 * 1024 * 1024
			},
			error => {
				void this.init.emit('Error', error)
			}
		)
		const address = await this.server.listen()
		void this.init.emit('Ready', address)
		return address
	}

	/** Stops the built-in server, waiting up to `timeoutMs` for in-flight requests. */
	async close(timeoutMs?: number): Promise<void> {
		const server = this.server
		this.server = undefined
		await server?.close(timeoutMs)
	}
}
