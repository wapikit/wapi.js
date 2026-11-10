import { request as httpRequest } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '../../src/client/client'
import { ValidationError } from '../../src/errors'
import {
	type ContactMessageEvent,
	type ImageMessageEvent,
	type TextMessageEvent
} from '../../src/events'
import { silentLogger } from '../../src/internal/logger'
import { createFakeFetch, inboundMessage, sign } from '../helpers'

const APP_SECRET = 'app-secret'

function createClient(options: { appSecret?: string; maxBodyBytes?: number } = {}) {
	return new Client({
		accessToken: 'token',
		fetch: createFakeFetch().fetch,
		logger: silentLogger,
		webhook: {
			verifyToken: 'verify-me',
			appSecret: options.appSecret,
			maxBodyBytes: options.maxBodyBytes
		}
	})
}

async function post(client: Client, payload: unknown) {
	const response = await client.webhook.handle({
		method: 'POST',
		rawBody: JSON.stringify(payload)
	})
	await response.done
	return response
}

/** Sends a chunked POST (no Content-Length) of `size` bytes. */
function sendChunked(port: number, path: string, size: number) {
	return new Promise<number>(resolve => {
		const req = httpRequest(
			{
				host: '127.0.0.1',
				port,
				path,
				method: 'POST',
				headers: { 'transfer-encoding': 'chunked' }
			},
			res => {
				res.resume()
				resolve(res.statusCode ?? 0)
			}
		)
		// the server may cut the upload short after answering 413
		req.on('error', () => undefined)
		req.on('close', () => resolve(0))
		const chunk = 'x'.repeat(1024)
		for (let sent = 0; sent < size; sent += chunk.length) req.write(chunk)
		req.end()
	})
}

describe('inbound events that break sending limits', () => {
	it('still emits a text longer than 4096 characters', async () => {
		const client = createClient()
		const listener = vi.fn()
		client.on('TextMessage', listener)
		const body = 'a'.repeat(5000)
		await post(client, inboundMessage({ type: 'text', text: { body } }))
		expect(listener).toHaveBeenCalledOnce()
		const event = listener.mock.calls[0]?.[0] as TextMessageEvent
		expect(event.text).toBe(body)
		// the component is built on access, and only then is the limit enforced
		expect(() => event.message).toThrow(ValidationError)
	})

	it('still emits media with a long caption and contacts without a formatted name', async () => {
		const client = createClient()
		const image = vi.fn()
		const contacts = vi.fn()
		client.on('ImageMessage', image)
		client.on('ContactsMessage', contacts)
		await post(
			client,
			inboundMessage({ type: 'image', image: { id: 'img-1', caption: 'c'.repeat(2000) } })
		)
		await post(
			client,
			inboundMessage({ type: 'contacts', contacts: [{ name: { first_name: 'Jane' } }] })
		)
		expect((image.mock.calls[0]?.[0] as ImageMessageEvent).mediaId).toBe('img-1')
		expect((contacts.mock.calls[0]?.[0] as ContactMessageEvent).contacts).toHaveLength(1)
	})

	it('builds the component once and reuses it', async () => {
		const client = createClient()
		const listener = vi.fn()
		client.on('TextMessage', listener)
		await post(client, inboundMessage({ type: 'text', text: { body: 'hi' } }))
		const event = listener.mock.calls[0]?.[0] as TextMessageEvent
		expect(event.message).toBe(event.message)
		expect(event.message.data.text).toBe('hi')
	})
})

describe('signature header lookup', () => {
	it('finds X-Hub-Signature-256 in a plain object regardless of casing', async () => {
		const client = createClient({ appSecret: APP_SECRET })
		const body = JSON.stringify(inboundMessage({ type: 'text', text: { body: 'hi' } }))
		for (const name of ['X-Hub-Signature-256', 'x-hub-signature-256', 'X-HUB-SIGNATURE-256']) {
			const response = await client.webhook.handle({
				method: 'POST',
				headers: { [name]: sign(APP_SECRET, body) },
				rawBody: body
			})
			expect(response.status).toBe(200)
		}
	})
})

describe('body size limits', () => {
	let client: Client | undefined
	afterEach(async () => {
		await client?.close()
		client = undefined
	})

	it('answers 413 to a chunked upload over the limit on the built-in server', async () => {
		client = createClient({ maxBodyBytes: 4096 })
		const address = await client.webhook.listen({ port: 0, host: '127.0.0.1' })
		expect(await sendChunked(address.port, address.path, 64 * 1024)).toBe(413)
	})

	it('accepts a chunked upload under the limit', async () => {
		client = createClient({ maxBodyBytes: 64 * 1024 })
		const address = await client.webhook.listen({ port: 0, host: '127.0.0.1' })
		// not JSON, so 400, but it was read rather than rejected for its size
		expect(await sendChunked(address.port, address.path, 2048)).toBe(400)
	})

	it('answers 413 from fetchHandler for a streamed body over the limit', async () => {
		client = createClient({ maxBodyBytes: 1024 })
		const big = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let index = 0; index < 8; index += 1) controller.enqueue(new Uint8Array(512))
				controller.close()
			}
		})
		const response = await client.webhook.fetchHandler(
			new Request('https://bot.example.com/webhook', {
				method: 'POST',
				body: big,
				// @ts-expect-error -- `duplex` is required by Node for streamed bodies
				duplex: 'half'
			})
		)
		expect(response.status).toBe(413)
	})
})

describe('listen()', () => {
	it('shares one server between concurrent calls', async () => {
		const client = createClient()
		const ready = vi.fn()
		client.on('Ready', ready)
		const [first, second] = await Promise.all([
			client.webhook.listen({ port: 0, host: '127.0.0.1' }),
			client.webhook.listen({ port: 0, host: '127.0.0.1' })
		])
		expect(second.port).toBe(first.port)
		expect(ready).toHaveBeenCalledOnce()
		await client.close()
		expect(client.webhook.listening).toBe(false)
	})

	it('closes a server that is still starting', async () => {
		const client = createClient()
		const pending = client.webhook.listen({ port: 0, host: '127.0.0.1' })
		await client.close()
		await pending
		expect(client.webhook.listening).toBe(false)
	})
})
