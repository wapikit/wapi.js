import { ValidationError } from '../errors'
import type { RequestClient } from '../internal/request-client'
import type { RequestOptions } from './business'
import { collectAll, paginationQuery, type Paginated, type PaginationInput } from './pagination'

/** A `{ key, value }` pair, as used by several product fields. */
export interface KeyValue {
	key: string
	value: string
}

export interface ProductApplinks {
	web?: { should_fallback?: boolean; url?: string }
}

export interface ProductGroup {
	id: string
	retailer_id?: string
}

/** The feed a product was imported from. An object, not a string. */
export interface ProductFeed {
	id: string
	file_name?: string
	name?: string
}

/** A product diagnostic. An object, not a string. */
export interface ProductError {
	error_type?: string
	error_priority?: string
	title?: string
	description?: string
}

/** A catalog product item. */
export interface Product {
	id: string
	additional_image_cdn_urls?: KeyValue[][]
	additional_image_urls?: string[]
	additional_variant_attributes?: KeyValue[]
	age_group?: string
	applinks?: ProductApplinks
	availability?: string
	brand?: string
	capability_to_review_status?: KeyValue[]
	category?: string
	category_specific_fields?: Record<string, unknown>
	color?: string
	commerce_insights?: string
	condition?: string
	currency?: string
	custom_data?: KeyValue[]
	custom_label_0?: string
	custom_label_1?: string
	custom_label_2?: string
	custom_label_3?: string
	custom_label_4?: string
	custom_number_0?: string
	custom_number_1?: string
	custom_number_2?: string
	custom_number_3?: string
	custom_number_4?: string
	description?: string
	errors?: ProductError[]
	expiration_date?: string
	fb_product_category?: string
	gender?: string
	gtin?: string
	image_cdn_urls?: KeyValue[]
	image_fetch_status?: string
	image_url?: string
	images?: string[]
	importer_address?: string
	importer_name?: string
	invalidation_errors?: string[]
	inventory?: number
	manufacturer_info?: string
	manufacturer_part_number?: string
	marked_for_product_launch?: string
	material?: string
	mobile_link?: string
	name?: string
	ordering_index?: number
	origin_country?: string
	parent_product_id?: string
	pattern?: string
	post_conversion_signal_based_enforcement_appeal_eligibility?: boolean
	/** Formatted price, for example `"$10.00"`. */
	price?: string
	product_feed?: ProductFeed
	product_group?: ProductGroup
	product_local_info?: string
	product_type?: string
	quantity_to_sell_on_facebook?: number
	retailer_id?: string
	retailer_product_group_id?: string
	review_rejection_reasons?: string[]
	review_status?: string
	sale_price?: string
	sale_price_end_date?: string
	sale_price_start_date?: string
	shipping_weight_unit?: string
	shipping_weight_value?: number
	short_description?: string
	size?: string
	start_date?: string
	tags?: string[]
	url?: string
	vendor_id?: string
	video_fetch_status?: string
	visibility?: string
	wa_compliance_category?: string
}

export interface ProductSet {
	id: string
	name: string
	auto_creation_url?: string
	filter?: string
	latest_metadata?: { update_time?: string }
	live_metadata?: { update_time?: string }
	product_count?: number
	retailer_id?: string
}

/** A product catalog connected to the WABA. */
export interface Catalog {
	id: string
	name: string
	product_count?: number
	vertical?: string
	data_sources?: Paginated<Record<string, unknown>>
	product_groups?: Paginated<ProductGroup>
	product_sets?: Paginated<ProductSet>
	/** First page of products, with Graph's default product fields. */
	products?: Paginated<Product>
}

/** Fields requested for catalogs (same list as wapi.go). */
export const CATALOG_FIELDS = [
	'id',
	'name',
	'vertical',
	'product_count',
	'data_sources',
	'product_groups',
	'product_sets',
	'products'
] as const

/**
 * Fields requested for products (same list as wapi.go, without the internal
 * commerce settings fields that require extra permissions).
 */
