import {
	AudioMessage,
	ContactMessage,
	DocumentMessage,
	ImageMessage,
	LocationMessage,
	StickerMessage,
	TextMessage,
	VideoMessage
} from '../components'
import { type InboundContact } from '../webhook/payload'
import { BaseMessageEvent, MediaMessageEvent, type MessageEventInit } from './base'

/** A text message. */
export class TextMessageEvent extends BaseMessageEvent {
	/** Message body. */
	readonly text: string
	readonly #build: () => TextMessage
	#message?: TextMessage

	constructor(init: MessageEventInit) {
		super(init)
		this.text = init.message.text?.body ?? ''
		this.#build = () => new TextMessage({ text: this.text || ' ' })
	}

	/**
	 * The body as a component, ready to be sent again.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): TextMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** An image message. */
export class ImageMessageEvent extends MediaMessageEvent {
	readonly caption?: string
	readonly #build: () => ImageMessage
	#message?: ImageMessage

	constructor(init: MessageEventInit) {
		const media = init.message.image ?? { id: '' }
		super(init, media)
		this.caption = media.caption || undefined
		this.#build = () => new ImageMessage({ id: media.id, caption: this.caption })
	}

	/**
	 * The image as a component (by media id), ready to be forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): ImageMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** An audio message or voice note. */
export class AudioMessageEvent extends MediaMessageEvent {
	/** True for a voice note recorded in WhatsApp. */
	readonly isVoice: boolean
	readonly #build: () => AudioMessage
	#message?: AudioMessage

	constructor(init: MessageEventInit) {
		const media = init.message.audio ?? { id: '' }
		super(init, media)
		this.isVoice = media.voice ?? false
		this.#build = () => new AudioMessage({ id: media.id })
	}

	/**
	 * The message as a component, ready to be sent or forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): AudioMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** A video message. */
export class VideoMessageEvent extends MediaMessageEvent {
	readonly caption?: string
	readonly #build: () => VideoMessage
	#message?: VideoMessage

	constructor(init: MessageEventInit) {
		const media = init.message.video ?? { id: '' }
		super(init, media)
		this.caption = media.caption || undefined
		this.#build = () => new VideoMessage({ id: media.id, caption: this.caption })
	}

	/**
	 * The message as a component, ready to be sent or forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): VideoMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** A document message. */
export class DocumentMessageEvent extends MediaMessageEvent {
	readonly caption?: string
	readonly filename?: string
	readonly #build: () => DocumentMessage
	#message?: DocumentMessage

	constructor(init: MessageEventInit) {
		const media = init.message.document ?? { id: '' }
		super(init, media)
		this.caption = media.caption || undefined
		this.filename = media.filename || undefined
		this.#build = () =>
			new DocumentMessage({
				id: media.id,
				caption: this.caption,
				filename: this.filename
			})
	}

	/**
	 * The message as a component, ready to be sent or forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): DocumentMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** A sticker message. */
export class StickerMessageEvent extends MediaMessageEvent {
	readonly isAnimated: boolean
	readonly #build: () => StickerMessage
	#message?: StickerMessage

	constructor(init: MessageEventInit) {
		const media = init.message.sticker ?? { id: '' }
		super(init, media)
		this.isAnimated = media.animated ?? false
		this.#build = () => new StickerMessage({ id: media.id })
	}

	/**
	 * The message as a component, ready to be sent or forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): StickerMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** A shared location. */
export class LocationMessageEvent extends BaseMessageEvent {
	readonly latitude: number
	readonly longitude: number
	readonly name?: string
	readonly address?: string
	readonly url?: string
	readonly #build: () => LocationMessage
	#message?: LocationMessage

	constructor(init: MessageEventInit) {
		super(init)
		const location = init.message.location ?? { latitude: 0, longitude: 0 }
		this.latitude = Number(location.latitude)
		this.longitude = Number(location.longitude)
		this.name = location.name || undefined
		this.address = location.address || undefined
		this.url = location.url || undefined
		this.#build = () =>
			new LocationMessage({
				latitude: this.latitude,
				longitude: this.longitude,
				name: this.name,
				address: this.address
			})
	}

	/**
	 * The message as a component, ready to be sent or forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): LocationMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** One or more shared contact cards. */
export class ContactMessageEvent extends BaseMessageEvent {
	/** The contact cards exactly as Meta sent them. */
	readonly contacts: InboundContact[]
	readonly #build: () => ContactMessage
	#message?: ContactMessage

	constructor(init: MessageEventInit) {
		super(init)
		this.contacts = init.message.contacts ?? []
		this.#build = () => new ContactMessage({ contacts: this.contacts })
	}

	/**
	 * The contacts as a component, ready to be forwarded.
	 *
	 * Built on first access. Throws a `ValidationError` when the inbound content
	 * breaks a sending limit (for example a text longer than 4096 characters).
	 */
	get message(): ContactMessage {
		this.#message ??= this.#build()
		return this.#message
	}
}

/** A reaction added to (or removed from) one of your messages. */
export class ReactionEvent extends BaseMessageEvent {
	/** Id of the message that was reacted to. */
	readonly reactedToMessageId: string
	/** The emoji; empty when the reaction was removed. */
	readonly emoji: string
	readonly isRemoved: boolean

	constructor(init: MessageEventInit) {
		super(init)
		this.reactedToMessageId = init.message.reaction?.message_id ?? ''
		this.emoji = init.message.reaction?.emoji ?? ''
		this.isRemoved = this.emoji === ''
	}
}

/** The user tapped a reply button of an interactive button message. */
export class ReplyButtonInteractionEvent extends BaseMessageEvent {
	readonly buttonId: string
	readonly title: string

