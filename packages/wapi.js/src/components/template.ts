import { ValidationError } from '../errors'
import { BaseMessage, MessageTypeEnum, assert, compact } from './base'
import {
	type ProductSection,
	type ProductSectionPayload,
	toProductSectionsPayload
} from './commerce'
import { type LanguageEnum } from './language'
import { assertCoordinates } from './location'
import { type MediaSource, type MediaSourcePayload, toMediaSourcePayload } from './media'
import { MessageLimits, assertCount, assertOptionalText, assertText } from './validation'

/** `type` of a template component. */
export enum TemplateComponentTypeEnum {
	Header = 'header',
	Body = 'body',
	Button = 'button',
	LimitedTimeOffer = 'limited_time_offer',
	Carousel = 'carousel'
}

/** `sub_type` of a template button component. */
export enum TemplateButtonSubTypeEnum {
	QuickReply = 'quick_reply',
	/** Dynamic URL buttons, and one-time password (copy code / autofill) buttons. */
	Url = 'url',
	/** Coupon code buttons. */
	CopyCode = 'copy_code',
	Catalog = 'catalog',
	/** Multi-product message buttons. */
	MultiProduct = 'mpm',
	Flow = 'flow'
}

/** Cloud API template `text` parameter. */
export interface TemplateTextParameterPayload {
	type: 'text'
	text: string
	/** Set for templates created with named parameters (`{{first_name}}`). */
	parameter_name?: string
}

/** Cloud API template `currency` parameter. */
export interface TemplateCurrencyParameterPayload {
	type: 'currency'
	currency: { fallback_value: string; code: string; amount_1000: number }
	parameter_name?: string
}

/** Cloud API template `date_time` parameter. */
export interface TemplateDateTimeParameterPayload {
	type: 'date_time'
	date_time: { fallback_value: string }
	parameter_name?: string
}

/** Cloud API template `image` parameter. */
export interface TemplateImageParameterPayload {
	type: 'image'
	image: MediaSourcePayload
}

/** Cloud API template `video` parameter. */
export interface TemplateVideoParameterPayload {
	type: 'video'
	video: MediaSourcePayload
}

/** Cloud API template `document` parameter. */
export interface TemplateDocumentParameterPayload {
	type: 'document'
	document: MediaSourcePayload & { filename?: string }
}

/** Cloud API template `location` parameter (location headers). */
export interface TemplateLocationParameterPayload {
	type: 'location'
	location: { latitude: string; longitude: string; name?: string; address?: string }
}

/** Cloud API template `product` parameter (single product templates, product carousels). */
export interface TemplateProductParameterPayload {
	type: 'product'
	product: { product_retailer_id: string; catalog_id: string }
}

/** Any header or body parameter of a template. Build them with {@link TemplateParameter}. */
export type TemplateParameterPayload =
	| TemplateTextParameterPayload
	| TemplateCurrencyParameterPayload
	| TemplateDateTimeParameterPayload
	| TemplateImageParameterPayload
	| TemplateVideoParameterPayload
	| TemplateDocumentParameterPayload
	| TemplateLocationParameterPayload
	| TemplateProductParameterPayload

/** `action` of a template button parameter (catalog, MPM and flow buttons). */
export interface TemplateButtonActionPayload {
	thumbnail_product_retailer_id?: string
	sections?: ProductSectionPayload[]
	flow_token?: string
	flow_action_data?: Record<string, unknown>
}

/** A parameter of a template button component. */
export type TemplateButtonParameterPayload =
	| { type: 'payload'; payload: string }
	| { type: 'text'; text: string }
	| { type: 'coupon_code'; coupon_code: string }
	| { type: 'action'; action: TemplateButtonActionPayload }

/** Cloud API template header component. */
export interface TemplateHeaderComponentPayload {
	type: 'header'
	parameters: TemplateParameterPayload[]
}

/** Cloud API template body component. */
export interface TemplateBodyComponentPayload {
	type: 'body'
	parameters: TemplateParameterPayload[]
}

/** Cloud API template button component. Build them with {@link TemplateButton}. */
export interface TemplateButtonComponentPayload {
	type: 'button'
	sub_type: `${TemplateButtonSubTypeEnum}`
	/** Position of the button in the template, 0 to 9. */
	index: number
	parameters: TemplateButtonParameterPayload[]
}