export const PRODUCT_FIELDS = [
	'id',
	'price',
	'additional_image_cdn_urls',
	'additional_image_urls',
	'condition',
	'additional_variant_attributes',
	'age_group',
	'availability',
	'brand',
	'category',
	'category_specific_fields',
	'color',
	'currency',
	'custom_data',
	'custom_label_0',
	'custom_label_1',
	'custom_label_2',
	'custom_label_3',
	'custom_label_4',
	'custom_number_0',
	'custom_number_1',
	'custom_number_2',
	'custom_number_3',
	'custom_number_4',
	'description',
	'errors',
	'expiration_date',
	'fb_product_category',
	'gender',
	'gtin',
	'image_cdn_urls',
	'image_fetch_status',
	'image_url',
	'images',
	'inventory',
	'material',
	'name',
	'ordering_index',
	'origin_country',
	'parent_product_id',
	'pattern',
	'product_local_info',
	'product_type',
	'quantity_to_sell_on_facebook',
	'retailer_id',
	'retailer_product_group_id',
	'sale_price',
	'sale_price_end_date',
	'sale_price_start_date',
	'short_description',
	'size',
	'start_date',
	'tags',
	'url',
	'vendor_id',
	'visibility',
	'wa_compliance_category'
] as const

export interface CatalogPageParams extends PaginationInput, RequestOptions {}

export interface ListAllCatalogItemsParams extends RequestOptions {
	/** Page size. */
	limit?: number
	/** Stop after this many items. */
	maxItems?: number
}

/** Page of products; `summary.total_count` is the catalog's product count. */
export interface ProductPage extends Paginated<Product> {
	summary?: { total_count?: number }
}

const LIST_DEFAULT_LIMIT = 100
/** Page size of {@link CatalogManager.listAll} (wapi.go's catalog fetch-all limit). */
const LIST_ALL_CATALOGS_LIMIT = 1000

/** Product catalogs connected to a WhatsApp Business Account, and their products. */
export class CatalogManager {
	constructor(
		private readonly requester: RequestClient,
		readonly businessAccountId: string
	) {}

	/** Lists one page of catalogs (default 100). `GET /{waba-id}/product_catalogs`. */
	async list(params?: CatalogPageParams): Promise<Paginated<Catalog>> {
		return this.requester.request<Paginated<Catalog>>({
			method: 'GET',
			path: `${this.businessAccountId}/product_catalogs`,
			fields: [...CATALOG_FIELDS],
			query: paginationQuery(params, LIST_DEFAULT_LIMIT),
			signal: params?.signal
		})
	}

	/** Lists every catalog (1000 per page by default). `GET /{waba-id}/product_catalogs`. */
	async listAll(params?: ListAllCatalogItemsParams): Promise<Catalog[]> {
		return collectAll(page => this.list({ ...page, signal: params?.signal }), {
			limit: params?.limit ?? LIST_ALL_CATALOGS_LIMIT,
			maxItems: params?.maxItems
		})
	}

	/** Lists one page of a catalog's products (default 100). `GET /{catalog-id}/products`. */
	async listProducts(catalogId: string, params?: CatalogPageParams): Promise<ProductPage> {
		requireId(catalogId, 'catalogId')
		return this.requester.request<ProductPage>({
			method: 'GET',
			path: `${catalogId}/products`,
			fields: [...PRODUCT_FIELDS],
			query: paginationQuery(params, LIST_DEFAULT_LIMIT),
			signal: params?.signal
		})
	}

	/** Lists every product of a catalog (100 per page by default). `GET /{catalog-id}/products`. */
	async listAllProducts(
		catalogId: string,
		params?: ListAllCatalogItemsParams
	): Promise<Product[]> {
		requireId(catalogId, 'catalogId')
		return collectAll(
			page => this.listProducts(catalogId, { ...page, signal: params?.signal }),
			{ limit: params?.limit ?? LIST_DEFAULT_LIMIT, maxItems: params?.maxItems }
		)
	}

	/** Fetches one product item. `GET /{product-id}`. */
	async getProduct(productId: string, options?: RequestOptions): Promise<Product> {
		requireId(productId, 'productId')
		return this.requester.request<Product>({
			method: 'GET',
			path: productId,
			fields: [...PRODUCT_FIELDS],
			signal: options?.signal
		})
	}
}

function requireId(value: string, name: string): void {
	if (!value) throw new ValidationError(`\`${name}\` is required`)
}
