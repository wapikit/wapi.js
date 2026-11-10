/**
 * TypeScript shapes of the WhatsApp Cloud API webhook payload. They are
 * deliberately permissive (most fields optional): Meta adds fields over time
 * and the webhook must keep working when it does. Nothing here is validated at
 * runtime beyond what the dispatcher needs.
 */

export interface WebhookPayload {
	object: string
	entry: WebhookEntry[]
}

export interface WebhookEntry {
	/** WhatsApp Business Account id. */
	id: string
	/** Unix seconds; present on business account fields. */
	time?: number
	changes: WebhookChange[]
}

export interface WebhookChange {
	field: string
	value: unknown
}

export interface WebhookError {
	code: number
	title?: string
	message?: string
	href?: string
	error_data?: { details?: string }
}

export interface MessagesValue {
	messaging_product: 'whatsapp'
	metadata: { display_phone_number: string; phone_number_id: string }
	contacts?: SenderContact[]
	messages?: InboundMessage[]
	statuses?: InboundStatus[]
	errors?: WebhookError[]
}

export interface SenderContact {
	wa_id?: string
	/** Business-scoped user id (BSUID) of the sender. */
	user_id?: string
	parent_user_id?: string
	identity_key_hash?: string
	profile?: { name?: string; username?: string }
}

export interface InboundMessageContext {
	forwarded?: boolean
	frequently_forwarded?: boolean
	/** Sender of the quoted message. */
	from?: string
	/** Id of the quoted message. */
	id?: string
	referred_product?: { catalog_id: string; product_retailer_id: string }
}

export interface InboundReferral {
	source_url?: string
	source_type?: string
	source_id?: string
	headline?: string
	body?: string
	media_type?: string
	image_url?: string
	video_url?: string
	thumbnail_url?: string
	ctwa_clid?: string
	welcome_message?: { text?: string }
}

export interface InboundMedia {
	id: string
	mime_type?: string
	sha256?: string
	caption?: string
	filename?: string
	url?: string
	link?: string
	/** Audio: true for a voice note. */
	voice?: boolean
	/** Sticker: true when animated. */
	animated?: boolean
}

export interface InboundContact {
	name: {
		formatted_name: string
		first_name?: string
		last_name?: string
		middle_name?: string
		suffix?: string
		prefix?: string
	}
	addresses?: {
		street?: string
		city?: string
		state?: string
		zip?: string
		country?: string
		country_code?: string
		type?: string
	}[]
	birthday?: string
	emails?: { email?: string; type?: string }[]
	org?: { company?: string; department?: string; title?: string }
	phones?: { phone?: string; wa_id?: string; type?: string }[]
	urls?: { url?: string; type?: string }[]
}

export interface InboundMessage {
	id: string
	from: string
	/** Sender BSUID. */
	from_user_id?: string
	from_parent_user_id?: string
	timestamp: string
	type: string
	group_id?: string
	context?: InboundMessageContext
	referral?: InboundReferral
	errors?: WebhookError[]
	text?: { body: string }
	image?: InboundMedia
	audio?: InboundMedia
	video?: InboundMedia
	document?: InboundMedia
	sticker?: InboundMedia
	location?: {
		latitude: number
		longitude: number
		name?: string
		address?: string
		url?: string
	}
	contacts?: InboundContact[]
	reaction?: { message_id: string; emoji?: string }
	button?: { payload?: string; text: string }
	interactive?: {
		type: 'button_reply' | 'list_reply' | 'nfm_reply' | (string & Record<never, never>)
		button_reply?: { id: string; title: string }
		list_reply?: { id: string; title: string; description?: string }
		nfm_reply?: { name?: string; body?: string; response_json: string }
	}
	order?: {
		catalog_id: string
		text?: string
		product_items: {
			product_retailer_id: string
			quantity: number | string
			item_price: number | string
			currency: string
		}[]
	}
	system?: {
		body?: string
		type?: string
		wa_id?: string
		/** Deprecated by Meta; older payloads only. */
		customer?: string
		identity?: string
	}
	identity?: {
		acknowledged?: boolean
		created_timestamp?: number
		hash?: string
	}
	unsupported?: { type?: string }
}

export interface InboundPricing {
	billable?: boolean
	pricing_model?: string
	category?: string
	type?: string
}

export interface InboundConversation {
	id: string
	expiration_timestamp?: string
	origin?: { type?: string }
}

export interface InboundStatus {
	id: string
	status:
		| 'sent'
		| 'delivered'
		| 'read'
		| 'failed'
		| 'deleted'
		| 'warning'
		| (string & Record<never, never>)
	timestamp: string
	recipient_id: string
	/** Recipient BSUID. */
	recipient_user_id?: string
	recipient_parent_user_id?: string
	recipient_type?: string
	recipient_participant_id?: string
	recipient_identity_key_hash?: string
	biz_opaque_callback_data?: string
	conversation?: InboundConversation
	pricing?: InboundPricing
	errors?: WebhookError[]
}