/** Cloud API limited-time offer component. */
export interface TemplateLimitedTimeOfferComponentPayload {
	type: 'limited_time_offer'
	parameters: {
		type: 'limited_time_offer'
		limited_time_offer: { expiration_time_ms: number }
	}[]
}

/** A card of a carousel component. */
export interface TemplateCarouselCardPayload {
	card_index: number
	components: (
		| TemplateHeaderComponentPayload
		| TemplateBodyComponentPayload
		| TemplateButtonComponentPayload
	)[]
}

/** Cloud API carousel component. */
export interface TemplateCarouselComponentPayload {
	type: 'carousel'
	cards: TemplateCarouselCardPayload[]
}

/** Any component of a template message, exactly as the Cloud API expects it. */
export type TemplateComponentPayload =
	| TemplateHeaderComponentPayload
	| TemplateBodyComponentPayload
	| TemplateButtonComponentPayload
	| TemplateLimitedTimeOfferComponentPayload
	| TemplateCarouselComponentPayload

/** Cloud API `template` object. */
export interface TemplateMessagePayload {
	name: string
	language: { policy: 'deterministic'; code: string }
	components?: TemplateComponentPayload[]
}

/** Options shared by parameters that can be named. */
export interface NamedParameterOptions {
	/**
	 * Parameter name, for templates created with named parameters
	 * (`{{order_id}}` instead of `{{1}}`).
	 */
	name?: string
}

/**
 * Factories for template header and body parameters. Each returns the
 * Cloud API parameter object.
 *
 * @example
 * ```ts
 * TemplateParameter.text("Jane", { name: "first_name" });
 * TemplateParameter.currency({ fallbackValue: "$10.99", code: "USD", amount1000: 10990 });
 * TemplateParameter.image({ link: "https://example.com/banner.png" });
 * ```
 */
export abstract class TemplateParameter {
	/** A text parameter. */
	static text(text: string, options: NamedParameterOptions = {}): TemplateTextParameterPayload {
		assertText(text, 'text parameter')
		assertOptionalText(options.name, 'parameter name')
		return compact({ type: 'text' as const, text, parameter_name: options.name })
	}

	/** A localised currency amount. `amount1000` is the amount multiplied by 1000. */
	static currency(
		options: { fallbackValue: string; code: string; amount1000: number } & NamedParameterOptions
	): TemplateCurrencyParameterPayload {
		assertText(options.fallbackValue, 'currency.fallbackValue')
		assertText(options.code, 'currency.code')
		assert(
			Number.isInteger(options.amount1000),
			'`currency.amount1000` must be an integer (amount multiplied by 1000)'
		)
		assertOptionalText(options.name, 'parameter name')
		return compact({
			type: 'currency' as const,
			currency: {
				fallback_value: options.fallbackValue,
				code: options.code,
				amount_1000: options.amount1000
			},
			parameter_name: options.name
		})
	}

	/** A date / time. WhatsApp shows `fallbackValue` as is. */
	static dateTime(
		options: { fallbackValue: string } & NamedParameterOptions
	): TemplateDateTimeParameterPayload {
		assertText(options.fallbackValue, 'dateTime.fallbackValue')
		assertOptionalText(options.name, 'parameter name')
		return compact({
			type: 'date_time' as const,
			date_time: { fallback_value: options.fallbackValue },
			parameter_name: options.name
		})
	}

	/** An image header. */
	static image(source: MediaSource): TemplateImageParameterPayload {
		return { type: 'image', image: toMediaSourcePayload(source, 'image') }
	}

	/** A video header. */
	static video(source: MediaSource): TemplateVideoParameterPayload {
		return { type: 'video', video: toMediaSourcePayload(source, 'video') }
	}

	/** A document header. */
	static document(source: MediaSource & { filename?: string }): TemplateDocumentParameterPayload {
		assertOptionalText(source.filename, 'document.filename')
		return {
			type: 'document',
			document: {
				...toMediaSourcePayload(source, 'document'),
				...compact({ filename: source.filename })
			}
		}
	}

