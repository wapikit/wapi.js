import { describe, expect, it } from 'vitest'
import { Client } from '../../src/client/client'
import { TextMessage } from '../../src/components'
import { ValidationError } from '../../src/errors'
import { silentLogger } from '../../src/internal/logger'
import { createFakeFetch } from '../helpers'

const sendResponse = {
	messaging_product: 'whatsapp',
	contacts: [{ input: '16505551234', wa_id: '16505551234' }],
	messages: [{ id: 'wamid.1', message_status: 'accepted' }]
}

function setup(responses: unknown[] = [sendResponse]) {
	const fake = createFakeFetch(responses)
	const client = new Client({
		accessToken: 'token',
		businessAccountId: 'waba-1',
		phoneNumberId: 'pn-default',
		fetch: fake.fetch,
		logger: silentLogger
	})
	return { client, fake }
}

describe('Client', () => {
	it('requires an access token', () => {
		expect(() => new Client({ accessToken: '' })).toThrow(TypeError)
	})

	it('caches one messaging client per phone number', () => {
		const { client } = setup()
		expect(client.messaging('a')).toBe(client.messaging('a'))
		expect(client.messaging('a')).not.toBe(client.messaging('b'))
		expect(client.messaging()).toBe(client.messaging('pn-default'))
	})

	it('explains what is missing', () => {
		const client = new Client({
			accessToken: 't',
			logger: silentLogger,
			fetch: createFakeFetch().fetch
		})
		expect(() => client.message).toThrow(/phone number id/)
		expect(() => client.templates).toThrow(/businessAccountId/)
		expect(() => client.webhook.fetchHandler).toThrow(/verifyToken/)
	})

	it('sends from the chosen number and returns the message id', async () => {
		const { client, fake } = setup()
		const result = await client.messaging('pn-2').message.send({
			to: '16505551234',
			message: new TextMessage({ text: 'hi' }),
			bizOpaqueCallbackData: 'ref-1'
		})
		expect(result.messageId).toBe('wamid.1')
		expect(fake.requests[0]?.url).toBe('https://graph.facebook.com/v20.0/pn-2/messages')
		expect(fake.requests[0]?.body).toMatchObject({
			messaging_product: 'whatsapp',
			to: '16505551234',
			type: 'text',
			biz_opaque_callback_data: 'ref-1'
		})
	})

	it('sends to a BSUID through `recipient`', async () => {
		const { client, fake } = setup()
		await client.message.send({
			to: { userId: 'US.123' },
			message: new TextMessage({ text: 'hi' })
		})
		const body = fake.requests[0]?.body as Record<string, unknown>
		expect(body.recipient).toBe('US.123')
		expect(body.to).toBeUndefined()
	})

	it('rejects an empty target', async () => {
		const { client } = setup()
		await expect(
			client.message.send({ to: '', message: new TextMessage({ text: 'x' }) })
		).rejects.toBeInstanceOf(ValidationError)
	})

	it('uses the marketing messages endpoint', async () => {
		const { client, fake } = setup()
		await client.message.sendMarketing({ to: '1', message: new TextMessage({ text: 'x' }) })
		expect(fake.requests[0]?.url).toBe(
			'https://graph.facebook.com/v20.0/pn-default/marketing_messages'
		)
	})

	it('marks as read with a typing indicator', async () => {
		const { client, fake } = setup([{ success: true }])
		await client.message.markAsRead('wamid.in', { typingIndicator: true })
		expect(fake.requests[0]?.body).toEqual({
			messaging_product: 'whatsapp',
			status: 'read',
			message_id: 'wamid.in',
			typing_indicator: { type: 'text' }
		})
	})

	it('uploads media as multipart and deletes by id', async () => {
		const { client, fake } = setup([{ id: 'media-1' }, { success: true }])
		const uploaded = await client.media.upload({
			file: new Uint8Array([1, 2, 3]),
			mimeType: 'image/png',
			filename: 'a.png'
		})
		expect(uploaded.id).toBe('media-1')
		expect(fake.requests[0]?.url).toBe('https://graph.facebook.com/v20.0/pn-default/media')
		expect(fake.requests[0]?.body).toBeInstanceOf(FormData)
		const form = fake.requests[0]?.body as FormData
		expect(form.get('messaging_product')).toBe('whatsapp')
		expect((form.get('file') as File).name).toBe('a.png')

		await client.media.delete('media-1')
		expect(fake.requests[1]).toMatchObject({
			method: 'DELETE',
			url: 'https://graph.facebook.com/v20.0/media-1?phone_number_id=pn-default'
		})
	})

	it('downloads media with the bearer token', async () => {
		const { client, fake } = setup([
			{
				url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1',
				mime_type: 'image/png',
				id: 'm'
			},
			'binary'
		])
		const file = await client.media.download('m')
		expect(new TextDecoder().decode(file.data)).toBe('binary')
		expect(fake.requests[1]?.url).toContain('lookaside.fbsbx.com')
		expect(fake.requests[1]?.headers.authorization).toBe('Bearer token')
	})
})
