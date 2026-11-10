import { describe, expect, it } from 'vitest'
import { LocationMessage, ReactionMessage } from '../../src/components'
import { ValidationError } from '../../src/errors'

const to = '15550001111'
const envelope = { messaging_product: 'whatsapp', recipient_type: 'individual', to }

describe('LocationMessage', () => {
	it('serialises a location with name and address', () => {
		expect(
			new LocationMessage({
				latitude: 37.4847,
				longitude: -122.1477,
				name: 'Meta HQ',
				address: '1 Hacker Way'
			}).toJson({ to })
		).toEqual({
			...envelope,
			type: 'location',
			location: {
				latitude: 37.4847,
				longitude: -122.1477,
				name: 'Meta HQ',
				address: '1 Hacker Way'
			}
		})
	})

	it('omits optional fields and accepts 0,0', () => {
		expect(new LocationMessage({ latitude: 0, longitude: 0 }).toJson({ to })).toEqual({
			...envelope,
			type: 'location',
			location: { latitude: 0, longitude: 0 }
		})
	})

	it('validates coordinates', () => {
		expect(() => new LocationMessage({ latitude: 91, longitude: 0 })).toThrow(ValidationError)
		expect(() => new LocationMessage({ latitude: 0, longitude: -181 })).toThrow(ValidationError)
		expect(() => new LocationMessage({ latitude: Number.NaN, longitude: 0 })).toThrow(
			ValidationError
		)
	})
})

describe('ReactionMessage', () => {
	it('serialises a reaction', () => {
		expect(new ReactionMessage({ messageId: 'wamid.ABC', emoji: '👍' }).toJson({ to })).toEqual(
			{
				...envelope,
				type: 'reaction',
				reaction: { message_id: 'wamid.ABC', emoji: '👍' }
			}
		)
	})

	it('allows an empty emoji to remove a reaction', () => {
		expect(new ReactionMessage({ messageId: 'wamid.ABC', emoji: '' }).toJson({ to })).toEqual({
			...envelope,
			type: 'reaction',
			reaction: { message_id: 'wamid.ABC', emoji: '' }
		})
	})

	it('needs a message id', () => {
		expect(() => new ReactionMessage({ messageId: '', emoji: '👍' })).toThrow(ValidationError)
	})
})
