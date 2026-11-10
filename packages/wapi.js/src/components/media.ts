import { BaseMessage, MessageTypeEnum, assert, compact } from './base'
import { MessageLimits, assertOptionalText, assertText } from './validation'

/**
 * Where a media asset comes from: the id returned by a media upload, or a
 * public HTTPS URL Meta downloads it from. Exactly one is set.
 */
export type MediaSource = { id: string; link?: never } | { link: string; id?: never }

/** Cloud API media reference, `{ id }` or `{ link }`. */
export type MediaSourcePayload = { id: string } | { link: string }

/**
 * Validates a {@link MediaSource} and returns only the key that is set.
 *
 * @internal
 */
export function toMediaSourcePayload(source: MediaSource, field = 'media'): MediaSourcePayload {
	const hasId = source.id !== undefined
	const hasLink = source.link !== undefined
	assert(hasId !== hasLink, `\`${field}\` needs exactly one of \`id\` or \`link\``)
	if (hasId) {
		assertText(source.id, `${field}.id`)
		return { id: source.id }
	}
	assertText(source.link, `${field}.link`)
	return { link: source.link }
}

/** Input of {@link ImageMessage}. */
export type ImageMessageOptions = MediaSource & {
	/** Up to 1024 characters. */
	caption?: string
}

/** Input of {@link VideoMessage}. */
export type VideoMessageOptions = MediaSource & {
	/** Up to 1024 characters. */
	caption?: string
}

/** Input of {@link AudioMessage}. */
export type AudioMessageOptions = MediaSource

/** Input of {@link StickerMessage}. */
export type StickerMessageOptions = MediaSource

/** Input of {@link DocumentMessage}. */
export type DocumentMessageOptions = MediaSource & {
	/** Up to 1024 characters. */
	caption?: string
	/**
	 * File name shown to the recipient, including the extension
	 * (`invoice.pdf`). Without it WhatsApp shows a generic name.
	 */
	filename?: string
}

/** Cloud API `image` / `video` object. */
export type CaptionedMediaPayload = MediaSourcePayload & { caption?: string }

/** Cloud API `document` object. */
export type DocumentMediaPayload = MediaSourcePayload & {
	caption?: string
	filename?: string
}

/**
 * An image message (JPEG or PNG, up to 5 MB).
 *
 * @example
 * ```ts
 * new ImageMessage({ link: "https://example.com/cat.png", caption: "A cat" });
 * new ImageMessage({ id: uploadedMediaId });
 * ```
 */
export class ImageMessage extends BaseMessage<MessageTypeEnum.Image> {
	readonly data: Readonly<ImageMessageOptions>

	constructor(data: ImageMessageOptions) {
		super(MessageTypeEnum.Image)
		toMediaSourcePayload(data, 'image')
		assertOptionalText(data.caption, 'caption', MessageLimits.mediaCaption)
		this.data = { ...data }
	}

	protected content(): { image: CaptionedMediaPayload } {
		return {
			image: {
				...toMediaSourcePayload(this.data, 'image'),
				...compact({ caption: this.data.caption })
			}
		}
	}
}

/** A video message (MP4 or 3GPP, up to 16 MB). */
export class VideoMessage extends BaseMessage<MessageTypeEnum.Video> {
	readonly data: Readonly<VideoMessageOptions>

	constructor(data: VideoMessageOptions) {
		super(MessageTypeEnum.Video)
		toMediaSourcePayload(data, 'video')
		assertOptionalText(data.caption, 'caption', MessageLimits.mediaCaption)
		this.data = { ...data }
	}

	protected content(): { video: CaptionedMediaPayload } {
		return {
			video: {
				...toMediaSourcePayload(this.data, 'video'),
				...compact({ caption: this.data.caption })
			}
		}
	}
}

/** An audio message. Audio messages cannot carry a caption. */
export class AudioMessage extends BaseMessage<MessageTypeEnum.Audio> {
	readonly data: Readonly<AudioMessageOptions>

	constructor(data: AudioMessageOptions) {
		super(MessageTypeEnum.Audio)
		toMediaSourcePayload(data, 'audio')
		this.data = { ...data }
	}

	protected content(): { audio: MediaSourcePayload } {
		return { audio: toMediaSourcePayload(this.data, 'audio') }
	}
}

/** A sticker message (WebP). Stickers cannot carry a caption. */
export class StickerMessage extends BaseMessage<MessageTypeEnum.Sticker> {
	readonly data: Readonly<StickerMessageOptions>

	constructor(data: StickerMessageOptions) {
		super(MessageTypeEnum.Sticker)
		toMediaSourcePayload(data, 'sticker')
		this.data = { ...data }
	}

	protected content(): { sticker: MediaSourcePayload } {
		return { sticker: toMediaSourcePayload(this.data, 'sticker') }
	}
}

/**
 * A document message (PDF, Office files, plain text, ...).
 *
 * @example
 * ```ts
 * new DocumentMessage({
 *   link: "https://example.com/invoice-42.pdf",
 *   filename: "invoice-42.pdf",
 *   caption: "Your invoice",
 * });
 * ```
 */
export class DocumentMessage extends BaseMessage<MessageTypeEnum.Document> {
	readonly data: Readonly<DocumentMessageOptions>

	constructor(data: DocumentMessageOptions) {
		super(MessageTypeEnum.Document)
		toMediaSourcePayload(data, 'document')
		assertOptionalText(data.caption, 'caption', MessageLimits.mediaCaption)
		assertOptionalText(data.filename, 'filename')
		this.data = { ...data }
	}

	protected content(): { document: DocumentMediaPayload } {
		return {
			document: {
				...toMediaSourcePayload(this.data, 'document'),
				...compact({ caption: this.data.caption, filename: this.data.filename })
			}
		}
	}
}
