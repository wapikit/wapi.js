import { ReactionMessage } from '../components'
import { type BaseMessage } from '../components/base'
import { type MessagingClient } from '../client/messaging-client'
import { type MarkAsReadOptions, type MessageSendResponse } from '../managers/message'
import {
	type InboundMessage,
	type InboundReferral,
	type InboundStatus,
	type WebhookError
} from '../webhook/payload'

/** The business phone number a webhook event was delivered to. */
export interface BusinessPhoneNumber {
	/** Phone number id; pass it to `client.messaging(id)`. */
	id: string
	/** Human readable number, e.g. `"15550001111"`. */
	displayPhoneNumber: string
}

/** Reply / forward context of an inbound message. */
export interface MessageContext {
	/** Id of the message this one quotes, when it is a reply. */
	repliedToMessageId?: string
	/** Sender of the quoted message. */
	repliedToFrom?: string
	forwarded: boolean
	frequentlyForwarded: boolean
}

/** Click-to-WhatsApp ad referral attached to an inbound message. */
export interface AdReferral {
	sourceUrl?: string
	sourceId?: string
	sourceType?: string
	headline?: string
	body?: string
	mediaType?: string
	/** `image_url` or `video_url`. */
	mediaUrl?: string
	thumbnailUrl?: string
	/** Click id, for conversion tracking. */
	ctwaClid?: string
	/** Text of the ad's welcome message, when Meta includes it. */
	welcomeMessageText?: string
}

/** Error attached to a status or message webhook. */
export interface WebhookEventError {
	code: number
	title?: string
	message?: string
	details?: string
	href?: string
}

/** @internal */
export function mapErrors(errors: WebhookError[] | undefined): WebhookEventError[] {
	return (errors ?? []).map(error => ({
		code: error.code,
		title: error.title,
		message: error.message,
		details: error.error_data?.details,
		href: error.href
	}))
}

/** @internal */
export function mapReferral(referral: InboundReferral | undefined): AdReferral | undefined {
	if (!referral) return undefined
	return {
		sourceUrl: referral.source_url,
		sourceId: referral.source_id,
		sourceType: referral.source_type,
		headline: referral.headline,
		body: referral.body,
		mediaType: referral.media_type,
		mediaUrl: referral.video_url || referral.image_url,
		thumbnailUrl: referral.thumbnail_url,
		ctwaClid: referral.ctwa_clid,
		welcomeMessageText: referral.welcome_message?.text
	}
}

/** Fields shared by every webhook event. */
export abstract class BaseEvent {
	/** Unix timestamp (seconds) at which the event happened. */
	readonly timestamp: number

	protected constructor(timestamp: number | string | undefined) {
		const value = Number(timestamp)
		this.timestamp = Number.isFinite(value) ? value : 0
	}

	/** `timestamp` as a `Date`. */
	get date(): Date {
		return new Date(this.timestamp * 1000)
	}
}

/** @internal Data every message event is built from. */
export interface MessageEventInit {
	messaging: MessagingClient
	businessAccountId: string
	phoneNumber: BusinessPhoneNumber
	message: InboundMessage
	sender: {
		name?: string
		waId?: string
		userId?: string
		parentUserId?: string
		username?: string
	}
}

/**
 * Base class of every inbound message event. Carries the sender identity
 * (phone and BSUID), the receiving business number, and helpers to reply,
 * react and mark the message as read **from the number it was received on**.
 */
