import { InteractiveMessage, InteractiveMessageTypeEnum, toBodyPayload } from './interactive'

/** Input of {@link LocationRequestMessage}. */
export interface LocationRequestMessageOptions {
	/** Up to 1024 characters. */
	bodyText: string
}

/**
 * Asks the user to share their location, with a "Send location" button. The
 * answer arrives as an inbound location message.
 *
 * @example
 * ```ts
 * new LocationRequestMessage({ bodyText: "Where should we deliver?" });
 * ```
 */
export class LocationRequestMessage extends InteractiveMessage<InteractiveMessageTypeEnum.LocationRequest> {
	readonly data: Readonly<LocationRequestMessageOptions>

	constructor(data: LocationRequestMessageOptions) {
		super(InteractiveMessageTypeEnum.LocationRequest)
		toBodyPayload(data.bodyText)
		this.data = { ...data }
	}

	protected interactive(): Record<string, unknown> {
		return {
			body: toBodyPayload(this.data.bodyText),
			action: { name: 'send_location' }
		}
	}
}

/** Input of {@link ContactRequestMessage}. */
export interface ContactRequestMessageOptions {
	/** Up to 1024 characters. */
	bodyText: string
}

/**
 * Asks the user to share their contact info (phone number) with the business.
 * The button label is controlled by WhatsApp; only the body is yours. The
 * answer arrives as an inbound contacts message.
 *
 * @example
 * ```ts
 * new ContactRequestMessage({ bodyText: "Share your number so we can call you back" });
 * ```
 */
export class ContactRequestMessage extends InteractiveMessage<InteractiveMessageTypeEnum.ContactRequest> {
	readonly data: Readonly<ContactRequestMessageOptions>

	constructor(data: ContactRequestMessageOptions) {
		super(InteractiveMessageTypeEnum.ContactRequest)
		toBodyPayload(data.bodyText)
		this.data = { ...data }
	}

	protected interactive(): Record<string, unknown> {
		return {
			body: toBodyPayload(this.data.bodyText),
			action: { name: 'request_contact_info' }
		}
	}
}
