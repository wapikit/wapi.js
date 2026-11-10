import {
	type InteractiveHeader,
	InteractiveMessage,
	InteractiveMessageTypeEnum,
	toBodyPayload,
	toFooterPayload,
	toHeaderPayload
} from './interactive'
import { MessageLimits, assertText } from './validation'

/** Input of {@link CtaUrlMessage}. */
export interface CtaUrlMessageOptions {
	/** Up to 1024 characters. */
	bodyText: string
	/** Button label, up to 20 characters. */
	displayText: string
	/** URL opened when the button is tapped. */
	url: string
	/** Text (up to 60 characters), image, video or document header. */
	header?: InteractiveHeader
	/** Up to 60 characters. */
	footerText?: string
}

/**
 * An interactive call-to-action message: a button that opens a URL, so long
 * links don't clutter the body text.
 *
 * @example
 * ```ts
 * new CtaUrlMessage({
 *   bodyText: "Track your parcel",
 *   displayText: "Track",
 *   url: "https://example.com/track/42",
 * });
 * ```
 */
export class CtaUrlMessage extends InteractiveMessage<InteractiveMessageTypeEnum.CtaUrl> {
	readonly data: Readonly<CtaUrlMessageOptions>

	constructor(data: CtaUrlMessageOptions) {
		super(InteractiveMessageTypeEnum.CtaUrl)
		toBodyPayload(data.bodyText)
		toFooterPayload(data.footerText)
		if (data.header !== undefined) toHeaderPayload(data.header)
		assertText(data.displayText, 'displayText', MessageLimits.ctaDisplayText)
		assertText(data.url, 'url')
		this.data = { ...data }
	}

	protected interactive(): Record<string, unknown> {
		const { data } = this
		return {
			header: data.header === undefined ? undefined : toHeaderPayload(data.header),
			body: toBodyPayload(data.bodyText),
			footer: toFooterPayload(data.footerText),
			action: {
				name: 'cta_url',
				parameters: { display_text: data.displayText, url: data.url }
			}
		}
	}
}
