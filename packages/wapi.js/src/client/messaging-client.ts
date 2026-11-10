import { type RequestClient } from '../internal/request-client'
import { MediaManager } from '../managers/media'
import {
	type MarkAsReadOptions,
	MessageManager,
	type MessageSendResponse,
	type SendMessageParams
} from '../managers/message'

/**
 * Everything scoped to one business phone number: sending messages and
 * managing media. Get one with `client.messaging(phoneNumberId)`; instances
 * are cached, so calling it repeatedly is cheap.
 *
 * Mirrors wapi.go's `MessagingClient`.
 */
export class MessagingClient {
	/** Send, reply, mark as read. */
	readonly message: MessageManager
	/** Upload, download, delete media. */
	readonly media: MediaManager

	constructor(
		requester: RequestClient,
		/** The business phone number id this client sends from. */
		readonly phoneNumberId: string
	) {
		if (!phoneNumberId) {
			throw new TypeError('wapi.js: `phoneNumberId` is required')
		}
		this.message = new MessageManager(requester, phoneNumberId)
		this.media = new MediaManager(requester, phoneNumberId)
	}

	/** Shortcut for `message.send`. */
	send(params: SendMessageParams): Promise<MessageSendResponse> {
		return this.message.send(params)
	}

	/** Shortcut for `message.markAsRead`. */
	markAsRead(messageId: string, options?: MarkAsReadOptions): Promise<void> {
		return this.message.markAsRead(messageId, options)
	}
}