	/** A location header. */
	static location(options: {
		latitude: number
		longitude: number
		name?: string
		address?: string
	}): TemplateLocationParameterPayload {
		assertCoordinates(options.latitude, options.longitude)
		assertOptionalText(options.name, 'location.name')
		assertOptionalText(options.address, 'location.address')
		return {
			type: 'location',
			location: compact({
				latitude: String(options.latitude),
				longitude: String(options.longitude),
				name: options.name,
				address: options.address
			})
		}
	}

	/** A catalog product (single product templates and product card carousels). */
	static product(options: {
		catalogId: string
		productRetailerId: string
	}): TemplateProductParameterPayload {
		assertText(options.catalogId, 'product.catalogId')
		assertText(options.productRetailerId, 'product.productRetailerId')
		return {
			type: 'product',
			product: {
				product_retailer_id: options.productRetailerId,
				catalog_id: options.catalogId
			}
		}
	}
}

/** Position of a button in the template, 0 to 9. */
export interface TemplateButtonIndexOptions {
	index: number
}

function assertButtonIndex(index: unknown): asserts index is number {
	assert(
		typeof index === 'number' &&
			Number.isInteger(index) &&
			index >= 0 &&
			index < MessageLimits.templateButtons,
		`Template button \`index\` must be an integer from 0 to ${MessageLimits.templateButtons - 1}`
	)
}

function assertCode(code: string, field: string): void {
	assertText(code, field, MessageLimits.couponCode)
}

/**
 * Factories for template button components. Only buttons with dynamic content
 * need to be sent; static buttons defined in the template are added by
 * WhatsApp automatically.
 *
 * @example
 * ```ts
 * TemplateButton.quickReply({ index: 0, payload: "unsubscribe" });
 * TemplateButton.url({ index: 1, text: "order/42" });
 * TemplateButton.copyCode({ index: 2, couponCode: "SAVE20" });
 * ```
 */
export abstract class TemplateButton {
	/** Quick reply button; `payload` comes back in the button webhook. */
	static quickReply(
		options: TemplateButtonIndexOptions & { payload: string }
	): TemplateButtonComponentPayload {
		assertButtonIndex(options.index)
		assertText(options.payload, 'quickReply.payload')
		return {
			type: 'button',
			sub_type: 'quick_reply',
			index: options.index,
			parameters: [{ type: 'payload', payload: options.payload }]
		}
	}

	/** URL button with a dynamic suffix, `text` replaces `{{1}}` in the template URL. */
	static url(
		options: TemplateButtonIndexOptions & { text: string }
	): TemplateButtonComponentPayload {
		assertButtonIndex(options.index)
		assertText(options.text, 'url.text')
		return {
			type: 'button',
			sub_type: 'url',
			index: options.index,
			parameters: [{ type: 'text', text: options.text }]
		}
	}

	/** Copy code (coupon) button of a marketing template. Codes are up to 15 characters. */
	static copyCode(
		options: TemplateButtonIndexOptions & { couponCode: string }
	): TemplateButtonComponentPayload {
		assertButtonIndex(options.index)
		assertCode(options.couponCode, 'copyCode.couponCode')
		return {
			type: 'button',
			sub_type: 'copy_code',
			index: options.index,
			parameters: [{ type: 'coupon_code', coupon_code: options.couponCode }]
		}
	}

	/**
	 * One-time password button of an authentication template (copy code,
	 * one-tap or zero-tap autofill). `index` defaults to 0. Remember to also
	 * send the code as the body parameter, or use {@link TemplateMessage.addOtp}.
	 */
	static otp(options: { code: string; index?: number }): TemplateButtonComponentPayload {
		const index = options.index ?? 0
		assertButtonIndex(index)
		assertCode(options.code, 'otp.code')
		return {
			type: 'button',
			sub_type: 'url',
			index,
			parameters: [{ type: 'text', text: options.code }]
		}
	}

	/** "View catalog" button of a catalog template. */
	static catalog(
		options: TemplateButtonIndexOptions & { thumbnailProductRetailerId?: string }
	): TemplateButtonComponentPayload {
		assertButtonIndex(options.index)
		assertOptionalText(options.thumbnailProductRetailerId, 'catalog.thumbnailProductRetailerId')
		return {
			type: 'button',
			sub_type: 'catalog',
			index: options.index,
			parameters: [
				{
					type: 'action',
					action: compact({
						thumbnail_product_retailer_id: options.thumbnailProductRetailerId
					})
				}
			]
		}
	}

