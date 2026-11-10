import { type WapiEventMap } from '../events'
import { TypedEventEmitter } from '../internal/event-emitter'
import { defaultLogger, type Logger } from '../internal/logger'
import { type FetchLike, RequestClient } from '../internal/request-client'
import { BusinessAccountManager } from '../managers/business'
import { CatalogManager } from '../managers/catalog'
import { type MediaManager } from '../managers/media'
import { type MessageManager } from '../managers/message'
import { PhoneNumberManager } from '../managers/phone-number'
import { TemplateManager } from '../managers/template'
import { WebhookManager, type WebhookOptions } from '../webhook/manager'
import { MessagingClient } from './messaging-client'

/** Configuration of a {@link Client}. Only `accessToken` is required. */
export interface ClientConfig {
	/** System user or user access token with `whatsapp_business_messaging` (and `_management`) permissions. */
	accessToken: string
	/**
	 * WhatsApp Business Account id. Required for `templates`, `phoneNumbers`,
	 * `catalogs` and `business`.
	 */
	businessAccountId?: string
	/**
	 * Default business phone number id. Enables the `client.message` /
	 * `client.media` shortcuts; use `client.messaging(id)` for other numbers.
	 */
	phoneNumberId?: string
	/** Graph API version. Default `"v20.0"`. */
	apiVersion?: string
	/** Graph API origin. Default `"https://graph.facebook.com"`; point it at a mock server in tests. */
	graphBaseUrl?: string
	/** Custom `fetch` (proxies, instrumentation, tests). Default `globalThis.fetch`. */
	fetch?: FetchLike
	/** Per-request timeout in milliseconds. Default 60 000 (uploads: 300 000). */
	timeoutMs?: number
	/** Where wapi.js logs. Default: warnings and errors to `console`. Pass `silentLogger` to mute. */
	logger?: Logger
	/** Webhook settings. Required to receive messages. */
	webhook?: WebhookOptions
}

/**
 * Entry point of wapi.js.
 *
 * @example
 * ```ts
 * const client = new Client({
 *   accessToken: process.env.WHATSAPP_API_ACCESS_TOKEN!,
 *   businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
 *   phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
 *   webhook: {
 *     verifyToken: process.env.WEBHOOK_VERIFY_TOKEN!,
 *     appSecret: process.env.META_APP_SECRET,
 *   },
 * });
 *
 * client.on("TextMessage", async (event) => {
 *   await event.reply(new TextMessage({ text: `You said: ${event.text}` }));
 * });
 *
 * await client.webhook.listen({ port: 8080 });
 * ```
 */
export class Client extends TypedEventEmitter<WapiEventMap> {
	/** Low level Graph API client, for endpoints wapi.js does not wrap yet. */
	readonly requester: RequestClient
	/** Receive webhooks: built-in server or handlers for your own server. */
	readonly webhook: WebhookManager
	readonly logger: Logger

	private readonly config: ClientConfig
	private readonly messagingClients = new Map<string, MessagingClient>()
	private templateManager?: TemplateManager
	private phoneNumberManager?: PhoneNumberManager
	private catalogManager?: CatalogManager
	private businessManager?: BusinessAccountManager

	constructor(config: ClientConfig) {
		super()
		const logger = config.logger ?? defaultLogger
		this.config = config
		this.logger = logger
		this.requester = new RequestClient({
			accessToken: config.accessToken,
			apiVersion: config.apiVersion,
			baseUrl: config.graphBaseUrl,
			fetch: config.fetch,
			timeoutMs: config.timeoutMs
		})
		this.webhook = new WebhookManager({
			options: config.webhook,
			logger,
			emit: (event, data) => this.dispatchEvent(event, data),
			messagingFor: phoneNumberId => this.messaging(phoneNumberId)
		})
	}

