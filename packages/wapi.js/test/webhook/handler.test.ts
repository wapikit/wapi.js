import { describe, expect, it, vi } from 'vitest'
import { Client } from '../../src/client/client'
import { silentLogger } from '../../src/internal/logger'
import {
	type ImageMessageEvent,
	type LocationMessageEvent,
	type MessageFailedEvent,
	type TextMessageEvent
} from '../../src/events'
import { TextMessage } from '../../src/components'
import {
	BUSINESS_ACCOUNT_ID,
	PHONE_NUMBER_ID,
	createFakeFetch,
	inboundMessage,
	messagesPayload,
	sign
} from '../helpers'

const APP_SECRET = 'app-secret'

function createClient(options: { appSecret?: string } = {}) {
	const fake = createFakeFetch([
		{
			messaging_product: 'whatsapp',
			contacts: [{ input: '16505551234', wa_id: '16505551234' }],
			messages: [{ id: 'wamid.reply' }]
		}
	])
	const client = new Client({
		accessToken: 'token',
		fetch: fake.fetch,
		logger: silentLogger,
		webhook: { verifyToken: 'verify-me', appSecret: options.appSecret }
	})
	return { client, fake }
}

async function post(client: Client, payload: unknown, headers: Record<string, string> = {}) {
	const body = JSON.stringify(payload)
	const response = await client.webhook.handle({
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		rawBody: body
	})
	await response.done
	return response
}