export abstract class BaseMessageEvent extends BaseEvent {
	/** WhatsApp message id (`wamid.*`). */
	readonly messageId: string
	/** Sender wa_id / phone number. May be empty for BSUID-only senders. */
	readonly from: string
	/** Sender BSUID (`from_user_id`), when Meta includes it. */
	readonly fromUserId?: string
	/** Sender parent BSUID (`from_parent_user_id`). */
	readonly fromParentUserId?: string
	/** Profile name of the sender. */
	readonly senderName?: string
	/** wa_id from the contacts block (equals `from` for phone-known contacts). */
	readonly waId?: string
	/** BSUID from the contacts block. */
	readonly userId?: string
	/** Parent BSUID from the contacts block. */
	readonly parentUserId?: string
	/** WhatsApp username of the sender, when Meta surfaces it. */
	readonly username?: string
	/** WhatsApp Business Account the message was delivered to. */
	readonly businessAccountId: string
	/** Business phone number the message was delivered to. */
	readonly phoneNumber: BusinessPhoneNumber
	readonly context: MessageContext
	/** Shortcut for `context.forwarded`. */
	readonly isForwarded: boolean
	/** Click-to-WhatsApp ad referral, when the message came from an ad. */
	readonly referral?: AdReferral
	/** Group id, for messages received in a group. */
	readonly groupId?: string
	/** The untouched message object from the webhook payload. */
	readonly raw: InboundMessage

	readonly #messaging: MessagingClient

	protected constructor(init: MessageEventInit) {
		super(init.message.timestamp)
		const message = init.message
		this.#messaging = init.messaging
		this.messageId = message.id
		this.from = message.from ?? ''
		this.fromUserId = message.from_user_id || undefined
		this.fromParentUserId = message.from_parent_user_id || undefined
		this.senderName = init.sender.name || undefined
		this.waId = init.sender.waId || undefined
		this.userId = init.sender.userId || undefined
		this.parentUserId = init.sender.parentUserId || undefined
		this.username = init.sender.username || undefined
		this.businessAccountId = init.businessAccountId
		this.phoneNumber = init.phoneNumber
		this.context = {
			repliedToMessageId: message.context?.id || undefined,
			repliedToFrom: message.context?.from || undefined,
			forwarded: message.context?.forwarded ?? false,
			frequentlyForwarded: message.context?.frequently_forwarded ?? false
		}
		this.isForwarded = this.context.forwarded
		this.referral = mapReferral(message.referral)
		this.groupId = message.group_id || undefined
		this.raw = message
	}

	/** Messaging client of the business number that received this message. */
	get messaging(): MessagingClient {
		return this.#messaging
	}

	private get replyTarget(): string | { userId: string } {
		if (this.from) return this.from
		const userId = this.fromUserId ?? this.userId
		if (userId) return { userId }
		return this.waId ?? ''
	}

	/** Sends `message` to the sender, without quoting this message. */
	send(message: BaseMessage): Promise<MessageSendResponse> {
		return this.#messaging.message.send({ to: this.replyTarget, message })
	}

	/** Sends `message` to the sender as a reply quoting this message. */
	reply(message: BaseMessage): Promise<MessageSendResponse> {
		return this.#messaging.message.reply({
			to: this.replyTarget,
			message,
			replyToMessageId: this.messageId
		})
	}

	/** Reacts to this message. Pass `""` to remove a reaction. */
	react(emoji: string): Promise<MessageSendResponse> {
		return this.#messaging.message.send({
			to: this.replyTarget,
			message: new ReactionMessage({ messageId: this.messageId, emoji })
		})
	}

	/** Marks this message as read, optionally showing a typing indicator. */
	markAsRead(options?: MarkAsReadOptions): Promise<void> {
		return this.#messaging.message.markAsRead(this.messageId, options)
	}
}

/** Base class of image, audio, video, document and sticker events. */
export abstract class MediaMessageEvent extends BaseMessageEvent {
	readonly mediaId: string
	readonly mimeType?: string
	readonly sha256?: string

	protected constructor(
		init: MessageEventInit,
		media: { id: string; mime_type?: string; sha256?: string }
	) {
		super(init)
		this.mediaId = media.id
		this.mimeType = media.mime_type
		this.sha256 = media.sha256
	}

	/** Short lived download URL of the media. */
	getUrl(): Promise<string> {
		return this.messaging.media.getUrl(this.mediaId)
	}