	/** "View items" button of a multi-product (MPM) template. */
	static multiProduct(
		options: TemplateButtonIndexOptions & {
			thumbnailProductRetailerId: string
			/** One to ten sections with at most 30 products in total. */
			sections: ProductSection[]
		}
	): TemplateButtonComponentPayload {
		assertButtonIndex(options.index)
		assertText(options.thumbnailProductRetailerId, 'multiProduct.thumbnailProductRetailerId')
		return {
			type: 'button',
			sub_type: 'mpm',
			index: options.index,
			parameters: [
				{
					type: 'action',
					action: {
						thumbnail_product_retailer_id: options.thumbnailProductRetailerId,
						sections: toProductSectionsPayload(
							options.sections,
							'multiProduct.sections'
						)
					}
				}
			]
		}
	}

	/** Flow button. `flowActionData` pre-fills the first screen of the flow. */
	static flow(
		options: TemplateButtonIndexOptions & {
			flowToken?: string
			flowActionData?: Record<string, unknown>
		}
	): TemplateButtonComponentPayload {
		assertButtonIndex(options.index)
		assertOptionalText(options.flowToken, 'flow.flowToken')
		return {
			type: 'button',
			sub_type: 'flow',
			index: options.index,
			parameters: [
				{
					type: 'action',
					action: compact({
						flow_token: options.flowToken,
						flow_action_data: options.flowActionData
					})
				}
			]
		}
	}
}

/** A card of {@link TemplateMessage.addCarousel}. Its position is the card index. */
export interface TemplateCarouselCard {
	/** Image or video header (media carousels), or a product (product carousels). */
	header: TemplateParameterPayload
	/** Body parameters of the card, if its body has variables. */
	body?: TemplateParameterPayload[]
	/** Dynamic buttons of the card (up to two), indexed within the card. */
	buttons?: TemplateButtonComponentPayload[]
}

/** Input of {@link TemplateMessage}. */
export interface TemplateMessageOptions {
	/** Name of an approved template. */
	name: string
	/** Language (and locale) code of the template translation to send. */
	language: LanguageEnum | (string & Record<never, never>)
	/** Raw components, added as if passed to {@link TemplateMessage.addComponent}. */
	components?: TemplateComponentPayload[]
}

const HEADER_PARAMETER_TYPES = new Set<TemplateParameterPayload['type']>([
	'text',
	'image',
	'video',
	'document',
	'location',
	'product'
])
const BODY_PARAMETER_TYPES = new Set<TemplateParameterPayload['type']>([
	'text',
	'currency',
	'date_time'
])
const BUTTON_SUB_TYPES = new Set<string>(Object.values(TemplateButtonSubTypeEnum))
const CAROUSEL_CARD_BUTTONS = 2

function assertNamedConsistently(
	parameters: readonly TemplateParameterPayload[],
	field: string
): void {
	const named = parameters.filter(
		parameter => 'parameter_name' in parameter && parameter.parameter_name !== undefined
	).length
	assert(
		named === 0 || named === parameters.length,
		`\`${field}\` mixes named and positional parameters; use one style for every parameter`
	)
}

function validateHeader(component: TemplateHeaderComponentPayload, field: string): void {
	assertCount(component.parameters, `${field}.parameters`, 1, 1)
	const [parameter] = component.parameters
	assert(
		HEADER_PARAMETER_TYPES.has(parameter.type),
		`\`${field}\` does not support \`${parameter.type}\` parameters`
	)
	if (parameter.type === 'text') {
		assertText(parameter.text, `${field}.parameters[0].text`, MessageLimits.templateHeaderText)
	}
}

function validateBody(component: TemplateBodyComponentPayload, field: string): void {
	assertCount(component.parameters, `${field}.parameters`, 1)
	component.parameters.forEach((parameter, index) =>
		assert(
			BODY_PARAMETER_TYPES.has(parameter.type),
			`\`${field}.parameters[${index}]\`: body does not support \`${parameter.type}\` parameters`
		)
	)
	assertNamedConsistently(component.parameters, `${field}.parameters`)
}