describe('webhook verification (GET)', () => {
	it('answers the challenge for a matching token', async () => {
		const { client } = createClient()
		const response = await client.webhook.handle({
			method: 'GET',
			query: {
				'hub.mode': 'subscribe',
				'hub.verify_token': 'verify-me',
				'hub.challenge': '1158201444'
			}
		})
		expect(response.status).toBe(200)
		expect(response.body).toBe('1158201444')
	})

	it('rejects a wrong token, wrong mode and a missing token', async () => {
		const { client } = createClient()
		for (const query of [
			{ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' },
			{ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '1' },
			{}
		]) {
			const response = await client.webhook.handle({ method: 'GET', query })
			expect(response.status).toBe(403)
		}
	})

	it('rejects other methods', async () => {
		const { client } = createClient()
		expect((await client.webhook.handle({ method: 'PUT' })).status).toBe(405)
	})
})

describe('webhook signature (POST)', () => {
	const payload = inboundMessage({ type: 'text', text: { body: 'hi' } })

	it('accepts a valid signature', async () => {
		const { client } = createClient({ appSecret: APP_SECRET })
		const listener = vi.fn()
		client.on('TextMessage', listener)
		const body = JSON.stringify(payload)
		const response = await client.webhook.handle({
			method: 'POST',
			headers: { 'x-hub-signature-256': sign(APP_SECRET, body) },
			rawBody: body
		})
		await response.done
		expect(response.status).toBe(200)
		expect(listener).toHaveBeenCalledOnce()
	})

	it('rejects missing, malformed and wrong signatures with 401 and emits nothing', async () => {
		const { client } = createClient({ appSecret: APP_SECRET })
		const listener = vi.fn()
		client.on('TextMessage', listener)
		const body = JSON.stringify(payload)
		for (const signature of [undefined, 'sha1=abc', 'sha256=zz', sign('other', body)]) {
			const response = await client.webhook.handle({
				method: 'POST',
				headers: signature ? { 'x-hub-signature-256': signature } : {},
				rawBody: body
			})
			expect(response.status).toBe(401)
		}
		expect(listener).not.toHaveBeenCalled()
	})

	it('fails closed when only a parsed body is available', async () => {
		const { client } = createClient({ appSecret: APP_SECRET })
		const response = await client.webhook.handle({ method: 'POST', parsedBody: payload })
		expect(response.status).toBe(401)
	})

	it('accepts a parsed body when no app secret is configured', async () => {
		const { client } = createClient()
		const listener = vi.fn()
		client.on('TextMessage', listener)
		const response = await client.webhook.handle({ method: 'POST', parsedBody: payload })
		await response.done
		expect(response.status).toBe(200)
		expect(listener).toHaveBeenCalledOnce()
	})
})

describe('webhook payload handling', () => {
	it('returns 400 for invalid JSON and payloads without entries', async () => {
		const { client } = createClient()
		expect((await client.webhook.handle({ method: 'POST', rawBody: '{nope' })).status).toBe(400)
		expect((await client.webhook.handle({ method: 'POST', rawBody: '{}' })).status).toBe(400)
	})

	it('skips an undecodable change but still delivers the rest with 200', async () => {
		const { client } = createClient()
		const text = vi.fn()
		const errors = vi.fn()
		client.on('TextMessage', text)
		client.on('Error', errors)
		const good = inboundMessage({ type: 'text', text: { body: 'hi' } }) as {
			entry: { changes: unknown[] }[]
		}
		good.entry[0]?.changes.unshift({ field: 'messages', value: { nonsense: true } })
		const response = await post(client, good)
		expect(response.status).toBe(200)
		expect(text).toHaveBeenCalledOnce()
		expect(errors).toHaveBeenCalledOnce()
	})

	it('warns about unknown fields instead of failing', async () => {
		const { client } = createClient()
		const warn = vi.fn()
		client.on('Warn', warn)
		const response = await post(client, {
			object: 'whatsapp_business_account',
			entry: [{ id: BUSINESS_ACCOUNT_ID, changes: [{ field: 'brand_new_field', value: {} }] }]
		})
		expect(response.status).toBe(200)
		expect(warn).toHaveBeenCalledOnce()
	})

	it('isolates throwing and rejecting listeners', async () => {
		const { client } = createClient()
		const errors = vi.fn()
		const second = vi.fn()
		client.on('Error', errors)
		client.on('TextMessage', () => {
			throw new Error('sync boom')
		})
		client.on('TextMessage', () => Promise.reject(new Error('async boom')))
		client.on('TextMessage', second)
		const response = await post(client, inboundMessage({ type: 'text', text: { body: 'hi' } }))
		expect(response.status).toBe(200)
		expect(second).toHaveBeenCalledOnce()
		expect(errors).toHaveBeenCalledTimes(2)
	})
})

describe('message events', () => {
	it('maps a text message with sender identity and receiving number', async () => {
		const { client } = createClient()
		let event: TextMessageEvent | undefined
		client.on('TextMessage', e => {
			event = e
		})
		await post(
			client,
			inboundMessage({ type: 'text', text: { body: 'Hello' }, context: { forwarded: true } })
		)
		expect(event?.text).toBe('Hello')
		expect(event?.from).toBe('16505551234')
		expect(event?.senderName).toBe('Sheena Nelson')
		expect(event?.username).toBe('sheena')
		expect(event?.userId).toBe('US.13491208655302741918')
		expect(event?.businessAccountId).toBe(BUSINESS_ACCOUNT_ID)
		expect(event?.phoneNumber).toEqual({
			id: PHONE_NUMBER_ID,
			displayPhoneNumber: '15550783881'
		})
		expect(event?.isForwarded).toBe(true)
		expect(event?.timestamp).toBe(1749416383)
	})

	it('replies from the number the message was received on', async () => {
		const { client, fake } = createClient()
		client.on('TextMessage', async e => {
			await e.reply(new TextMessage({ text: 'pong' }))
		})
		await post(client, inboundMessage({ type: 'text', text: { body: 'ping' } }))
		expect(fake.requests).toHaveLength(1)
		expect(fake.requests[0]?.url).toBe(
			`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`
		)
		expect(fake.requests[0]?.body).toMatchObject({
			to: '16505551234',
			type: 'text',
			context: {
				message_id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA='
			}
		})
	})

	it('replies to BSUID-only senders through `recipient`', async () => {
		const { client, fake } = createClient()
		client.on('TextMessage', async e => {
			await e.send(new TextMessage({ text: 'hello' }))
		})
		const payload = messagesPayload({
			contacts: [{ profile: { name: 'No Phone' }, user_id: 'US.1' }],
			messages: [
				{
					from: '',
					from_user_id: 'US.1',
					id: 'wamid.x',
					timestamp: '1',
					type: 'text',
					text: { body: 'hi' }
				}
			]
		})
		await post(client, payload)
		expect(fake.requests[0]?.body).toMatchObject({ recipient: 'US.1' })
		expect((fake.requests[0]?.body as Record<string, unknown>).to).toBeUndefined()
	})

	it('emits VideoMessage for lowercase `video` (0.1.x never did)', async () => {
		const { client } = createClient()
		const listener = vi.fn()
		client.on('VideoMessage', listener)
		await post(
			client,
			inboundMessage({
				type: 'video',
				video: { id: 'media-1', mime_type: 'video/mp4', sha256: 'abc' }
			})
		)
		expect(listener).toHaveBeenCalledOnce()
	})

	it('uses the media id, not the message id, for image components', async () => {
		const { client } = createClient()
		let event: ImageMessageEvent | undefined
		client.on('ImageMessage', e => {
			event = e
		})
		await post(
			client,
			inboundMessage({
				type: 'image',
				image: { id: 'media-42', mime_type: 'image/jpeg', sha256: 's', caption: 'cat' }
			})
		)
		expect(event?.mediaId).toBe('media-42')
		expect(event?.caption).toBe('cat')
		expect(event?.message.toJson({ to: '1' })).toMatchObject({
			image: { id: 'media-42', caption: 'cat' }
		})
	})

	it('keeps latitude and longitude apart', async () => {
		const { client } = createClient()
		let event: LocationMessageEvent | undefined
		client.on('LocationMessage', e => {
			event = e
		})
		await post(
			client,
			inboundMessage({
				type: 'location',
				location: { latitude: 12.97, longitude: 77.59, name: 'Bengaluru' }
			})
		)
		expect(event?.latitude).toBe(12.97)
		expect(event?.longitude).toBe(77.59)
	})

	it.each([
		[
			'AudioMessage',
			{ type: 'audio', audio: { id: 'a', mime_type: 'audio/ogg', voice: true } }
		],
		['DocumentMessage', { type: 'document', document: { id: 'd', filename: 'invoice.pdf' } }],
		['StickerMessage', { type: 'sticker', sticker: { id: 's', animated: true } }],
		[
			'ContactsMessage',
			{
				type: 'contacts',
				contacts: [{ name: { formatted_name: 'Jane' }, phones: [{ phone: '+1 555' }] }]
			}
		],
		['Reaction', { type: 'reaction', reaction: { message_id: 'wamid.1', emoji: '👍' } }],
		[
			'ReplyButtonInteraction',
			{
				type: 'interactive',
				interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Yes' } }
			}
		],
		[
			'ListInteraction',
			{
				type: 'interactive',
				interactive: { type: 'list_reply', list_reply: { id: 'r1', title: 'Row' } }
			}
		],
		[
			'FlowCompletion',
			{
				type: 'interactive',
				interactive: {
					type: 'nfm_reply',
					nfm_reply: { name: 'flow', response_json: '{"a":1}' }
				}
			}
		],
		[
			'QuickReplyButtonInteraction',
			{ type: 'button', button: { text: 'Stop', payload: 'STOP' } }
		],
		[
			'OrderReceived',
			{
				type: 'order',
				order: {
					catalog_id: 'c',
					product_items: [
						{ product_retailer_id: 'p', quantity: 2, item_price: 10, currency: 'USD' }
					]
				}
			}
		],
		[
			'ProductInquiry',
			{
				type: 'text',
				text: { body: 'Is it in stock?' },
				context: { referred_product: { catalog_id: 'c', product_retailer_id: 'p' } }
			}
		],
		[
			'CustomerNumberChanged',
			{
				type: 'system',
				system: { type: 'user_changed_number', body: 'changed', wa_id: '16505550000' }
			}
		],
		[
			'UnsupportedMessage',
			{
				type: 'unsupported',
				unsupported: { type: 'edit' },
				errors: [{ code: 131051, title: 'Message type unknown' }]
			}
		],
		['UnsupportedMessage', { type: 'some_future_type' }]
	] as const)('emits %s', async (eventName, message) => {
		const { client } = createClient()
		const listener = vi.fn()
		client.on(eventName, listener)
		await post(client, inboundMessage(message))
		expect(listener).toHaveBeenCalledOnce()
	})

	it('emits AdInteraction in addition to the message event', async () => {
		const { client } = createClient()
		const ad = vi.fn()
		const text = vi.fn()
		client.on('AdInteraction', ad)
		client.on('TextMessage', text)
		await post(
			client,
			inboundMessage({
				type: 'text',
				text: { body: 'From the ad' },
				referral: {
					source_type: 'ad',
					source_id: '1',
					ctwa_clid: 'clid',
					welcome_message: { text: 'Welcome!' }
				}
			})
		)
		expect(ad).toHaveBeenCalledOnce()
		expect(text).toHaveBeenCalledOnce()
		expect(ad.mock.calls[0]?.[0]).toMatchObject({
			text: 'Welcome!',
			adSource: { ctwaClid: 'clid' }
		})
	})
})

describe('status events', () => {
	function statusPayload(status: Record<string, unknown>) {
		return messagesPayload({
			statuses: [
				{
					id: 'wamid.sent',
					recipient_id: '16505551234',
					recipient_user_id: 'US.1',
					timestamp: '1750263773',
					...status
				}
			]
		})
	}

	it('carries message id, recipient, pricing and conversation', async () => {
		const { client } = createClient()
		const delivered = vi.fn()
		const all = vi.fn()
		client.on('MessageDelivered', delivered)
		client.on('MessageStatus', all)
		await post(
			client,
			statusPayload({
				status: 'delivered',
				biz_opaque_callback_data: 'order-9',
				conversation: { id: 'conv-1', origin: { type: 'utility' } },
				pricing: {
					billable: true,
					pricing_model: 'PMP',
					category: 'utility',
					type: 'regular'
				}
			})
		)
		expect(all).toHaveBeenCalledOnce()
		expect(delivered.mock.calls[0]?.[0]).toMatchObject({
			messageId: 'wamid.sent',
			recipientId: '16505551234',
			recipientUserId: 'US.1',
			bizOpaqueCallbackData: 'order-9',
			pricing: { billable: true, pricingModel: 'PMP', category: 'utility', type: 'regular' },
			conversation: { id: 'conv-1', originType: 'utility' }
		})
	})

	it('maps failed statuses with their error', async () => {
		const { client } = createClient()
		let event: MessageFailedEvent | undefined
		client.on('MessageFailed', e => {
			event = e
		})
		await post(
			client,
			statusPayload({
				status: 'failed',
				errors: [
					{
						code: 131026,
						title: 'Message undeliverable',
						message: 'Message undeliverable',
						error_data: { details: 'x' }
					}
				]
			})
		)
		expect(event?.error).toMatchObject({ code: 131026, details: 'x' })
		expect(event?.failReason).toBe('Message undeliverable')
	})

	it('emits a failed status without errors (0.1.x dropped it)', async () => {
		const { client } = createClient()
		const failed = vi.fn()
		client.on('MessageFailed', failed)
		await post(client, statusPayload({ status: 'failed' }))
		expect(failed).toHaveBeenCalledOnce()
	})

	it('emits MessageUndelivered for `undelivered` and error 130472', async () => {
		const { client } = createClient()
		const undelivered = vi.fn()
		const failed = vi.fn()
		client.on('MessageUndelivered', undelivered)
		client.on('MessageFailed', failed)
		await post(client, statusPayload({ status: 'undelivered' }))
		await post(
			client,
			statusPayload({ status: 'failed', errors: [{ code: 130472, title: 'experiment' }] })
		)
		expect(undelivered).toHaveBeenCalledTimes(2)
		expect(failed).not.toHaveBeenCalled()
	})

	it.each(['sent', 'read'] as const)('emits %s', async status => {
		const { client } = createClient()
		const listener = vi.fn()
		client.on(status === 'sent' ? 'MessageSent' : 'MessageRead', listener)
		await post(client, statusPayload({ status }))
		expect(listener).toHaveBeenCalledOnce()
	})
})