	/** Downloads the media bytes. */
	download(): Promise<{ data: ArrayBuffer; mimeType: string }> {
		return this.messaging.media.download(this.mediaId)
	}
}

/** Meta's pricing block on a status update. */
export interface MessagePricing {
	billable: boolean
	/** `"CBP"` (conversation based) or `"PMP"` (per message). */
	pricingModel?: string
	/** `"marketing"`, `"utility"`, `"authentication"`, `"service"`, ... */
	category?: string
	/** PMP only: `"regular"`, `"free_customer_service"`, `"free_entry_point"`. */
	type?: string
}

/** Conversation block on a status update (conversation based pricing). */
export interface StatusConversation {
	id: string
	expirationTimestamp?: number
	originType?: string
}

/** @internal */
export interface StatusEventInit {
	businessAccountId: string
	phoneNumber: BusinessPhoneNumber
	status: InboundStatus
}

/** Base class of `sent`, `delivered`, `read`, `failed` and other status events. */
export abstract class BaseStatusEvent extends BaseEvent {
	/** Id of the message this status is about (the id `send()` returned). */
	readonly messageId: string
	readonly status: string
	/** wa_id the message was sent to. */
	readonly recipientId: string
	/** Recipient BSUID. */
	readonly recipientUserId?: string
	readonly recipientParentUserId?: string
	readonly recipientIdentityKeyHash?: string
	/** Value passed as `bizOpaqueCallbackData` when sending. */
	readonly bizOpaqueCallbackData?: string
	/**
	 * Pricing block, when Meta included one. It can repeat across
	 * sent/delivered/read for the same message: deduplicate by `messageId`.
	 */
	readonly pricing?: MessagePricing
	readonly conversation?: StatusConversation
	readonly errors: WebhookEventError[]
	readonly businessAccountId: string
	readonly phoneNumber: BusinessPhoneNumber
	/** The untouched status object from the webhook payload. */
	readonly raw: InboundStatus

	constructor(init: StatusEventInit) {
		super(init.status.timestamp)
		const status = init.status
		this.messageId = status.id
		this.status = status.status
		this.recipientId = status.recipient_id
		this.recipientUserId = status.recipient_user_id || undefined
		this.recipientParentUserId = status.recipient_parent_user_id || undefined
		this.recipientIdentityKeyHash = status.recipient_identity_key_hash || undefined
		this.bizOpaqueCallbackData = status.biz_opaque_callback_data || undefined
		const pricing = status.pricing
		if (
			pricing &&
			(pricing.billable !== undefined || pricing.pricing_model || pricing.category)
		) {
			this.pricing = {
				billable: pricing.billable ?? false,
				pricingModel: pricing.pricing_model,
				category: pricing.category,
				type: pricing.type
			}
		}
		if (status.conversation?.id) {
			const expiration = Number(status.conversation.expiration_timestamp)
			this.conversation = {
				id: status.conversation.id,
				expirationTimestamp: Number.isFinite(expiration) ? expiration : undefined,
				originType: status.conversation.origin?.type
			}
		}
		this.errors = mapErrors(status.errors)
		this.businessAccountId = init.businessAccountId
		this.phoneNumber = init.phoneNumber
		this.raw = status
	}

	/** First error, if any. Failed / undelivered statuses always carry one. */
	get error(): WebhookEventError | undefined {
		return this.errors[0]
	}
}

/** Base class of WhatsApp Business Account level events (templates, quality, account...). */
export abstract class BaseBusinessAccountEvent extends BaseEvent {
	/** WhatsApp Business Account id (`entry.id`). */
	readonly businessAccountId: string
	/** The untouched `change.value` from the webhook payload. */
	readonly raw: unknown

	protected constructor(init: { businessAccountId: string; timestamp?: number; raw: unknown }) {
		super(init.timestamp)
		this.businessAccountId = init.businessAccountId
		this.raw = init.raw
	}
}
