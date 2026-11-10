import { ValidationError } from '../errors'
import { DEFAULT_UPLOAD_TIMEOUT_MS, type RequestClient } from '../internal/request-client'

/** MIME types accepted by the Cloud API media endpoint. */
export enum MediaTypeEnum {
	// Audio
	AAC = 'audio/aac',
	AMR = 'audio/amr',
	MP3 = 'audio/mpeg',
	MP4_AUDIO = 'audio/mp4',
	OGG_AUDIO = 'audio/ogg',
	// Document
	TEXT = 'text/plain',
	MS_EXCEL = 'application/vnd.ms-excel',
	MS_EXCEL_X = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	MS_WORD = 'application/msword',
	MS_WORD_X = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	MS_POWERPOINT = 'application/vnd.ms-powerpoint',
	MS_POWERPOINT_X = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	PDF = 'application/pdf',
	// Image
	JPEG = 'image/jpeg',
	PNG = 'image/png',
	// Sticker
	WEBP = 'image/webp',
	// Video
	_3GPP = 'video/3gpp',
	MP4_VIDEO = 'video/mp4'
}

/** Response of `GET /{media-id}`. */
export interface MediaMetadata {
	messaging_product: 'whatsapp'
	/** Short lived (5 minutes) URL; download it with {@link MediaManager.download}. */
	url: string
	mime_type: string
	sha256: string
	file_size: number
	id: string
}

export interface UploadMediaParams {
	/** File contents. */
	file: Blob | ArrayBuffer | Uint8Array
	/** MIME type, for example `"image/png"`. */
	mimeType: MediaTypeEnum | string
	/** File name sent in the multipart part. Defaults to `"file"`. */
	filename?: string
	timeoutMs?: number
	signal?: AbortSignal
}

/**
 * Upload, inspect, download and delete media. Obtain it through
 * `client.messaging(phoneNumberId).media`.
 */
export class MediaManager {
	constructor(
		private readonly requester: RequestClient,
		/** Phone number id uploads are made against. */
		readonly phoneNumberId: string
	) {}

	/**
	 * Uploads a file and returns its media id, usable in media messages for 30 days.
	 */
	async upload(params: UploadMediaParams): Promise<{ id: string }> {
		if (!params.mimeType) throw new ValidationError('`mimeType` is required')
		const blob =
			params.file instanceof Blob
				? params.file
				: new Blob([params.file as BlobPart], { type: params.mimeType })
		const form = new FormData()
		form.append('messaging_product', 'whatsapp')
		form.append('type', params.mimeType)
		form.append('file', new Blob([blob], { type: params.mimeType }), params.filename ?? 'file')
		const response = await this.requester.request<{ id: string }>({
			method: 'POST',
			path: `${this.phoneNumberId}/media`,
			rawBody: form,
			timeoutMs: params.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
			signal: params.signal
		})
		if (!response?.id) {
			throw new ValidationError('Media upload response did not contain an id')
		}
		return { id: response.id }
	}

	/** Returns the metadata (including a short lived download URL) of a media id. */
	getMetadata(mediaId: string, options?: { signal?: AbortSignal }): Promise<MediaMetadata> {
		if (!mediaId) throw new ValidationError('`mediaId` is required')
		return this.requester.request<MediaMetadata>({
			method: 'GET',
			path: mediaId,
			query: { phone_number_id: this.phoneNumberId },
			signal: options?.signal
		})
	}

	/** Returns the short lived download URL of a media id. */
	async getUrl(mediaId: string, options?: { signal?: AbortSignal }): Promise<string> {
		const metadata = await this.getMetadata(mediaId, options)
		if (!metadata?.url) {
			throw new ValidationError(`No media url returned for media ${mediaId}`)
		}
		return metadata.url
	}

	/**
	 * Downloads a media file. Accepts a media id or a URL returned by
	 * {@link getUrl}, and returns its bytes and MIME type.
	 */
	async download(
		mediaIdOrUrl: string,
		options?: { timeoutMs?: number; signal?: AbortSignal }
	): Promise<{ data: ArrayBuffer; mimeType: string }> {
		const url = /^https?:\/\//.test(mediaIdOrUrl)
			? mediaIdOrUrl
			: await this.getUrl(mediaIdOrUrl, options)
		const response = await this.requester.download(url, options)
		return {
			data: await response.arrayBuffer(),
			mimeType: response.headers.get('content-type') ?? 'application/octet-stream'
		}
	}

	/** Deletes an uploaded media file. */
	async delete(mediaId: string, options?: { signal?: AbortSignal }): Promise<void> {
		if (!mediaId) throw new ValidationError('`mediaId` is required')
		await this.requester.request<{ success: boolean }>({
			method: 'DELETE',
			path: mediaId,
			query: { phone_number_id: this.phoneNumberId },
			signal: options?.signal
		})
	}
}
