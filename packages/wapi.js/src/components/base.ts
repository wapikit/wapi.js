import { ValidationError } from '../errors'

/** `type` of an outgoing message. */
export enum MessageTypeEnum {
	Text = 'text',
	Audio = 'audio',
	Video = 'video',
	Image = 'image',
	Document = 'document',
	Sticker = 'sticker',
	Location = 'location',
	Contacts = 'contacts',
	Interactive = 'interactive',
	Reaction = 'reaction',
	Template = 'template'
}

/**
 * Who a message is addressed to and in reply to what. Exactly one of `to`
 * (phone number / wa_id) or `recipient` (business-scoped user id, BSUID) is set.
 */
export interface MessageEnvelopeOptions {
	/** Recipient phone number or wa_id. Serialised as `to`. */
	to?: string
	/** Recipient BSUID or parent BSUID. Serialised as `recipient`. */
	recipient?: string
	/** Message id to quote. Serialised as `context.message_id`. */
	replyToMessageId?: string
	/** Echoed back on status webhooks as `biz_opaque_callback_data`. */
	bizOpaqueCallbackData?: string
}

/** Fields shared by every outgoing message payload. */
export interface BaseMessagePayload<T extends MessageTypeEnum = MessageTypeEnum> {
	messaging_product: 'whatsapp'
	recipient_type: 'individual'
	type: T
	to?: string
	recipient?: string
	context?: { message_id: string }
	biz_opaque_callback_data?: string
}

/** A complete Cloud API send payload: the envelope plus the type specific object. */
export type MessagePayload<T extends MessageTypeEnum = MessageTypeEnum> = BaseMessagePayload<T> &
	Record<string, unknown>

/**
 * Base class for every outgoing message component. Subclasses implement
 * {@link BaseMessage.content} (the type specific object); the envelope
 * (`to`/`recipient`, `context`, ...) is shared.
 */
export abstract class BaseMessage<T extends MessageTypeEnum = MessageTypeEnum> {
	readonly type: T

	protected constructor(type: T) {
		this.type = type
	}

	/**
	 * Returns the type specific part of the payload, keyed by the message type,
	 * for example `{ text: { body: "hi" } }`.
	 */
	protected abstract content(): Record<string, unknown>

	/**
	 * Builds the Cloud API payload for this message.
	 *
	 * @throws {ValidationError} when neither `to` nor `recipient` is given.
	 */
	toJson(options: MessageEnvelopeOptions): MessagePayload<T> {
		if (!options.to && !options.recipient) {
			throw new ValidationError('A message needs either `to` or `recipient`')
		}
		const payload: BaseMessagePayload<T> = {
			messaging_product: 'whatsapp',
			recipient_type: 'individual',
			type: this.type
		}
		if (options.to) payload.to = options.to
		if (options.recipient) payload.recipient = options.recipient
		if (options.replyToMessageId) {
			payload.context = { message_id: options.replyToMessageId }
		}
		if (options.bizOpaqueCallbackData) {
			payload.biz_opaque_callback_data = options.bizOpaqueCallbackData
		}
		return { ...payload, ...this.content() }
	}
}

/** Removes keys whose value is `undefined`, so payloads stay minimal. */
export function compact<T extends Record<string, unknown>>(value: T): T {
	const out: Record<string, unknown> = {}
	for (const [key, entry] of Object.entries(value)) {
		if (entry !== undefined) out[key] = entry
	}
	return out as T
}

/** Throws a {@link ValidationError} when `condition` is false. */
export function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new ValidationError(message)
}
