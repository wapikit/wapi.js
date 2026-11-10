import { describe, expect, it } from 'vitest'
import { TextMessage } from '../../src/components'
import { ValidationError } from '../../src/errors'

const to = '15550001111'

describe('TextMessage', () => {
	it('serialises a text message', () => {
		expect(new TextMessage({ text: 'hello' }).toJson({ to })).toEqual({
			messaging_product: 'whatsapp',
			recipient_type: 'individual',
			type: 'text',
			to,
			text: { body: 'hello' }
		})
	})

	it('puts preview_url inside the text object', () => {
		const payload = new TextMessage({ text: 'https://wapikit.com', previewUrl: true }).toJson({
			to
		})
		expect(payload).toEqual({
			messaging_product: 'whatsapp',
			recipient_type: 'individual',
			type: 'text',
			to,
			text: { body: 'https://wapikit.com', preview_url: true }
		})
		expect(payload).not.toHaveProperty('preview_url')
	})

	it('exposes its input as data', () => {
		expect(new TextMessage({ text: 'hi', previewUrl: false }).data).toEqual({
			text: 'hi',
			previewUrl: false
		})
	})

	it('serialises a BSUID recipient, reply context and callback data', () => {
		expect(
			new TextMessage({ text: 'hi' }).toJson({
				recipient: 'US.13491208655302741918',
				replyToMessageId: 'wamid.ABC',
				bizOpaqueCallbackData: 'tracking-1'
			})
		).toEqual({
			messaging_product: 'whatsapp',
			recipient_type: 'individual',
			type: 'text',
			recipient: 'US.13491208655302741918',
			context: { message_id: 'wamid.ABC' },
			biz_opaque_callback_data: 'tracking-1',
			text: { body: 'hi' }
		})
	})

	it('validates the body', () => {
		expect(() => new TextMessage({ text: '' })).toThrow(ValidationError)
		expect(() => new TextMessage({ text: 'a'.repeat(4097) })).toThrow(ValidationError)
		expect(() => new TextMessage({ text: 'a'.repeat(4096) })).not.toThrow()
	})

	it('needs a recipient', () => {
		expect(() => new TextMessage({ text: 'hi' }).toJson({})).toThrow(ValidationError)
	})
})
