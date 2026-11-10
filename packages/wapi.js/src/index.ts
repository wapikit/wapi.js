// Client
export { Client, type ClientConfig } from './client/client'
export { MessagingClient } from './client/messaging-client'

// Errors
export {
	WapiError,
	GraphApiError,
	RequestError,
	ValidationError,
	InvalidWebhookSignatureError,
	type GraphApiErrorEnvelope
} from './errors'

// Internals that are part of the public surface
export { type Logger, defaultLogger, silentLogger } from './internal/logger'
export {
	RequestClient,
	DEFAULT_API_VERSION,
	DEFAULT_GRAPH_BASE_URL,
	type FetchLike,
	type GraphField,
	type GraphRequest,
	type HttpMethod,
	type RequestClientOptions
} from './internal/request-client'
export { type Listener } from './internal/event-emitter'

// Outgoing messages
export * from './components'

// Managers
export * from './managers/message'
export * from './managers/media'
export * from './managers/pagination'
export * from './managers/template'
export * from './managers/phone-number'
export * from './managers/catalog'
export * from './managers/business'

// Webhook
export { WebhookManager, type WebhookOptions } from './webhook/manager'
export { WebhookHandler, type WebhookRequest, type WebhookResponse } from './webhook/handler'
export { type FetchWebhookHandler, type NodeWebhookHandler } from './webhook/adapters'
export { type WebhookServerAddress, type WebhookServerOptions } from './webhook/server'
export { isValidWebhookSignature, verifyWebhookSignature } from './webhook/signature'
export type * from './webhook/payload'

// Events
export * from './events'
