import { describe, expect, it } from 'vitest'
import {
	LanguageEnum,
	TemplateButton,
	TemplateMessage,
	TemplateParameter
} from '../../src/components'
import { ValidationError } from '../../src/errors'

const to = '15550001111'
const envelope = {
	messaging_product: 'whatsapp',
	recipient_type: 'individual',
	to,
	type: 'template'
}

describe('TemplateMessage', () => {
	it('serialises a template without components', () => {
		expect(
			new TemplateMessage({ name: 'hello_world', language: LanguageEnum.EnglishUS }).toJson({
				to
			})
		).toEqual({
			...envelope,
			template: { name: 'hello_world', language: { policy: 'deterministic', code: 'en_US' } }
		})
	})

	it('exposes its input as data', () => {
		const message = new TemplateMessage({ name: 'hello_world', language: 'en' })
		expect(message.data).toEqual({ name: 'hello_world', language: 'en' })
		expect(message.type).toBe('template')
	})

	it('serialises header, body and buttons in canonical order', () => {
		const message = new TemplateMessage({ name: 'order_update', language: 'en_US' })
			.addButton(TemplateButton.quickReply({ index: 1, payload: 'stop' }))
			.addBody([
				TemplateParameter.text('Jane'),
				TemplateParameter.currency({
					fallbackValue: '$10.99',
					code: 'USD',
					amount1000: 10990
				}),
				TemplateParameter.dateTime({ fallbackValue: 'May 1, 2026' })
			])
			.addHeader(
				TemplateParameter.document({ link: 'https://x/inv.pdf', filename: 'inv.pdf' })
			)
			.addButton(TemplateButton.url({ index: 0, text: 'orders/42' }))

		expect(message.toJson({ to })).toEqual({
			...envelope,
			template: {
				name: 'order_update',
				language: { policy: 'deterministic', code: 'en_US' },
				components: [
					{
						type: 'header',
						parameters: [
							{
								type: 'document',
								document: { link: 'https://x/inv.pdf', filename: 'inv.pdf' }
							}
						]
					},
					{
						type: 'body',
						parameters: [
							{ type: 'text', text: 'Jane' },
							{
								type: 'currency',
								currency: {
									fallback_value: '$10.99',
									code: 'USD',
									amount_1000: 10990
								}
							},
							{ type: 'date_time', date_time: { fallback_value: 'May 1, 2026' } }
						]
					},
					{
						type: 'button',
						sub_type: 'url',
						index: 0,
						parameters: [{ type: 'text', text: 'orders/42' }]
					},
					{
						type: 'button',
						sub_type: 'quick_reply',
						index: 1,
						parameters: [{ type: 'payload', payload: 'stop' }]
					}
				]
			}
		})
	})

	it('serialises named parameters', () => {
		const payload = new TemplateMessage({ name: 'welcome', language: 'en' })
			.addHeader(TemplateParameter.text('Hi', { name: 'greeting' }))
			.addBody([
				TemplateParameter.text('Jane', { name: 'first_name' }),
				TemplateParameter.text('#42', { name: 'order_id' })
			])
			.toJson({ to })
		expect(payload.template).toEqual({
			name: 'welcome',
			language: { policy: 'deterministic', code: 'en' },
			components: [
				{
					type: 'header',
					parameters: [{ type: 'text', text: 'Hi', parameter_name: 'greeting' }]
				},
				{
					type: 'body',
					parameters: [
						{ type: 'text', text: 'Jane', parameter_name: 'first_name' },
						{ type: 'text', text: '#42', parameter_name: 'order_id' }
					]
				}
			]
		})
	})

	it('rejects mixing named and positional body parameters', () => {
		expect(() =>
			new TemplateMessage({ name: 't', language: 'en' }).addBody([
				TemplateParameter.text('a', { name: 'a' }),
				TemplateParameter.text('b')
			])
		).toThrow(ValidationError)
	})

	it('serialises image, video, location and product headers', () => {
		const header = (message: TemplateMessage) =>
			(message.toJson({ to }).template as { components: unknown[] }).components[0]
		const base = () => new TemplateMessage({ name: 't', language: 'en' })

		expect(header(base().addHeader(TemplateParameter.image({ id: 'img-1' })))).toEqual({
			type: 'header',
			parameters: [{ type: 'image', image: { id: 'img-1' } }]
		})
		expect(
			header(base().addHeader(TemplateParameter.video({ link: 'https://x/v.mp4' })))
		).toEqual({
			type: 'header',
			parameters: [{ type: 'video', video: { link: 'https://x/v.mp4' } }]
		})
		expect(
			header(
				base().addHeader(
					TemplateParameter.location({
						latitude: 37.48,
						longitude: -122.14,
						name: 'Meta HQ',
						address: '1 Hacker Way'
					})
				)
			)
		).toEqual({
			type: 'header',
			parameters: [
				{
					type: 'location',
					location: {
						latitude: '37.48',
						longitude: '-122.14',
						name: 'Meta HQ',
						address: '1 Hacker Way'
					}
				}
			]
		})
		expect(
			header(
				base().addHeader(
					TemplateParameter.product({ catalogId: 'cat-1', productRetailerId: 'sku-1' })
				)
			)
		).toEqual({
			type: 'header',
			parameters: [
				{ type: 'product', product: { product_retailer_id: 'sku-1', catalog_id: 'cat-1' } }
			]
		})
	})

	it('serialises a copy code (coupon) button and a limited-time offer', () => {
		const payload = new TemplateMessage({ name: 'lto', language: 'en_US' })
			.addHeader(TemplateParameter.image({ link: 'https://x/sale.png' }))
			.addBody([TemplateParameter.text('Jane')])
			.addLimitedTimeOffer({ expirationTimeMs: 1767225600000 })
			.addButton(TemplateButton.copyCode({ index: 0, couponCode: 'SAVE20' }))
			.addButton(TemplateButton.url({ index: 1, text: 'sale' }))
			.toJson({ to })

		expect(payload.template).toEqual({
			name: 'lto',
			language: { policy: 'deterministic', code: 'en_US' },
			components: [
				{
					type: 'header',
					parameters: [{ type: 'image', image: { link: 'https://x/sale.png' } }]
				},
				{ type: 'body', parameters: [{ type: 'text', text: 'Jane' }] },
				{
					type: 'limited_time_offer',
					parameters: [
						{
							type: 'limited_time_offer',
							limited_time_offer: { expiration_time_ms: 1767225600000 }
						}
					]
				},
				{
					type: 'button',
					sub_type: 'copy_code',
					index: 0,
					parameters: [{ type: 'coupon_code', coupon_code: 'SAVE20' }]
				},
				{
					type: 'button',
					sub_type: 'url',
					index: 1,
					parameters: [{ type: 'text', text: 'sale' }]
				}
			]
		})
	})

	it('fills an authentication (OTP) template', () => {
		const payload = new TemplateMessage({ name: 'login_code', language: 'en_US' })
			.addOtp('123456')
			.toJson({ to })
		expect(payload.template).toEqual({
			name: 'login_code',
			language: { policy: 'deterministic', code: 'en_US' },
			components: [
				{ type: 'body', parameters: [{ type: 'text', text: '123456' }] },
				{
					type: 'button',
					sub_type: 'url',
					index: 0,
					parameters: [{ type: 'text', text: '123456' }]
				}
			]
		})
	})

	it('serialises catalog, multi-product and flow buttons', () => {
		const components = (message: TemplateMessage) =>
			(message.toJson({ to }).template as { components: unknown[] }).components
		const base = () => new TemplateMessage({ name: 't', language: 'en' })

		expect(
			components(
				base().addButton(
					TemplateButton.catalog({ index: 0, thumbnailProductRetailerId: 'sku-1' })
				)
			)
		).toEqual([
			{
				type: 'button',
				sub_type: 'catalog',
				index: 0,
				parameters: [{ type: 'action', action: { thumbnail_product_retailer_id: 'sku-1' } }]
			}
		])

		expect(
			components(
				base().addButton(
					TemplateButton.multiProduct({
						index: 0,
						thumbnailProductRetailerId: 'sku-1',
						sections: [{ title: 'Shoes', productRetailerIds: ['sku-1', 'sku-2'] }]
					})
				)
			)
		).toEqual([
			{
				type: 'button',
				sub_type: 'mpm',
				index: 0,
				parameters: [
					{
						type: 'action',
						action: {
							thumbnail_product_retailer_id: 'sku-1',
							sections: [
								{
									title: 'Shoes',
									product_items: [
										{ product_retailer_id: 'sku-1' },
										{ product_retailer_id: 'sku-2' }
									]
								}
							]
						}
					}
				]
			}
		])

		expect(
			components(
				base().addButton(
					TemplateButton.flow({ index: 0, flowToken: 'tok', flowActionData: { step: 1 } })
				)
			)
		).toEqual([
			{
				type: 'button',
				sub_type: 'flow',
				index: 0,
				parameters: [
					{ type: 'action', action: { flow_token: 'tok', flow_action_data: { step: 1 } } }
				]
			}
		])
	})

	it('serialises a media card carousel', () => {
		const payload = new TemplateMessage({ name: 'carousel', language: 'en_US' })
			.addBody([TemplateParameter.text('Jane')])
			.addCarousel([
				{
					header: TemplateParameter.image({ link: 'https://x/1.png' }),
					body: [TemplateParameter.text('10%')],
					buttons: [
						TemplateButton.quickReply({ index: 0, payload: 'card-1' }),
						TemplateButton.url({ index: 1, text: 'p/1' })
					]
				},
				{ header: TemplateParameter.video({ id: 'vid-2' }) }
			])
			.toJson({ to })

		expect(payload.template).toEqual({
			name: 'carousel',
			language: { policy: 'deterministic', code: 'en_US' },
			components: [
				{ type: 'body', parameters: [{ type: 'text', text: 'Jane' }] },
				{
					type: 'carousel',
					cards: [
						{
							card_index: 0,
							components: [
								{
									type: 'header',
									parameters: [
										{ type: 'image', image: { link: 'https://x/1.png' } }
									]
								},
								{ type: 'body', parameters: [{ type: 'text', text: '10%' }] },
								{
									type: 'button',
									sub_type: 'quick_reply',
									index: 0,
									parameters: [{ type: 'payload', payload: 'card-1' }]
								},
								{
									type: 'button',
									sub_type: 'url',
									index: 1,
									parameters: [{ type: 'text', text: 'p/1' }]
								}
							]
						},
						{
							card_index: 1,
							components: [
								{
									type: 'header',
									parameters: [{ type: 'video', video: { id: 'vid-2' } }]
								}
							]
						}
					]
				}
			]
		})
	})

	it('accepts raw components in the constructor', () => {
		const message = new TemplateMessage({
			name: 'raw',
			language: 'en',
			components: [
				{ type: 'body', parameters: [{ type: 'text', text: 'x' }] },
				{
					type: 'button',
					sub_type: 'quick_reply',
					index: 0,
					parameters: [{ type: 'payload', payload: 'p' }]
				}
			]
		})
		expect(message.components).toEqual([
			{ type: 'body', parameters: [{ type: 'text', text: 'x' }] },
			{
				type: 'button',
				sub_type: 'quick_reply',
				index: 0,
				parameters: [{ type: 'payload', payload: 'p' }]
			}
		])
	})

	it('replaces header and body on repeated calls', () => {
		const message = new TemplateMessage({ name: 't', language: 'en' })
			.addBody([TemplateParameter.text('a')])
			.addBody([TemplateParameter.text('b')])
		expect(message.components).toEqual([
			{ type: 'body', parameters: [{ type: 'text', text: 'b' }] }
		])
	})

	it('validates templates', () => {
		const base = () => new TemplateMessage({ name: 't', language: 'en' })
		expect(() => new TemplateMessage({ name: '', language: 'en' })).toThrow(ValidationError)
		expect(() => base().addHeader(TemplateParameter.text('h'.repeat(61)))).toThrow(
			ValidationError
		)
		expect(() => base().addBody([])).toThrow(ValidationError)
		expect(() => base().addBody([TemplateParameter.image({ id: '1' })])).toThrow(
			ValidationError
		)
		expect(() =>
			base()
				.addButton(TemplateButton.url({ index: 0, text: 'a' }))
				.addButton(TemplateButton.url({ index: 0, text: 'b' }))
		).toThrow(ValidationError)
		expect(() => TemplateButton.url({ index: 10, text: 'a' })).toThrow(ValidationError)
		expect(() => TemplateButton.copyCode({ index: 0, couponCode: 'C'.repeat(16) })).toThrow(
			ValidationError
		)
		expect(() =>
			TemplateParameter.currency({ fallbackValue: '$1', code: 'USD', amount1000: 1.5 })
		).toThrow(ValidationError)
		expect(() =>
			base().addCarousel(
				Array.from({ length: 11 }, () => ({ header: TemplateParameter.image({ id: '1' }) }))
			)
		).toThrow(ValidationError)
		expect(() =>
			base().addCarousel([
				{
					header: TemplateParameter.image({ id: '1' }),
					buttons: [
						TemplateButton.url({ index: 0, text: 'a' }),
						TemplateButton.url({ index: 1, text: 'b' }),
						TemplateButton.url({ index: 2, text: 'c' })
					]
				}
			])
		).toThrow(ValidationError)
		expect(() => base().addLimitedTimeOffer({ expirationTimeMs: -1 })).toThrow(ValidationError)
	})
})
