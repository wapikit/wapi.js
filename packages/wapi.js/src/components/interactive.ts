import { ValidationError } from '../errors'
import { BaseMessage, MessageTypeEnum, compact } from './base'
import { type MediaSource, type MediaSourcePayload, toMediaSourcePayload } from './media'
import { MessageLimits, assertOptionalText, assertText } from './validation'

/** `interactive.type` of an interactive message. */
export enum InteractiveMessageTypeEnum {
	Button = 'button',
	List = 'list',
	CtaUrl = 'cta_url',
	Product = 'product',
	ProductList = 'product_list',
	Catalog = 'catalog_message',
	LocationRequest = 'location_request_message',
	ContactRequest = 'contact_request'
}

/** `interactive.header.type`. */
export enum InteractiveHeaderTypeEnum {
	Text = 'text',
	Image = 'image',
	Video = 'video',
	Document = 'document'
}

/**
 * Header of a reply button or CTA URL message: text (up to 60 characters) or
 * an image, video or document. A plain string is shorthand for a text header.
 */
export type InteractiveHeader =
	| string
	| { type: 'text'; text: string }
	| { type: 'image'; image: MediaSource }
	| { type: 'video'; video: MediaSource }
	| { type: 'document'; document: MediaSource & { filename?: string } }

/** Cloud API `interactive.header` object. */
export type InteractiveHeaderPayload =
	| { type: 'text'; text: string }
	| { type: 'image'; image: MediaSourcePayload }
	| { type: 'video'; video: MediaSourcePayload }
	| { type: 'document'; document: MediaSourcePayload & { filename?: string } }

/** Cloud API `interactive.body` / `interactive.footer` object. */
export interface InteractiveTextPayload {
	text: string
}

/** @internal Validates a header and converts it to its payload. */
export function toHeaderPayload(header: InteractiveHeader): InteractiveHeaderPayload {
	if (typeof header === 'string') {
		assertText(header, 'header', MessageLimits.headerText)
		return { type: 'text', text: header }
	}
	switch (header.type) {
		case 'text':
			assertText(header.text, 'header.text', MessageLimits.headerText)
			return { type: 'text', text: header.text }
		case 'image':
			return { type: 'image', image: toMediaSourcePayload(header.image, 'header.image') }
		case 'video':
			return { type: 'video', video: toMediaSourcePayload(header.video, 'header.video') }
		case 'document':
			assertOptionalText(header.document.filename, 'header.document.filename')
			return {
				type: 'document',
				document: {
					...toMediaSourcePayload(header.document, 'header.document'),
					...compact({ filename: header.document.filename })
				}
			}
		default:
			return assertNever(header, 'header.type')
	}
}

function assertNever(value: never, field: string): never {
	const type = (value as { type?: unknown }).type
	throw new ValidationError(`Unsupported \`${field}\`: ${String(type)}`)
}

/** @internal Validates a header text (text only headers). */
export function toTextHeaderPayload(
	text: string,
	field = 'header'
): { type: 'text'; text: string } {
	assertText(text, field, MessageLimits.headerText)
	return { type: 'text', text }
}

/** @internal Validates and wraps body text. */
export function toBodyPayload(
	text: string,
	max: number = MessageLimits.interactiveBody,
	field = 'bodyText'
): InteractiveTextPayload {
	assertText(text, field, max)
	return { text }
}

/** @internal Validates and wraps optional footer text. */
export function toFooterPayload(
	text: string | undefined,
	field = 'footerText'
): InteractiveTextPayload | undefined {
	assertOptionalText(text, field, MessageLimits.footerText)
	return text === undefined ? undefined : { text }
}

/** Cloud API `interactive` object, minus the type specific `action`. */
export interface InteractivePayloadBase<I extends InteractiveMessageTypeEnum> {
	type: I
	header?: InteractiveHeaderPayload
	body?: InteractiveTextPayload
	footer?: InteractiveTextPayload
}

/**
 * Base class of every `interactive` message. Subclasses implement
 * {@link InteractiveMessage.interactive}, which returns the `interactive`
 * object without its `type`.
 */
export abstract class InteractiveMessage<
	I extends InteractiveMessageTypeEnum = InteractiveMessageTypeEnum
> extends BaseMessage<MessageTypeEnum.Interactive> {
	/** `interactive.type`. */
	readonly interactiveType: I

	protected constructor(interactiveType: I) {
		super(MessageTypeEnum.Interactive)
		this.interactiveType = interactiveType
	}

	/** The `interactive` object, without `type`. Undefined keys are dropped. */
	protected abstract interactive(): Record<string, unknown>

	protected content(): {
		interactive: InteractivePayloadBase<I> & Record<string, unknown>
	} {
		return {
			interactive: { type: this.interactiveType, ...compact(this.interactive()) }
		}
	}
}
