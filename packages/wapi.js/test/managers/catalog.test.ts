import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/errors'
import { RequestClient } from '../../src/internal/request-client'
import {
	CATALOG_FIELDS,
	CatalogManager,
	PRODUCT_FIELDS,
	type Product
} from '../../src/managers/catalog'

interface RecordedCall {
	url: string
	method: string
}

function setup(responses: unknown[]) {
	const calls: RecordedCall[] = []
	const queue = [...responses]
	const fetch = async (input: string, init: RequestInit): Promise<Response> => {
		calls.push({ url: input, method: init.method ?? 'GET' })
		return new Response(JSON.stringify(queue.shift() ?? {}), { status: 200 })
	}
	const requester = new RequestClient({ accessToken: 't', fetch })
	return { calls, manager: new CatalogManager(requester, 'waba1') }
}

const BASE = 'https://graph.facebook.com/v20.0'

function params(call: RecordedCall | undefined): URLSearchParams {
	return new URL(call?.url ?? '').searchParams
}

function pathOf(call: RecordedCall | undefined): string {
	const url = new URL(call?.url ?? '')
	return url.origin + url.pathname
}

const product: Product = {
	id: 'prod1',
	name: 'Shoe',
	price: '$10.00',
	retailer_id: 'sku-1',
	product_feed: { id: 'feed1', file_name: 'feed.csv', name: 'Main feed' },
	errors: [
		{
			error_type: 'MISSING',
			error_priority: 'HIGH',
			title: 'Missing image',
			description: 'Add one'
		}
	]
}

describe('CatalogManager', () => {
	it("lists catalogs with wapi.go's fields and default limit", async () => {
		const { calls, manager } = setup([{ data: [{ id: 'c1', name: 'Main', product_count: 3 }] }])
		const page = await manager.list()
		expect(pathOf(calls[0])).toBe(`${BASE}/waba1/product_catalogs`)
		expect(params(calls[0]).get('fields')).toBe(
			'id,name,vertical,product_count,data_sources,product_groups,product_sets,products'
		)
		expect(params(calls[0]).get('limit')).toBe('100')
		expect(page.data[0]?.product_count).toBe(3)
		expect(CATALOG_FIELDS).toHaveLength(8)
	})

	it('listAll uses 1000 per page and follows cursors', async () => {
		const { calls, manager } = setup([
			{ data: [{ id: 'c1', name: 'A' }], paging: { cursors: { after: 'X' }, next: 'n' } },
			{ data: [{ id: 'c2', name: 'B' }] }
		])
		const all = await manager.listAll()
		expect(all.map(c => c.id)).toEqual(['c1', 'c2'])
		expect(params(calls[0]).get('limit')).toBe('1000')
		expect(params(calls[1]).get('after')).toBe('X')
	})

	it('lists products without commerce settings fields', async () => {
		const { calls, manager } = setup([{ data: [product], summary: { total_count: 1 } }])
		const page = await manager.listProducts('c1', { limit: 25, before: 'B' })
		expect(pathOf(calls[0])).toBe(`${BASE}/c1/products`)
		const q = params(calls[0])
		expect(q.get('fields')).toBe(PRODUCT_FIELDS.join(','))
		expect(q.get('fields')).not.toContain('applinks')
		expect(q.get('fields')).not.toContain('commerce_insights')
		expect(q.get('limit')).toBe('25')
		expect(q.get('before')).toBe('B')
		expect(page.summary?.total_count).toBe(1)
		expect(page.data[0]?.product_feed?.file_name).toBe('feed.csv')
		expect(page.data[0]?.errors?.[0]?.title).toBe('Missing image')
	})

	it('listAllProducts follows cursors', async () => {
		const { calls, manager } = setup([
			{ data: [product], paging: { cursors: { after: 'Y' }, next: 'n' } },
			{ data: [{ ...product, id: 'prod2' }] }
		])
		const all = await manager.listAllProducts('c1', { limit: 50 })
		expect(all.map(p => p.id)).toEqual(['prod1', 'prod2'])
		expect(params(calls[0]).get('limit')).toBe('50')
		expect(params(calls[1]).get('after')).toBe('Y')
	})

	it('gets one product', async () => {
		const { calls, manager } = setup([product])
		const result = await manager.getProduct('prod1')
		expect(pathOf(calls[0])).toBe(`${BASE}/prod1`)
		expect(params(calls[0]).get('fields')).toBe(PRODUCT_FIELDS.join(','))
		expect(result).toEqual(product)
	})

	it('requires ids', async () => {
		const { manager } = setup([])
		await expect(manager.listProducts('')).rejects.toBeInstanceOf(ValidationError)
		await expect(manager.getProduct('')).rejects.toBeInstanceOf(ValidationError)
	})
})
