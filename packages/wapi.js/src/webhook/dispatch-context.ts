import { type MessagingClient } from '../client/messaging-client'
import { type WapiEventMap } from '../events'
import { type Logger } from '../internal/logger'

/** Emits an event; never throws (listener errors are routed to `Error`). */
export type EmitFn = <K extends keyof WapiEventMap>(event: K, data: WapiEventMap[K]) => void

/** What the webhook dispatchers need from the client. */
export interface DispatchContext {
	emit: EmitFn
	logger: Logger
	/** Messaging client of the business number an event was delivered to. */
	messagingFor(phoneNumberId: string): MessagingClient
}