	/**
	 * Returns the (cached) messaging client of a business phone number. Without
	 * an argument, uses `config.phoneNumberId`.
	 */
	messaging(phoneNumberId?: string): MessagingClient {
		const id = phoneNumberId ?? this.config.phoneNumberId
		if (!id) {
			throw new TypeError(
				'wapi.js: no phone number id. Pass one to client.messaging(id) or set `phoneNumberId` in the client config.'
			)
		}
		let messaging = this.messagingClients.get(id)
		if (!messaging) {
			messaging = new MessagingClient(this.requester, id)
			this.messagingClients.set(id, messaging)
		}
		return messaging
	}

	/** Message manager of the default phone number (`config.phoneNumberId`). */
	get message(): MessageManager {
		return this.messaging().message
	}

	/** Media manager of the default phone number (`config.phoneNumberId`). */
	get media(): MediaManager {
		return this.messaging().media
	}

	/** Message templates of the business account. */
	get templates(): TemplateManager {
		this.templateManager ??= new TemplateManager(
			this.requester,
			this.requireBusinessAccountId()
		)
		return this.templateManager
	}

	/** Phone numbers of the business account: registration, verification, QR codes, profile. */
	get phoneNumbers(): PhoneNumberManager {
		this.phoneNumberManager ??= new PhoneNumberManager(
			this.requester,
			this.requireBusinessAccountId()
		)
		return this.phoneNumberManager
	}

	/** Product catalogs connected to the business account. */
	get catalogs(): CatalogManager {
		this.catalogManager ??= new CatalogManager(this.requester, this.requireBusinessAccountId())
		return this.catalogManager
	}

	/** Business account details, analytics and webhook app subscriptions. */
	get business(): BusinessAccountManager {
		this.businessManager ??= new BusinessAccountManager(
			this.requester,
			this.requireBusinessAccountId()
		)
		return this.businessManager
	}

	/** Replaces the access token for every subsequent request (token rotation). */
	setAccessToken(accessToken: string): void {
		this.requester.setAccessToken(accessToken)
	}

	/**
	 * Starts the built-in webhook server.
	 *
	 * @deprecated Use `await client.webhook.listen()`. Kept for 0.1.x code, which
	 * calls it without `await`: a failure to start (for example a port already in
	 * use) is emitted as `Error` instead of becoming an unhandled rejection.
	 */
	initiate(): Promise<void> {
		return this.webhook.listen().then(
			() => undefined,
			(error: unknown) =>
				this.dispatchEvent(
					'Error',
					error instanceof Error ? error : new Error(String(error))
				)
		)
	}

	/** Stops the built-in webhook server, if running, waiting up to `timeoutMs` for in-flight requests. */
	close(timeoutMs?: number): Promise<void> {
		return this.webhook.close(timeoutMs)
	}

	private dispatchEvent<K extends keyof WapiEventMap>(
		event: K,
		data: WapiEventMap[K]
	): Promise<void> {
		if (event === 'Error' && this.listenerCount('Error') === 0) {
			this.logger.error('unhandled wapi.js error (add a client.on("Error") listener)', {
				error: data
			})
			return Promise.resolve()
		}
		if (event === 'Warn' && this.listenerCount('Warn') === 0) {
			const warning = data as WapiEventMap['Warn']
			this.logger.warn(warning.message, warning.details)
			return Promise.resolve()
		}
		return this.dispatch(event, data)
	}

	/** A listener threw or rejected: report it as an `Error` event (or log it). */
	protected override onListenerError(error: unknown, event: keyof WapiEventMap): void {
		const wrapped = error instanceof Error ? error : new Error(String(error))
		if (event === 'Error' || this.listenerCount('Error') === 0) {
			this.logger.error(`listener for "${String(event)}" failed`, { error: wrapped })
			return
		}
		void this.dispatch('Error', wrapped)
	}

	private requireBusinessAccountId(): string {
		if (!this.config.businessAccountId) {
			throw new TypeError('wapi.js: this API needs `businessAccountId` in the client config.')
		}
		return this.config.businessAccountId
	}
}
