import { createHmac } from 'node:crypto'
import { type FetchLike } from '../src/internal/request-client'

export interface RecordedRequest {
	url: string
	method: string
	headers: Record<string, string>
	body: unknown
}

/**
 * A fake `fetch` that records requests and answers with the queued responses
 * (or `{ success: true }` when the queue is empty).
 */
export function createFakeFetch(responses: unknown[] = []): {
	fetch: FetchLike
	requests: RecordedRequest[]
} {
	const requests: RecordedRequest[] = []
	const queue = [...responses]
	const fetch: FetchLike = (input, init) => {
		const headers: Record<string, string> = {}
		new Headers(init.headers).forEach((value, key) => {
			headers[key] = value
		})
		let body: unknown = init.body
		if (typeof init.body === 'string') {
			try {
				body = JSON.parse(init.body)
			} catch {
				body = init.body
			}
		}
		requests.push({ url: input, method: init.method ?? 'GET', headers, body })
		const next = queue.length > 0 ? queue.shift() : { success: true }
		const isEnvelope =
			!!next &&
			typeof next === 'object' &&
			'status' in next &&
			'body' in next &&
			typeof (next as { status: unknown }).status === 'number'
		const status = isEnvelope ? (next as { status: number }).status : 200
		const payload = isEnvelope ? (next as { body: unknown }).body : next
		const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
		return Promise.resolve(new Response(text, { status }))
	}
	return { fetch, requests }
}

export function sign(appSecret: string, body: string): string {
	return `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`
}

export const BUSINESS_ACCOUNT_ID = '102290129340398'
export const PHONE_NUMBER_ID = '106540352242922'

/** Wraps a `messages` change value in a full webhook payload. */
export function messagesPayload(value: Record<string, unknown>): Record<string, unknown> {
	return {
		object: 'whatsapp_business_account',
		entry: [
			{
				id: BUSINESS_ACCOUNT_ID,
				changes: [
					{
						field: 'messages',
						value: {
							messaging_product: 'whatsapp',
							metadata: {
								display_phone_number: '15550783881',
								phone_number_id: PHONE_NUMBER_ID
							},
							...value
						}
					}
				]
			}
		]
	}
}

/** A `messages` payload with one inbound message from a phone-known sender. */
export function inboundMessage(message: Record<string, unknown>): Record<string, unknown> {
	return messagesPayload({
		contacts: [
			{
				profile: { name: 'Sheena Nelson', username: 'sheena' },
				wa_id: '16505551234',
				user_id: 'US.13491208655302741918'
			}
		],
		messages: [
			{
				from: '16505551234',
				id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=',
				timestamp: '1749416383',
				...message
			}
		]
	})
}