function validateButton(component: TemplateButtonComponentPayload, field: string): void {
	assertButtonIndex(component.index)
	assert(
		BUTTON_SUB_TYPES.has(component.sub_type),
		`\`${field}.sub_type\` "${component.sub_type}" is not supported`
	)
	assertCount(component.parameters, `${field}.parameters`, 1)
}

function assertUniqueIndexes(buttons: readonly TemplateButtonComponentPayload[], field: string) {
	const seen = new Set<number>()
	for (const button of buttons) {
		assert(!seen.has(button.index), `\`${field}\` has two buttons with index ${button.index}`)
		seen.add(button.index)
	}
}

/**
 * A template message, the only kind of message that can start a conversation
 * (or be sent outside the 24 hour customer service window).
 *
 * Add the components whose variables you fill in; components without
 * variables come from the approved template. `addHeader`, `addBody`,
 * `addLimitedTimeOffer` and `addCarousel` replace an earlier call; buttons are
 * kept per index. Components are serialised in the order header, body,
 * limited-time offer, carousel, buttons.
 *
 * @example
 * ```ts
 * const message = new TemplateMessage({ name: "order_update", language: LanguageEnum.EnglishUS })
 *   .addHeader(TemplateParameter.image({ link: "https://example.com/parcel.png" }))
 *   .addBody([
 *     TemplateParameter.text("Jane", { name: "first_name" }),
 *     TemplateParameter.text("#42", { name: "order_id" }),
 *   ])
 *   .addButton(TemplateButton.url({ index: 0, text: "orders/42" }))
 *   .addButton(TemplateButton.quickReply({ index: 1, payload: "stop" }));
 *
 * // Authentication template: code in the body and on the copy-code button.
 * new TemplateMessage({ name: "login_code", language: "en_US" }).addOtp("123456");
 * ```
 */
export class TemplateMessage extends BaseMessage<MessageTypeEnum.Template> {
	readonly data: Readonly<TemplateMessageOptions>
	private header?: TemplateHeaderComponentPayload
	private body?: TemplateBodyComponentPayload
	private limitedTimeOffer?: TemplateLimitedTimeOfferComponentPayload
	private carousel?: TemplateCarouselComponentPayload
	private readonly buttons = new Map<number, TemplateButtonComponentPayload>()

	constructor(data: TemplateMessageOptions) {
		super(MessageTypeEnum.Template)
		assertText(data.name, 'name', 512)
		assertText(data.language, 'language')
		this.data = { ...data }
		for (const component of data.components ?? []) this.addComponent(component)
	}

	/** Sets the header parameter (text, image, video, document, location or product). */
	addHeader(parameter: TemplateParameterPayload): this {
		const component: TemplateHeaderComponentPayload = {
			type: 'header',
			parameters: [parameter]
		}
		validateHeader(component, 'header')
		this.header = component
		return this
	}

	/** Sets the body parameters, in order (positional) or by `parameter_name` (named). */
	addBody(parameters: TemplateParameterPayload[]): this {
		const component: TemplateBodyComponentPayload = {
			type: 'body',
			parameters: [...parameters]
		}
		validateBody(component, 'body')
		this.body = component
		return this
	}

	/**
	 * Adds a button component built with {@link TemplateButton}. A template has
	 * at most 10 buttons, and each `index` may be used once.
	 */
	addButton(button: TemplateButtonComponentPayload): this {
		validateButton(button, 'button')
		assert(
			!this.buttons.has(button.index),
			`A button with index ${button.index} was already added`
		)
		this.buttons.set(button.index, button)
		return this
	}

	/** Sets the expiry of a limited-time offer template (Unix time in milliseconds). */
	addLimitedTimeOffer(options: { expirationTimeMs: number }): this {
		assert(
			Number.isInteger(options.expirationTimeMs) && options.expirationTimeMs > 0,
			'`expirationTimeMs` must be a positive integer (Unix time in milliseconds)'
		)
		this.limitedTimeOffer = {
			type: 'limited_time_offer',
			parameters: [
				{
					type: 'limited_time_offer',
					limited_time_offer: { expiration_time_ms: options.expirationTimeMs }
				}
			]
		}
		return this
	}