	constructor(init: MessageEventInit) {
		super(init)
		this.buttonId = init.message.interactive?.button_reply?.id ?? ''
		this.title = init.message.interactive?.button_reply?.title ?? ''
	}
}

/** The user picked a row of an interactive list message. */
export class ListInteractionEvent extends BaseMessageEvent {
	/** Id of the selected row. */
	readonly listId: string
	readonly title: string
	readonly description?: string

	constructor(init: MessageEventInit) {
		super(init)
		const reply = init.message.interactive?.list_reply
		this.listId = reply?.id ?? ''
		this.title = reply?.title ?? ''
		this.description = reply?.description || undefined
	}
}

/** The user completed a WhatsApp Flow (`interactive.type = nfm_reply`). */
export class FlowCompletionEvent extends BaseMessageEvent {
	readonly flowName?: string
	readonly body?: string
	/** `response_json` as Meta sent it. */
	readonly responseJson: string
	/** `response_json` parsed, or `undefined` when it is not valid JSON. */
	readonly response: unknown

	constructor(init: MessageEventInit) {
		super(init)
		const reply = init.message.interactive?.nfm_reply
		this.flowName = reply?.name || undefined
		this.body = reply?.body || undefined
		this.responseJson = reply?.response_json ?? ''
		try {
			this.response = this.responseJson
				? (JSON.parse(this.responseJson) as unknown)
				: undefined
		} catch {
			this.response = undefined
		}
	}
}

/** The user tapped a quick reply button of a template message. */
export class QuickReplyButtonInteractionEvent extends BaseMessageEvent {
	readonly buttonText: string
	/** Payload you set on the template button. */
	readonly buttonPayload?: string

	constructor(init: MessageEventInit) {
		super(init)
		this.buttonText = init.message.button?.text ?? ''
		this.buttonPayload = init.message.button?.payload || undefined
	}
}

/** An item of a received order. */
export interface OrderedProductItem {
	productRetailerId: string
	quantity: number
	itemPrice: number
	currency: string
}

/** The user sent a cart / order from a catalog. */
export class OrderMessageEvent extends BaseMessageEvent {
	readonly catalogId: string
	/** Optional note the user added to the order. */
	readonly text?: string
	readonly productItems: OrderedProductItem[]

	constructor(init: MessageEventInit) {
		super(init)
		const order = init.message.order
		this.catalogId = order?.catalog_id ?? ''
		this.text = order?.text || undefined
		this.productItems = (order?.product_items ?? []).map(item => ({
			productRetailerId: item.product_retailer_id,
			quantity: Number(item.quantity),
			itemPrice: Number(item.item_price),
			currency: item.currency
		}))
	}
}

/** A text message sent from a product's "Message business" button. */
export class ProductInquiryEvent extends BaseMessageEvent {
	readonly text: string
	readonly catalogId: string
	readonly productRetailerId: string

	constructor(init: MessageEventInit) {
		super(init)
		this.text = init.message.text?.body ?? ''
		this.catalogId = init.message.context?.referred_product?.catalog_id ?? ''
		this.productRetailerId = init.message.context?.referred_product?.product_retailer_id ?? ''
	}
}

/**
 * The message came from a Click-to-WhatsApp ad. Emitted **in addition to** the
 * regular event for the message type (as wapi.go does), so a text bot keeps
 * working and ad attribution can be tracked separately.
 */
export class AdInteractionEvent extends BaseMessageEvent {
	/** Welcome message text, or the body of a text message. */
	readonly text: string
	readonly adSource: NonNullable<BaseMessageEvent['referral']>

	constructor(init: MessageEventInit) {
		super(init)
		this.adSource = this.referral ?? {}
		this.text = this.adSource.welcomeMessageText || init.message.text?.body || ''
	}
}

/** The customer changed their phone number (`system.type = user_changed_number`). */
export class CustomerNumberChangedEvent extends BaseMessageEvent {
	/** Previous wa_id (the `from` of the system message). */
	readonly oldWaId: string
	readonly newWaId: string
	readonly changeDescription: string

	constructor(init: MessageEventInit) {
		super(init)
		this.oldWaId = init.message.system?.customer || init.message.from
		this.newWaId = init.message.system?.wa_id ?? ''
		this.changeDescription = init.message.system?.body ?? ''
	}
}

/** The customer's security identity changed (identity change checks enabled). */
export class CustomerIdentityChangedEvent extends BaseMessageEvent {
	readonly acknowledged?: boolean
	readonly hash?: string
	readonly createdTimestamp?: number
	readonly changeDescription: string

	constructor(init: MessageEventInit) {
		super(init)
		this.acknowledged = init.message.identity?.acknowledged
		this.hash = init.message.identity?.hash || init.message.system?.identity
		this.createdTimestamp = init.message.identity?.created_timestamp
		this.changeDescription = init.message.system?.body ?? ''
	}
}

/** A message type this version of wapi.js (or the Cloud API) does not support. */
export class UnsupportedMessageEvent extends BaseMessageEvent {
	/** `message.type`, e.g. `"unsupported"` or `"unknown"`. */
	readonly messageType: string
	/** `unsupported.type` when Meta includes it (e.g. `"edit"`, `"poll"`). */
	readonly unsupportedType?: string
	readonly errors: { code: number; title?: string; message?: string; details?: string }[]

	constructor(init: MessageEventInit) {
		super(init)
		this.messageType = init.message.type
		this.unsupportedType = init.message.unsupported?.type || undefined
		this.errors = (init.message.errors ?? []).map(error => ({
			code: error.code,
			title: error.title,
			message: error.message,
			details: error.error_data?.details
		}))
	}
}
