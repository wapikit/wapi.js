import type { IncomingMessage, ServerResponse } from 'node:http'
import { type WebhookHandler, type WebhookResponse } from './handler'

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

/** @internal */
export function createFetchHandler(handler: WebhookHandler): FetchWebhookHandler {
	return async (request, context) => {
		const url = new URL(request.url)
		const rawBody =
			request.method.toUpperCase() === 'POST' ? await request.arrayBuffer() : undefined
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

async function readStream(request: IncomingMessage): Promise<Uint8Array> {
	const chunks: Uint8Array[] = []
	for await (const chunk of request) {
		chunks.push(
			typeof chunk === 'string' ? new TextEncoder().encode(chunk) : (chunk as Uint8Array)
		)
	}
	const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
	const body = new Uint8Array(length)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.length
	}
	return body
}

function writeNodeResponse(response: ServerResponse, result: WebhookResponse): void {
	response.statusCode = result.status
	for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value)
	response.end(result.body)
}

/** @internal */
export function createNodeHandler(handler: WebhookHandler): NodeWebhookHandler {
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
				rawBody = await readStream(request)
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
