import { describe, expect, it } from 'vitest'
import {
	AudioMessage,
	DocumentMessage,
	ImageMessage,
	type MediaSource,
	StickerMessage,
	VideoMessage
} from '../../src/components'
import { ValidationError } from '../../src/errors'

const to = '15550001111'
const envelope = { messaging_product: 'whatsapp', recipient_type: 'individual', to }

describe('ImageMessage', () => {
	it('serialises an uploaded image with a caption', () => {
		expect(new ImageMessage({ id: 'media-1', caption: 'A cat' }).toJson({ to })).toEqual({
			...envelope,
			type: 'image',
			image: { id: 'media-1', caption: 'A cat' }
		})
	})

	it('serialises a linked image without a caption', () => {
		expect(new ImageMessage({ link: 'https://example.com/cat.png' }).toJson({ to })).toEqual({
			...envelope,
			type: 'image',
			image: { link: 'https://example.com/cat.png' }
		})
	})

	it('exposes its input as data', () => {
		expect(new ImageMessage({ id: 'media-1', caption: 'c' }).data.caption).toBe('c')
	})

	it('needs exactly one of id or link', () => {
		expect(() => new ImageMessage({} as MediaSource)).toThrow(ValidationError)
		expect(
			() => new ImageMessage({ id: '1', link: 'https://x' } as unknown as MediaSource)
		).toThrow(ValidationError)
	})

	it('limits the caption to 1024 characters', () => {
		expect(() => new ImageMessage({ id: '1', caption: 'a'.repeat(1025) })).toThrow(
			ValidationError
		)
	})
})

describe('VideoMessage', () => {
	it('keeps the caption', () => {
		expect(
			new VideoMessage({ link: 'https://example.com/v.mp4', caption: 'Watch' }).toJson({ to })
		).toEqual({
			...envelope,
			type: 'video',
			video: { link: 'https://example.com/v.mp4', caption: 'Watch' }
		})
	})
})

describe('AudioMessage', () => {
	it('serialises an audio message', () => {
		expect(new AudioMessage({ id: 'audio-1' }).toJson({ to })).toEqual({
			...envelope,
			type: 'audio',
			audio: { id: 'audio-1' }
		})
	})
})

describe('StickerMessage', () => {
	it('serialises a sticker message', () => {
		expect(new StickerMessage({ link: 'https://example.com/s.webp' }).toJson({ to })).toEqual({
			...envelope,
			type: 'sticker',
			sticker: { link: 'https://example.com/s.webp' }
		})
	})
})

describe('DocumentMessage', () => {
	it('serialises filename and caption', () => {
		expect(
			new DocumentMessage({
				link: 'https://example.com/invoice.pdf',
				filename: 'invoice.pdf',
				caption: 'Your invoice'
			}).toJson({ to })
		).toEqual({
			...envelope,
			type: 'document',
			document: {
				link: 'https://example.com/invoice.pdf',
				filename: 'invoice.pdf',
				caption: 'Your invoice'
			}
		})
	})

	it('omits optional fields', () => {
		expect(new DocumentMessage({ id: 'doc-1' }).toJson({ to })).toEqual({
			...envelope,
			type: 'document',
			document: { id: 'doc-1' }
		})
	})
})
