import { describe, expect, it } from 'vitest'
import { GraphApiError, RequestError } from '../../src/errors'
import { RequestClient, renderFields } from '../../src/internal/request-client'
import { createFakeFetch } from '../helpers'

describe('RequestClient', () => {
	it('builds versioned URLs with sorted query and rendered fields', () => {
		const client = new RequestClient({ accessToken: 'token', fetch: createFakeFetch().fetch })
		const url = client.buildUrl('123/phone_numbers', { b: 2, a: 'x y', skip: undefined }, [
			'id',
			{ name: 'analytics', modifiers: { start: 1, end: 2 } }
		])
		expect(url).toBe(
			'https://graph.facebook.com/v20.0/123/phone_numbers?fields=id%2Canalytics.end%282%29.start%281%29&a=x+y&b=2'
		)
	})

	it('honours apiVersion and baseUrl overrides', () => {
		const client = new RequestClient({
			accessToken: 'token',
			apiVersion: 'v23.0',
			baseUrl: 'http://localhost:9999/',
			fetch: createFakeFetch().fetch
		})
		expect(client.buildUrl('/me')).toBe('http://localhost:9999/v23.0/me')
	})

	it('sends JSON with a bearer token and parses the response', async () => {
		const fake = createFakeFetch([{ id: '1' }])
		const client = new RequestClient({ accessToken: 'secret', fetch: fake.fetch })
		const result = await client.request<{ id: string }>({
			method: 'POST',
			path: '1/messages',
			body: { a: 1 }
		})
		expect(result).toEqual({ id: '1' })
		expect(fake.requests[0]).toMatchObject({
			method: 'POST',
			headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
			body: { a: 1 }
		})
	})

	it('throws a typed GraphApiError for non-2xx responses', async () => {
		const fake = createFakeFetch([
			{
				status: 400,
				body: {
					error: {
						message: '(#131030) Recipient phone number not in allowed list',
						type: 'OAuthException',
						code: 131030,
						error_data: {
							messaging_product: 'whatsapp',
							details: 'Recipient not allowed'
						},
						fbtrace_id: 'Az8or2yhqkZfEZ-_4Qn_Bam'
					}
				}
			}
		])
		const client = new RequestClient({ accessToken: 't', fetch: fake.fetch })
		const error = await client.request({ method: 'GET', path: 'x' }).catch((e: unknown) => e)
		expect(error).toBeInstanceOf(GraphApiError)
		const apiError = error as GraphApiError
		expect(apiError.status).toBe(400)
		expect(apiError.code).toBe(131030)
		expect(apiError.details).toBe('Recipient not allowed')
		expect(apiError.fbtraceId).toBe('Az8or2yhqkZfEZ-_4Qn_Bam')
		expect(apiError.isRetryable).toBe(false)
	})

	it('marks rate limits and 5xx as retryable and keeps non-JSON bodies', async () => {
		const fake = createFakeFetch([
			{ status: 502, body: '<html>Bad gateway</html>' },
			{ status: 400, body: { error: { message: 'throttled', code: 131056 } } }
		])
		const client = new RequestClient({ accessToken: 't', fetch: fake.fetch })
		const gateway = (await client
			.request({ method: 'GET', path: 'x' })
			.catch((e: unknown) => e)) as GraphApiError
		expect(gateway.isRetryable).toBe(true)
		expect(gateway.body).toContain('Bad gateway')
		const throttled = (await client
			.request({ method: 'GET', path: 'x' })
			.catch((e: unknown) => e)) as GraphApiError
		expect(throttled.isRetryable).toBe(true)
	})

	it('treats a 200 with an error envelope as an error', async () => {
		const fake = createFakeFetch([{ error: { message: 'nope', code: 100 } }])
		const client = new RequestClient({ accessToken: 't', fetch: fake.fetch })
		await expect(client.request({ method: 'GET', path: 'x' })).rejects.toBeInstanceOf(
			GraphApiError
		)
	})

	it('times out with a RequestError', async () => {
		const hanging = (_url: string, init: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
			})
		const client = new RequestClient({ accessToken: 't', fetch: hanging, timeoutMs: 20 })
		const error = (await client
			.request({ method: 'GET', path: 'x' })
			.catch((e: unknown) => e)) as RequestError
		expect(error).toBeInstanceOf(RequestError)
		expect(error.timedOut).toBe(true)
	})

	it('rotates the access token', async () => {
		const fake = createFakeFetch([{}, {}])
		const client = new RequestClient({ accessToken: 'old', fetch: fake.fetch })
		client.setAccessToken('new')
		await client.request({ method: 'GET', path: 'x' })
		expect(fake.requests[0]?.headers.authorization).toBe('Bearer new')
	})

	it('renders fields like wapi.go', () => {
		expect(renderFields(['a', { name: 'b', modifiers: { z: 1, a: 'x' } }])).toBe(
			'a,b.a(x).z(1)'
		)
	})
})
