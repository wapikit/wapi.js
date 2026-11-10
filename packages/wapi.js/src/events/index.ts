import { type BusinessEventMap } from './business-events'
import {
	type AdInteractionEvent,
	type AudioMessageEvent,
	type ContactMessageEvent,
	type CustomerIdentityChangedEvent,
	type CustomerNumberChangedEvent,
	type DocumentMessageEvent,
	type FlowCompletionEvent,
	type ImageMessageEvent,
	type ListInteractionEvent,
	type LocationMessageEvent,
	type OrderMessageEvent,
	type ProductInquiryEvent,
	type QuickReplyButtonInteractionEvent,
	type ReactionEvent,
	type ReplyButtonInteractionEvent,
	type StickerMessageEvent,
	type TextMessageEvent,
	type UnsupportedMessageEvent,
	type VideoMessageEvent
} from './message-events'
import {
	type MessageDeliveredEvent,
	type MessageFailedEvent,
	type MessageReadEvent,
	type MessageSentEvent,
	type MessageStatusEvent,
	type MessageUndeliveredEvent
} from './status-events'

export * from './base'
export * from './message-events'
export * from './status-events'
export * from './business-events'

/** Inbound message events. */
export type MessageEventMap = {
	TextMessage: TextMessageEvent
	ImageMessage: ImageMessageEvent
	AudioMessage: AudioMessageEvent
	VideoMessage: VideoMessageEvent
	DocumentMessage: DocumentMessageEvent
	StickerMessage: StickerMessageEvent
	LocationMessage: LocationMessageEvent
	ContactsMessage: ContactMessageEvent
	Reaction: ReactionEvent
	ReplyButtonInteraction: ReplyButtonInteractionEvent
	ListInteraction: ListInteractionEvent
	FlowCompletion: FlowCompletionEvent
	QuickReplyButtonInteraction: QuickReplyButtonInteractionEvent
	OrderReceived: OrderMessageEvent
	ProductInquiry: ProductInquiryEvent
	AdInteraction: AdInteractionEvent
	CustomerNumberChanged: CustomerNumberChangedEvent
	CustomerIdentityChanged: CustomerIdentityChangedEvent
	UnsupportedMessage: UnsupportedMessageEvent
}

/** Message status events. */
export type StatusEventMap = {
	/** Every status update, including statuses without a dedicated event. */
	MessageStatus: MessageStatusEvent
	MessageSent: MessageSentEvent
	MessageDelivered: MessageDeliveredEvent
	MessageRead: MessageReadEvent
	MessageFailed: MessageFailedEvent
	MessageUndelivered: MessageUndeliveredEvent
}

/** Lifecycle events of the client itself. */
export type ClientEventMap = {
	/** The built-in webhook server is listening. */
	Ready: { host: string; port: number; path: string }
	/** A listener threw, a webhook change could not be decoded, or the server failed. */
	Error: Error
	/** Something unexpected but recoverable, e.g. an unknown webhook field. */
	Warn: { message: string; details?: Record<string, unknown> }
}

/**
 * Every event `client.on()` accepts, mapped to its payload type.
 */
export type WapiEventMap = MessageEventMap & StatusEventMap & BusinessEventMap & ClientEventMap

/** Name of any event `client.on()` accepts. */
export type WapiEventName = keyof WapiEventMap
