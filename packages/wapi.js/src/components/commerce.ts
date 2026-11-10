import { assert, compact } from './base'
import {
	InteractiveMessage,
	InteractiveMessageTypeEnum,
	toBodyPayload,
	toFooterPayload,
	toTextHeaderPayload
} from './interactive'
import { MessageLimits, assertCount, assertOptionalText, assertText } from './validation'

/** A titled group of catalog products. */
export interface ProductSection {
	/** Up to 24 characters. */
	title: string
	/** Retailer ids (SKUs) of products in the catalog. */
	productRetailerIds: string[]
}

/** Cloud API product section object. */
export interface ProductSectionPayload {
	title: string
	product_items: { product_retailer_id: string }[]
}

/**
 * @internal Validates product sections (product list messages and
 * multi-product template buttons share the same rules).
 */
export function toProductSectionsPayload(
	sections: ProductSection[],
	field = 'sections'
): ProductSectionPayload[] {
	assertCount(sections, field, 1, MessageLimits.productSections)
	let total = 0
	sections.forEach((section, index) => {
		assertText(section.title, `${field}[${index}].title`, MessageLimits.productSectionTitle)
		assertCount(section.productRetailerIds, `${field}[${index}].productRetailerIds`, 1)
		section.productRetailerIds.forEach((id, idIndex) =>
			assertText(id, `${field}[${index}].productRetailerIds[${idIndex}]`)
		)
		total += section.productRetailerIds.length
	})
	assert(
		total <= MessageLimits.productItems,
		`At most ${MessageLimits.productItems} products are allowed across all sections, got ${total}`
	)
	return sections.map(section => ({
		title: section.title,
		product_items: section.productRetailerIds.map(id => ({ product_retailer_id: id }))
	}))
}

/** Input of {@link ProductMessage}. */
export interface ProductMessageOptions {
	/** Id of the catalog connected to the WhatsApp Business Account. */
	catalogId: string
	/** Retailer id (SKU) of the product. */
	productRetailerId: string
	/** Up to 1024 characters. */
	bodyText?: string
	/** Up to 60 characters. */
	footerText?: string
}

/**
 * Single product message (SPM): shows one product from your catalog. Single
 * product messages don't support a header.
 *
 * @example
 * ```ts
 * new ProductMessage({ catalogId: "123", productRetailerId: "sku-1", bodyText: "Back in stock!" });
 * ```
 */
export class ProductMessage extends InteractiveMessage<InteractiveMessageTypeEnum.Product> {
	readonly data: Readonly<ProductMessageOptions>

	constructor(data: ProductMessageOptions) {
		super(InteractiveMessageTypeEnum.Product)
		assertText(data.catalogId, 'catalogId')
		assertText(data.productRetailerId, 'productRetailerId')
		assertOptionalText(data.bodyText, 'bodyText', MessageLimits.interactiveBody)
		toFooterPayload(data.footerText)
		this.data = { ...data }
	}

	protected interactive(): Record<string, unknown> {
		const { data } = this
		return {
			body: data.bodyText === undefined ? undefined : toBodyPayload(data.bodyText),
			footer: toFooterPayload(data.footerText),
			action: {
				catalog_id: data.catalogId,
				product_retailer_id: data.productRetailerId
			}
		}
	}
}

/** Input of {@link ProductListMessage}. */
export interface ProductListMessageOptions {
	/** Id of the catalog connected to the WhatsApp Business Account. */
	catalogId: string
	/** Text header, up to 60 characters. Required for product lists. */
	header: string
	/** Up to 1024 characters. */
	bodyText: string
	/** Up to 60 characters. */
	footerText?: string
	/** One to ten sections with at most 30 products in total. */
	sections: ProductSection[]
}

/**
 * Multi product message (MPM): shows up to 30 catalog products in sections.
 *
 * @example
 * ```ts
 * new ProductListMessage({
 *   catalogId: "123",
 *   header: "Summer sale",
 *   bodyText: "Pick your favourites",
 *   sections: [{ title: "Shoes", productRetailerIds: ["sku-1", "sku-2"] }],
 * });
 * ```
 */
export class ProductListMessage extends InteractiveMessage<InteractiveMessageTypeEnum.ProductList> {
	readonly data: Readonly<ProductListMessageOptions>

	constructor(data: ProductListMessageOptions) {
		super(InteractiveMessageTypeEnum.ProductList)
		assertText(data.catalogId, 'catalogId')
		toTextHeaderPayload(data.header, 'header')
		toBodyPayload(data.bodyText)
		toFooterPayload(data.footerText)
		toProductSectionsPayload(data.sections)
		this.data = {
			...data,
			sections: data.sections.map(section => ({
				...section,
				productRetailerIds: [...section.productRetailerIds]
			}))
		}
	}

	protected interactive(): Record<string, unknown> {
		const { data } = this
		return {
			header: toTextHeaderPayload(data.header, 'header'),
			body: toBodyPayload(data.bodyText),
			footer: toFooterPayload(data.footerText),
			action: {
				catalog_id: data.catalogId,
				sections: toProductSectionsPayload(data.sections)
			}
		}
	}
}

/** Input of {@link CatalogMessage}. */
export interface CatalogMessageOptions {
	/** Up to 1024 characters. */
	bodyText: string
	/** Up to 60 characters. */
	footerText?: string
	/**
	 * Product whose image is used as the message thumbnail. Defaults to the
	 * first product in the catalog.
	 */
	thumbnailProductRetailerId?: string
}

/**
 * Catalog message: a "View catalog" button that opens your full catalog.
 *
 * @example
 * ```ts
 * new CatalogMessage({ bodyText: "Browse our catalog", thumbnailProductRetailerId: "sku-1" });
 * ```
 */
export class CatalogMessage extends InteractiveMessage<InteractiveMessageTypeEnum.Catalog> {
	readonly data: Readonly<CatalogMessageOptions>

	constructor(data: CatalogMessageOptions) {
		super(InteractiveMessageTypeEnum.Catalog)
		toBodyPayload(data.bodyText)
		toFooterPayload(data.footerText)
		assertOptionalText(data.thumbnailProductRetailerId, 'thumbnailProductRetailerId')
		this.data = { ...data }
	}

	protected interactive(): Record<string, unknown> {
		const { data } = this
		return {
			body: toBodyPayload(data.bodyText),
			footer: toFooterPayload(data.footerText),
			action: compact({
				name: 'catalog_message',
				parameters:
					data.thumbnailProductRetailerId === undefined
						? undefined
						: { thumbnail_product_retailer_id: data.thumbnailProductRetailerId }
			})
		}
	}
}
