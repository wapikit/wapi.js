import { BaseMessage, MessageTypeEnum, assert, compact } from './base'
import { MessageLimits, assertText } from './validation'

/** Input of {@link TextMessage}. */
export interface TextMessageOptions {
	/** Message body, up to 4096 characters. May contain URLs and WhatsApp formatting. */
	text: string
	/** Render a link preview for the first URL in `text`. */
	previewUrl?: boolean
}

/** Cloud API `text` object. */
export interface TextMessagePayload {
	body: string
	preview_url?: boolean
}

/**
 * A plain text message.
 *
 * @example
 * ```ts
 * new TextMessage({ text: "Hi! See https://example.com", previewUrl: true });
 * ```
 */
export class TextMessage extends BaseMessage<MessageTypeEnum.Text> {
	readonly data: Readonly<TextMessageOptions>

	constructor(data: TextMessageOptions) {
		super(MessageTypeEnum.Text)
		assertText(data.text, 'text', MessageLimits.textBody)
		assert(
			data.previewUrl === undefined || typeof data.previewUrl === 'boolean',
			'`previewUrl` must be a boolean'
		)
		this.data = { ...data }
	}

	protected content(): { text: TextMessagePayload } {
		return {
			text: compact({ body: this.data.text, preview_url: this.data.previewUrl })
		}
	}
}
