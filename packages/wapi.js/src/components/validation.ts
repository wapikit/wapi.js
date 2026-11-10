import { assert } from './base'

/**
 * Limits enforced by the WhatsApp Cloud API on outgoing messages. Components
 * validate against these in their constructors so mistakes surface as a
 * {@link ValidationError} before a request is made.
 */
export const MessageLimits = {
	/** `text.body` of a text message. */
	textBody: 4096,
	/** `caption` of an image, video or document. */
	mediaCaption: 1024,
	/** `interactive.body.text` (reply buttons, CTA URL, product, catalog, requests). */
	interactiveBody: 1024,
	/** `interactive.body.text` of a list message. */
	listBody: 4096,
	/** `interactive.header.text`. */
	headerText: 60,
	/** `interactive.footer.text`. */
	footerText: 60,
	/** Number of reply buttons. */
	replyButtons: 3,
	replyButtonTitle: 20,
	replyButtonId: 256,
	/** `action.button` of a list message. */
	listButtonText: 20,
	listSections: 10,
	/** Rows across all sections of a list message. */
	listRows: 10,
	listSectionTitle: 24,
	listRowTitle: 24,
	listRowDescription: 72,
	listRowId: 200,
	/** `action.parameters.display_text` of a CTA URL message. */
	ctaDisplayText: 20,
	/** Sections of a product list message or multi-product template button. */
	productSections: 10,
	/** Products across all sections of a product list message / MPM button. */
	productItems: 30,
	productSectionTitle: 24,
	/** Buttons in a template message (or in one carousel card). */
	templateButtons: 10,
	/** Cards in a template carousel. */
	carouselCards: 10,
	/** Text parameter of a template header. */
	templateHeaderText: 60,
	/** Coupon / one-time password code on a copy code or OTP button. */
	couponCode: 15
} as const

/** Length in user-perceived characters (code points), as Meta counts them. */
export function charLength(value: string): number {
	return [...value].length
}

/** Asserts `value` is a non-empty string of at most `max` characters. */
export function assertText(value: unknown, field: string, max?: number): asserts value is string {
	assert(
		typeof value === 'string' && value.trim().length > 0,
		`\`${field}\` must be a non-empty string`
	)
	if (max !== undefined) {
		const length = charLength(value)
		assert(length <= max, `\`${field}\` must be at most ${max} characters, got ${length}`)
	}
}

/** Like {@link assertText}, but `undefined` is allowed. */
export function assertOptionalText(
	value: unknown,
	field: string,
	max?: number
): asserts value is string | undefined {
	if (value !== undefined) assertText(value, field, max)
}

/** Asserts `value` is an array with between `min` and `max` entries. */
export function assertCount(
	value: unknown,
	field: string,
	min: number,
	max?: number
): asserts value is readonly unknown[] {
	assert(Array.isArray(value), `\`${field}\` must be an array`)
	assert(value.length >= min, `\`${field}\` needs at least ${min} item${min === 1 ? '' : 's'}`)
	if (max !== undefined) {
		assert(value.length <= max, `\`${field}\` allows at most ${max} items, got ${value.length}`)
	}
}

/** Asserts every value in `values` is distinct. */
export function assertUnique(values: readonly string[], field: string): void {
	const seen = new Set<string>()
	for (const value of values) {
		assert(!seen.has(value), `\`${field}\` must be unique, "${value}" is repeated`)
		seen.add(value)
	}
}
