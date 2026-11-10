import { describe, expect, it } from 'vitest'
import {
	ButtonInteractionMessage,
	CatalogMessage,
	ContactRequestMessage,
	CtaUrlMessage,
	ListInteractionMessage,
	type ListRow,
	LocationRequestMessage,
	ProductListMessage,
	ProductMessage
} from '../../src/components'
import { ValidationError } from '../../src/errors'

const to = '15550001111'
const envelope = {
	messaging_product: 'whatsapp',
	recipient_type: 'individual',
	to,
	type: 'interactive'
}

describe('ButtonInteractionMessage', () => {
	const buttons = [
		{ id: 'yes', title: 'Yes' },
		{ id: 'no', title: 'No' }
	]

	it('serialises body and buttons', () => {
		expect(
			new ButtonInteractionMessage({ bodyText: 'Arrived?', buttons }).toJson({ to })
		).toEqual({
			...envelope,
			interactive: {
				type: 'button',
				body: { text: 'Arrived?' },
				action: {
					buttons: [
						{ type: 'reply', reply: { id: 'yes', title: 'Yes' } },
						{ type: 'reply', reply: { id: 'no', title: 'No' } }
					]
				}
			}
		})
	})

	it('serialises a text header and footer', () => {
		const payload = new ButtonInteractionMessage({
			header: 'Order #42',
			bodyText: 'Arrived?',
			footerText: 'Thanks',
			buttons: [buttons[0]]
		}).toJson({ to })
		expect(payload.interactive).toEqual({
			type: 'button',
			header: { type: 'text', text: 'Order #42' },
			body: { text: 'Arrived?' },
			footer: { text: 'Thanks' },
			action: { buttons: [{ type: 'reply', reply: { id: 'yes', title: 'Yes' } }] }
		})
	})

	it('serialises a media header', () => {
		const payload = new ButtonInteractionMessage({
			header: { type: 'document', document: { link: 'https://x/y.pdf', filename: 'y.pdf' } },
			bodyText: 'Here',
			buttons
		}).toJson({ to })
		expect((payload.interactive as { header: unknown }).header).toEqual({
			type: 'document',
			document: { link: 'https://x/y.pdf', filename: 'y.pdf' }
		})
		const image = new ButtonInteractionMessage({
			header: { type: 'image', image: { id: 'img-1' } },
			bodyText: 'Here',
			buttons
		}).toJson({ to })
		expect((image.interactive as { header: unknown }).header).toEqual({
			type: 'image',
			image: { id: 'img-1' }
		})
	})

	it('validates buttons', () => {
		expect(() => new ButtonInteractionMessage({ bodyText: 'x', buttons: [] })).toThrow(
			ValidationError
		)
		expect(
			() =>
				new ButtonInteractionMessage({
					bodyText: 'x',
					buttons: [...buttons, { id: 'a', title: 'a' }, { id: 'b', title: 'b' }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ButtonInteractionMessage({
					bodyText: 'x',
					buttons: [{ id: 'a', title: 'a'.repeat(21) }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ButtonInteractionMessage({
					bodyText: 'x',
					buttons: [
						{ id: 'a', title: 'A' },
						{ id: 'a', title: 'B' }
					]
				})
		).toThrow(ValidationError)
		expect(() => new ButtonInteractionMessage({ bodyText: 'a'.repeat(1025), buttons })).toThrow(
			ValidationError
		)
		expect(
			() => new ButtonInteractionMessage({ bodyText: 'x', buttons, header: 'h'.repeat(61) })
		).toThrow(ValidationError)
		expect(
			() =>
				new ButtonInteractionMessage({ bodyText: 'x', buttons, footerText: 'f'.repeat(61) })
		).toThrow(ValidationError)
	})
})

describe('ListInteractionMessage', () => {
	it('serialises header, body, footer, button and sections', () => {
		const message = new ListInteractionMessage({
			header: 'Menu',
			bodyText: 'Pick one',
			footerText: 'Prices incl. VAT',
			buttonText: 'View',
			sections: [
				{ title: 'Pizza', rows: [{ id: 'margherita', title: 'Margherita' }] },
				{ title: 'Drinks', rows: [{ id: 'cola', title: 'Cola', description: '330ml' }] }
			]
		})
		expect(message.toJson({ to })).toEqual({
			...envelope,
			interactive: {
				type: 'list',
				header: { type: 'text', text: 'Menu' },
				body: { text: 'Pick one' },
				footer: { text: 'Prices incl. VAT' },
				action: {
					button: 'View',
					sections: [
						{ title: 'Pizza', rows: [{ id: 'margherita', title: 'Margherita' }] },
						{
							title: 'Drinks',
							rows: [{ id: 'cola', title: 'Cola', description: '330ml' }]
						}
					]
				}
			}
		})
	})

	it('allows a single untitled section', () => {
		const payload = new ListInteractionMessage({
			bodyText: 'Pick',
			buttonText: 'View',
			sections: [{ rows: [{ id: 'a', title: 'A' }] }]
		}).toJson({ to })
		expect(payload.interactive).toEqual({
			type: 'list',
			body: { text: 'Pick' },
			action: { button: 'View', sections: [{ rows: [{ id: 'a', title: 'A' }] }] }
		})
	})

	it('enforces WhatsApp list limits', () => {
		const rows = (count: number, prefix = 'r'): ListRow[] =>
			Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, title: `Row ${i}` }))
		const base = { bodyText: 'Pick', buttonText: 'View' }

		expect(() => new ListInteractionMessage({ ...base, sections: [] })).toThrow(ValidationError)
		expect(
			() => new ListInteractionMessage({ ...base, sections: [{ rows: rows(11) }] })
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [
						{ title: 'A', rows: rows(6, 'a') },
						{ title: 'B', rows: rows(5, 'b') }
					]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [{ rows: rows(1, 'a') }, { rows: rows(1, 'b') }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [
						{ title: 'A', rows: rows(1) },
						{ title: 'B', rows: rows(1) }
					]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [{ rows: [{ id: 'a', title: 't'.repeat(25) }] }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [{ rows: [{ id: 'a', title: 't', description: 'd'.repeat(73) }] }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					buttonText: 'b'.repeat(21),
					sections: [{ rows: rows(1) }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [{ title: 's'.repeat(25), rows: rows(1) }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ListInteractionMessage({
					...base,
					sections: [{ rows: rows(10) }]
				})
		).not.toThrow()
	})
})

describe('CtaUrlMessage', () => {
	it('serialises a CTA URL message', () => {
		expect(
			new CtaUrlMessage({
				header: { type: 'image', image: { link: 'https://example.com/p.png' } },
				bodyText: 'Track your parcel',
				footerText: 'Courier Co.',
				displayText: 'Track',
				url: 'https://example.com/track/42'
			}).toJson({ to })
		).toEqual({
			...envelope,
			interactive: {
				type: 'cta_url',
				header: { type: 'image', image: { link: 'https://example.com/p.png' } },
				body: { text: 'Track your parcel' },
				footer: { text: 'Courier Co.' },
				action: {
					name: 'cta_url',
					parameters: { display_text: 'Track', url: 'https://example.com/track/42' }
				}
			}
		})
	})

	it('omits header and footer when not set', () => {
		const payload = new CtaUrlMessage({
			bodyText: 'Go',
			displayText: 'Open',
			url: 'https://x'
		}).toJson({ to })
		expect(payload.interactive).toEqual({
			type: 'cta_url',
			body: { text: 'Go' },
			action: { name: 'cta_url', parameters: { display_text: 'Open', url: 'https://x' } }
		})
	})

	it('limits display text to 20 characters', () => {
		expect(
			() =>
				new CtaUrlMessage({ bodyText: 'Go', displayText: 'd'.repeat(21), url: 'https://x' })
		).toThrow(ValidationError)
	})
})

describe('LocationRequestMessage', () => {
	it('serialises a location request', () => {
		expect(new LocationRequestMessage({ bodyText: 'Where are you?' }).toJson({ to })).toEqual({
			...envelope,
			interactive: {
				type: 'location_request_message',
				body: { text: 'Where are you?' },
				action: { name: 'send_location' }
			}
		})
	})
})

describe('ContactRequestMessage', () => {
	it('serialises a contact request', () => {
		expect(new ContactRequestMessage({ bodyText: 'Share your number' }).toJson({ to })).toEqual(
			{
				...envelope,
				interactive: {
					type: 'contact_request',
					body: { text: 'Share your number' },
					action: { name: 'request_contact_info' }
				}
			}
		)
	})
})

describe('ProductMessage', () => {
	it('serialises a single product message with snake_case action keys', () => {
		expect(
			new ProductMessage({
				catalogId: 'cat-1',
				productRetailerId: 'sku-1',
				bodyText: 'Back in stock',
				footerText: 'Limited'
			}).toJson({ to })
		).toEqual({
			...envelope,
			interactive: {
				type: 'product',
				body: { text: 'Back in stock' },
				footer: { text: 'Limited' },
				action: { catalog_id: 'cat-1', product_retailer_id: 'sku-1' }
			}
		})
	})

	it('allows omitting the body', () => {
		const payload = new ProductMessage({
			catalogId: 'cat-1',
			productRetailerId: 'sku-1'
		}).toJson({ to })
		expect(payload.interactive).toEqual({
			type: 'product',
			action: { catalog_id: 'cat-1', product_retailer_id: 'sku-1' }
		})
	})
})

describe('ProductListMessage', () => {
	it('serialises a multi product message', () => {
		expect(
			new ProductListMessage({
				catalogId: 'cat-1',
				header: 'Summer sale',
				bodyText: 'Pick your favourites',
				footerText: 'While stocks last',
				sections: [
					{ title: 'Shoes', productRetailerIds: ['sku-1', 'sku-2'] },
					{ title: 'Hats', productRetailerIds: ['sku-3'] }
				]
			}).toJson({ to })
		).toEqual({
			...envelope,
			interactive: {
				type: 'product_list',
				header: { type: 'text', text: 'Summer sale' },
				body: { text: 'Pick your favourites' },
				footer: { text: 'While stocks last' },
				action: {
					catalog_id: 'cat-1',
					sections: [
						{
							title: 'Shoes',
							product_items: [
								{ product_retailer_id: 'sku-1' },
								{ product_retailer_id: 'sku-2' }
							]
						},
						{ title: 'Hats', product_items: [{ product_retailer_id: 'sku-3' }] }
					]
				}
			}
		})
	})

	it('limits products to 30 and sections to 10', () => {
		const ids = (count: number) => Array.from({ length: count }, (_, i) => `sku-${i}`)
		const base = { catalogId: 'c', header: 'h', bodyText: 'b' }
		expect(
			() =>
				new ProductListMessage({
					...base,
					sections: [{ title: 'A', productRetailerIds: ids(31) }]
				})
		).toThrow(ValidationError)
		expect(
			() =>
				new ProductListMessage({
					...base,
					sections: Array.from({ length: 11 }, (_, i) => ({
						title: `S${i}`,
						productRetailerIds: [`sku-${i}`]
					}))
				})
		).toThrow(ValidationError)
		expect(() => new ProductListMessage({ ...base, sections: [] })).toThrow(ValidationError)
	})
})

describe('CatalogMessage', () => {
	it('serialises a catalog message with a thumbnail', () => {
		expect(
			new CatalogMessage({
				bodyText: 'Browse our catalog',
				footerText: 'Free shipping',
				thumbnailProductRetailerId: 'sku-1'
			}).toJson({ to })
		).toEqual({
			...envelope,
			interactive: {
				type: 'catalog_message',
				body: { text: 'Browse our catalog' },
				footer: { text: 'Free shipping' },
				action: {
					name: 'catalog_message',
					parameters: { thumbnail_product_retailer_id: 'sku-1' }
				}
			}
		})
	})

	it('omits parameters without a thumbnail', () => {
		const payload = new CatalogMessage({ bodyText: 'Browse' }).toJson({ to })
		expect(payload.interactive).toEqual({
			type: 'catalog_message',
			body: { text: 'Browse' },
			action: { name: 'catalog_message' }
		})
	})
})
