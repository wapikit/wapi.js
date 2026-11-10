import type { IncomingMessage, ServerResponse } from 'node:http'
import { type WebhookHandler, type WebhookResponse } from './handler'

/** Default maximum webhook body size: 3 MB. Meta's payloads are far smaller. */
export const DEFAULT_MAX_BODY_BYTES = 3 * 1024 * 1024

/** @internal Options shared by the adapters. */
export interface AdapterOptions {
	/** Requests with a larger body are answered with `413` without being buffered. */
	maxBodyBytes?: number
}

class BodyTooLargeError extends Error {}

function declaredLength(value: string | null | undefined): number {
	const length = Number(value ?? 0)
	return Number.isFinite(length) ? length : 0
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
	const body = new Uint8Array(length)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.length
	}
	return body
}

const tooLarge = (): Response =>
	new Response('Payload Too Large', {
		status: 413,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' }
	})

/**
 * Fetch API handler: `(request: Request) => Promise<Response>`. Works with
 * Next.js route handlers, Hono, Bun, Deno, Cloudflare Workers, Vercel and any
 * runtime built on the Fetch API.
 *
 * Pass `waitUntil` on serverless runtimes so they keep running your event
 * listeners after the response is sent.
 */
export type FetchWebhookHandler = (
	request: Request,
	context?: { waitUntil?: (promise: Promise<unknown>) => void }
) => Promise<Response>

/**
 * Node.js handler: `(req, res) => Promise<void>`. Works with `node:http`,
 * Express, Fastify (`reply.raw`), Koa (`ctx.req`, `ctx.res`) and Connect.
 *
 * For Express, mount it with the raw body so signatures can be verified:
 * `app.use("/webhook", express.raw({ type: "application/json" }), client.webhook.nodeHandler)`.
 */
export type NodeWebhookHandler = (
	request: IncomingMessage & { body?: unknown },
	response: ServerResponse
) => Promise<void>

/** Reads a Fetch API body, giving up as soon as it exceeds `maxBytes`. */
async function readWebBody(request: Request, maxBytes: number): Promise<Uint8Array> {
	if (!request.body) return new Uint8Array(0)
	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let length = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		length += value.length
		if (length > maxBytes) {
			await reader.cancel().catch(() => undefined)
			throw new BodyTooLargeError()
		}
		chunks.push(value)
	}
	return concat(chunks, length)
}

/** @internal */
export function createFetchHandler(
	handler: WebhookHandler,
	options: AdapterOptions = {}
): FetchWebhookHandler {
	const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
	return async (request, context) => {
		const url = new URL(request.url)
		let rawBody: Uint8Array | undefined
		if (request.method.toUpperCase() === 'POST') {
			if (declaredLength(request.headers.get('content-length')) > maxBytes) return tooLarge()
			try {
				rawBody = await readWebBody(request, maxBytes)
			} catch (error) {
				if (error instanceof BodyTooLargeError) return tooLarge()
				throw error
			}
		}
		const result = await handler.handle({
			method: request.method,
			query: url.searchParams,
			headers: request.headers,
			rawBody
		})
		context?.waitUntil?.(result.done)
		return new Response(result.body, { status: result.status, headers: result.headers })
	}
}

/** Reads a Node.js request body, giving up as soon as it exceeds `maxBytes`. */
async function readStream(request: IncomingMessage, maxBytes: number): Promise<Uint8Array> {
	const chunks: Uint8Array[] = []
	let length = 0
	for await (const chunk of request) {
		const bytes =
			typeof chunk === 'string' ? new TextEncoder().encode(chunk) : (chunk as Uint8Array)
		length += bytes.length
		if (length > maxBytes) throw new BodyTooLargeError()
		chunks.push(bytes)
	}
	return concat(chunks, length)
}

function writeTooLarge(request: IncomingMessage, response: ServerResponse): void {
	response.statusCode = 413
	response.setHeader('Content-Type', 'text/plain; charset=utf-8')
	response.setHeader('Connection', 'close')
	// Stop reading the rest of the upload once the answer is out.
	response.end('Payload Too Large', () => request.destroy())
}

function writeNodeResponse(response: ServerResponse, result: WebhookResponse): void {
	response.statusCode = result.status
	for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value)
	response.end(result.body)
}

/** @internal */
export function createNodeHandler(
	handler: WebhookHandler,
	options: AdapterOptions = {}
): NodeWebhookHandler {
	const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
	return async (request, response) => {
		const method = request.method ?? 'GET'
		const url = new URL(request.url ?? '/', 'http://localhost')
		let rawBody: string | Uint8Array | undefined
		let parsedBody: unknown

		if (method.toUpperCase() === 'POST') {
			const body = request.body
			if (body instanceof Uint8Array || typeof body === 'string') {
				// e.g. express.raw() or express.text(); Buffer is a Uint8Array
				rawBody = body
			} else if (body !== undefined && body !== null) {
				// e.g. express.json(): the raw body is gone, only usable without appSecret
				parsedBody = body
			} else if (!request.readableEnded) {
				if (declaredLength(request.headers['content-length']) > maxBytes) {
					writeTooLarge(request, response)
					return
				}
				try {
					rawBody = await readStream(request, maxBytes)
				} catch (error) {
					if (error instanceof BodyTooLargeError) {
						writeTooLarge(request, response)
						return
					}
					throw error
				}
			}
		}

		const result = await handler.handle({
			method,
			query: url.searchParams,
			headers: request.headers,
			rawBody,
			parsedBody
		})
		writeNodeResponse(response, result)
	}
}
