import { request as httpRequest } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '../../src/client/client'
import { silentLogger } from '../../src/internal/logger'
import { isValidWebhookSignature, verifyWebhookSignature } from '../../src/webhook/signature'
import { InvalidWebhookSignatureError } from '../../src/errors'
import { createFakeFetch, inboundMessage, sign } from '../helpers'

const APP_SECRET = 'app-secret'

function createClient() {
	return new Client({
		accessToken: 'token',
		fetch: createFakeFetch().fetch,
		logger: silentLogger,
		webhook: { verifyToken: 'verify-me', appSecret: APP_SECRET }
	})
}

function send(options: {
	port: number
	path: string
	method: string
	body?: string
	headers?: Record<string, string>
}) {
	return new Promise<{ status: number; body: string }>((resolve, reject) => {
		const req = httpRequest(
			{
				host: '127.0.0.1',
				port: options.port,
				path: options.path,
				method: options.method,
				headers: options.headers
			},
			res => {
				let body = ''
				res.on('data', (chunk: Buffer) => (body += chunk.toString()))
				res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
			}
		)
		req.on('error', reject)
		if (options.body) req.write(options.body)
		req.end()
	})
}

describe('signature helpers', () => {
	it("validates Meta's sha256 header format", async () => {
		const body = '{"a":1}'
		expect(await isValidWebhookSignature(APP_SECRET, body, sign(APP_SECRET, body))).toBe(true)
		expect(
			await isValidWebhookSignature(
				APP_SECRET,
				new TextEncoder().encode(body),
				sign(APP_SECRET, body)
			)
		).toBe(true)
		expect(await isValidWebhookSignature(APP_SECRET, body, sign(APP_SECRET, '{"a":2}'))).toBe(
			false
		)
		expect(await isValidWebhookSignature(APP_SECRET, body, undefined)).toBe(false)
		await expect(verifyWebhookSignature(APP_SECRET, body, 'sha256=00')).rejects.toBeInstanceOf(
			InvalidWebhookSignatureError
		)
	})
})

describe('fetchHandler', () => {
	it('verifies, dispatches and hands listeners to waitUntil', async () => {
		const client = createClient()
		const listener = vi.fn()
		client.on('TextMessage', listener)
		const body = JSON.stringify(inboundMessage({ type: 'text', text: { body: 'hi' } }))
		const waitUntil = vi.fn()
		const response = await client.webhook.fetchHandler(
			new Request('https://bot.example.com/api/webhook', {
				method: 'POST',
				body,
				headers: {
					'x-hub-signature-256': sign(APP_SECRET, body),
					'content-type': 'application/json'
				}
			}),
			{ waitUntil }
		)
		expect(response.status).toBe(200)
		expect(waitUntil).toHaveBeenCalledOnce()
		await waitUntil.mock.calls[0]?.[0]
		expect(listener).toHaveBeenCalledOnce()
	})

	it('answers the GET challenge', async () => {
		const client = createClient()
		const response = await client.webhook.fetchHandler(
			new Request(
				'https://bot.example.com/api/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42'
			)
		)
		expect(response.status).toBe(200)
		expect(await response.text()).toBe('42')
	})
})

describe('nodeHandler and built-in server', () => {
	let client: Client | undefined
	afterEach(async () => {
		await client?.close()
	})

	it('serves the webhook on the configured path and emits Ready', async () => {
		client = createClient()
		const ready = vi.fn()
		const listener = vi.fn()
		client.on('Ready', ready)
		client.on('TextMessage', listener)
		const address = await client.webhook.listen({ port: 0, host: '127.0.0.1', path: '/hook' })
		expect(client.webhook.listening).toBe(true)
		expect(ready).toHaveBeenCalledWith(expect.objectContaining({ path: '/hook' }))

		const verify = await send({
			port: address.port,
			path: '/hook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc',
			method: 'GET'
		})
		expect(verify).toEqual({ status: 200, body: 'abc' })

		const body = JSON.stringify(inboundMessage({ type: 'text', text: { body: 'hi' } }))
		const ok = await send({
			port: address.port,
			path: '/hook',
			method: 'POST',
			body,
			headers: {
				'content-type': 'application/json',
				'x-hub-signature-256': sign(APP_SECRET, body)
			}
		})
		expect(ok.status).toBe(200)
		await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce())

		const forged = await send({ port: address.port, path: '/hook', method: 'POST', body })
		expect(forged.status).toBe(401)

		const missing = await send({ port: address.port, path: '/other', method: 'GET' })
		expect(missing.status).toBe(404)

		await client.close()
		expect(client.webhook.listening).toBe(false)
	})

	it('reports a port already in use instead of failing silently', async () => {
		client = createClient()
		const address = await client.webhook.listen({ port: 0, host: '127.0.0.1' })
		const second = createClient()
		await expect(
			second.webhook.listen({ port: address.port, host: '127.0.0.1' })
		).rejects.toThrow(/EADDRINUSE/)
	})

	it('works with a body pre-read as a Buffer (express.raw)', async () => {
		client = createClient()
		const listener = vi.fn()
		client.on('TextMessage', listener)
		const body = JSON.stringify(inboundMessage({ type: 'text', text: { body: 'hi' } }))
		const { createServer } = await import('node:http')
		const server = createServer((req, res) => {
			const chunks: Buffer[] = []
			req.on('data', (chunk: Buffer) => chunks.push(chunk))
			req.on('end', () => {
				// simulate express.raw(): body is a Buffer and the stream is consumed
				void client?.webhook.nodeHandler(
					Object.assign(req, { body: Buffer.concat(chunks) }),
					res
				)
			})
		})
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
		const port = (server.address() as { port: number }).port
		const response = await send({
			port,
			path: '/webhook',
			method: 'POST',
			body,
			headers: { 'x-hub-signature-256': sign(APP_SECRET, body) }
		})
		server.close()
		expect(response.status).toBe(200)
		await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce())
	})
})

describe('deprecated initiate()', () => {
	it('emits Error instead of rejecting when the port is taken', async () => {
		const first = createClient()
		const address = await first.webhook.listen({ port: 0, host: '127.0.0.1' })
		const second = new Client({
			accessToken: 'token',
			fetch: createFakeFetch().fetch,
			logger: silentLogger,
			webhook: { verifyToken: 'v', port: address.port, host: '127.0.0.1' }
		})
		const errors = vi.fn()
		second.on('Error', errors)
		await expect(second.initiate()).resolves.toBeUndefined()
		expect(errors).toHaveBeenCalledOnce()
		await first.close()
	})
})