	/** Sets the cards of a media or product card carousel template (up to 10). */
	addCarousel(cards: TemplateCarouselCard[]): this {
		assertCount(cards, 'carousel cards', 1, MessageLimits.carouselCards)
		const component: TemplateCarouselComponentPayload = {
			type: 'carousel',
			cards: cards.map((card, cardIndex) => {
				const components: TemplateCarouselCardPayload['components'] = [
					{ type: 'header', parameters: [card.header] }
				]
				if (card.body !== undefined) {
					components.push({ type: 'body', parameters: [...card.body] })
				}
				components.push(...(card.buttons ?? []))
				return { card_index: cardIndex, components }
			})
		}
		this.setCarousel(component)
		return this
	}

	/**
	 * Fills an authentication template: sets the code as the body parameter
	 * and on the one-time password button (index 0).
	 */
	addOtp(code: string): this {
		const button = TemplateButton.otp({ code })
		this.buttons.delete(button.index)
		return this.addBody([TemplateParameter.text(code)]).addButton(button)
	}

	/** Adds a raw Cloud API component (validated like the typed helpers). */
	addComponent(component: TemplateComponentPayload): this {
		switch (component.type) {
			case 'header':
				validateHeader(component, 'header')
				this.header = { ...component, parameters: [...component.parameters] }
				return this
			case 'body':
				validateBody(component, 'body')
				this.body = { ...component, parameters: [...component.parameters] }
				return this
			case 'button':
				return this.addButton(component)
			case 'limited_time_offer': {
				assertCount(component.parameters, 'limited_time_offer.parameters', 1, 1)
				const [parameter] = component.parameters
				return this.addLimitedTimeOffer({
					expirationTimeMs: parameter.limited_time_offer.expiration_time_ms
				})
			}
			case 'carousel':
				this.setCarousel(component)
				return this
			default: {
				const unknown: never = component
				const type = (unknown as { type?: unknown }).type
				throw new ValidationError(`Unsupported template component type: ${String(type)}`)
			}
		}
	}

	/** The components that will be sent, in serialisation order. */
	get components(): TemplateComponentPayload[] {
		const components: TemplateComponentPayload[] = []
		if (this.header) components.push(this.header)
		if (this.body) components.push(this.body)
		if (this.limitedTimeOffer) components.push(this.limitedTimeOffer)
		if (this.carousel) components.push(this.carousel)
		components.push(...[...this.buttons.values()].sort((a, b) => a.index - b.index))
		return components
	}

	protected content(): { template: TemplateMessagePayload } {
		const components = this.components
		return {
			template: compact({
				name: this.data.name,
				language: { policy: 'deterministic' as const, code: this.data.language },
				components: components.length ? components : undefined
			})
		}
	}

	private setCarousel(component: TemplateCarouselComponentPayload): void {
		assertCount(component.cards, 'carousel.cards', 1, MessageLimits.carouselCards)
		const cardIndexes = new Set<number>()
		component.cards.forEach((card, position) => {
			const field = `carousel.cards[${position}]`
			assert(
				Number.isInteger(card.card_index) && !cardIndexes.has(card.card_index),
				`\`${field}.card_index\` must be a unique integer`
			)
			cardIndexes.add(card.card_index)
			const buttons: TemplateButtonComponentPayload[] = []
			let headers = 0
			card.components.forEach((child, index) => {
				const childField = `${field}.components[${index}]`
				if (child.type === 'header') {
					headers += 1
					validateHeader(child, childField)
				} else if (child.type === 'body') {
					validateBody(child, childField)
				} else {
					validateButton(child, childField)
					buttons.push(child)
				}
			})
			assert(headers === 1, `\`${field}\` needs exactly one header`)
			assert(
				buttons.length <= CAROUSEL_CARD_BUTTONS,
				`\`${field}\` allows at most ${CAROUSEL_CARD_BUTTONS} buttons`
			)
			assertUniqueIndexes(buttons, `${field}.components`)
		})
		this.carousel = {
			type: 'carousel',
			cards: component.cards.map(card => ({ ...card, components: [...card.components] }))
		}
	}
}
