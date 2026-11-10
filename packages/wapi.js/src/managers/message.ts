import { type BaseMessage } from '../components/base'
import { ValidationError } from '../errors'
import { type RequestClient } from '../internal/request-client'

/**
 * Who to send a message to. A plain string is treated as a phone number /
 * wa_id. Use `{ userId }` to target a business-scoped user id (BSUID) or
 * parent BSUID, which Meta serialises as `recipient`.
 */
export type MessageTarget = string | { phoneNumber: string } | { userId: string }

/** Raw Cloud API response to a send call, plus a `messageId` shortcut. */
export interface MessageSendResponse {
	messaging_product: 'whatsapp'
	contacts: {
		input: string
		wa_id?: string
		/** Recipient BSUID when the send targeted a BSUID. */
		user_id?: string
	}[]
	messages: {
		id: string
		message_status?:
			| 'accepted'
			| 'held_for_quality_assessment'
			| (string & Record<never, never>)
	}[]
	/** `messages[0].id`, the WhatsApp message id (`wamid.*`). */
	messageId: string
}

export interface SendMessageParams {
	to: MessageTarget
	message: BaseMessage
	/** Quote this message id. */
	replyToMessageId?: string
	/** Echoed back on status webhooks as `bizOpaqueCallbackData`. */
	bizOpaqueCallbackData?: string
	signal?: AbortSignal
}

export interface MarkAsReadOptions {
	/** Also show a typing indicator (dismissed after 25s or when you reply). */
	typingIndicator?: boolean
	signal?: AbortSignal
}

function targetToEnvelope(target: MessageTarget): { to?: string; recipient?: string } {
	if (typeof target === 'string') {
		if (!target) throw new ValidationError('Message target must not be empty')
		return { to: target }
	}
	if ('userId' in target) {
		if (!target.userId) throw new ValidationError('`userId` must not be empty')
		return { recipient: target.userId }
	}
	if (!target.phoneNumber) throw new ValidationError('`phoneNumber` must not be empty')
	return { to: target.phoneNumber }
}

/**
 * Sends messages from one business phone number. Obtain it through
 * `client.messaging(phoneNumberId).message`.
 */
export class MessageManager {
	constructor(
		private readonly requester: RequestClient,
		/** The business phone number id messages are sent from. */
		readonly phoneNumberId: string
	) {}

	/**
	 * Sends a message.
	 *
	 * @throws {GraphApiError} when Meta rejects the request.
	 */
	send(params: SendMessageParams): Promise<MessageSendResponse> {
		return this.dispatch('messages', params)
	}

	/** Sends `message` as a reply quoting `replyToMessageId`. */
	reply(params: SendMessageParams & { replyToMessageId: string }): Promise<MessageSendResponse> {
		return this.dispatch('messages', params)
	}

	/**
	 * Sends a marketing template through the Marketing Messages Lite API
	 * (`/marketing_messages`). The WABA must be onboarded to MM Lite.
	 */
	sendMarketing(params: SendMessageParams): Promise<MessageSendResponse> {
		return this.dispatch('marketing_messages', params)
	}

	/**
	 * Marks an inbound message as read (blue ticks), optionally showing a
	 * typing indicator.
	 */
	async markAsRead(messageId: string, options?: MarkAsReadOptions): Promise<void> {
		if (!messageId) throw new ValidationError('`messageId` is required')
		await this.requester.request<{ success: boolean }>({
			method: 'POST',
			path: `${this.phoneNumberId}/messages`,
			body: {
				messaging_product: 'whatsapp',
				status: 'read',
				message_id: messageId,
				...(options?.typingIndicator ? { typing_indicator: { type: 'text' } } : {})
			},
			signal: options?.signal
		})
	}

	private async dispatch(
		endpoint: 'messages' | 'marketing_messages',
		params: SendMessageParams
	): Promise<MessageSendResponse> {
		const payload = params.message.toJson({
			...targetToEnvelope(params.to),
			replyToMessageId: params.replyToMessageId,
			bizOpaqueCallbackData: params.bizOpaqueCallbackData
		})
		const response = await this.requester.request<Omit<MessageSendResponse, 'messageId'>>({
			method: 'POST',
			path: `${this.phoneNumberId}/${endpoint}`,
			body: payload,
			signal: params.signal
		})
		return {
			...response,
			contacts: response?.contacts ?? [],
			messages: response?.messages ?? [],
			messageId: response?.messages?.[0]?.id ?? ''
		}
	}
}
