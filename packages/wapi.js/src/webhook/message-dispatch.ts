import {
	type BusinessPhoneNumber,
	type MessageEventInit,
	type StatusEventInit
} from '../events/base'
import {
	AdInteractionEvent,
	AudioMessageEvent,
	ContactMessageEvent,
	CustomerIdentityChangedEvent,
	CustomerNumberChangedEvent,
	DocumentMessageEvent,
	FlowCompletionEvent,
	ImageMessageEvent,
	ListInteractionEvent,
	LocationMessageEvent,
	OrderMessageEvent,
	ProductInquiryEvent,
	QuickReplyButtonInteractionEvent,
	ReactionEvent,
	ReplyButtonInteractionEvent,
	StickerMessageEvent,
	TextMessageEvent,
	UnsupportedMessageEvent,
	VideoMessageEvent
} from '../events/message-events'
import {
	MessageDeliveredEvent,
	MessageFailedEvent,
	MessageReadEvent,
	MessageSentEvent,
	MessageStatusEvent,
	MessageUndeliveredEvent
} from '../events/status-events'
import { type DispatchContext } from './dispatch-context'
import {
	type InboundMessage,
	type InboundStatus,
	type MessagesValue,
	type SenderContact,
	type WebhookEntry
} from './payload'

/** Error code Meta uses for "not delivered to keep healthy ecosystem engagement". */
const UNDELIVERED_ERROR_CODE = 130472

function errorOf(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}

function isMessagesValue(value: unknown): value is MessagesValue {
	if (!value || typeof value !== 'object') return false
	const metadata = (value as { metadata?: unknown }).metadata
	return (
		!!metadata &&
		typeof metadata === 'object' &&
		typeof (metadata as { phone_number_id?: unknown }).phone_number_id === 'string'
	)
}

/**
 * Finds the sender contact of a message. Meta sends one contact per message
 * in practice; match by wa_id / user_id and fall back to the first one.
 */
function senderOf(
	contacts: SenderContact[] | undefined,
	message: InboundMessage
): SenderContact | undefined {
	if (!contacts || contacts.length === 0) return undefined
	return (
		contacts.find(
			contact =>
				(contact.wa_id && contact.wa_id === message.from) ||
				(contact.user_id && contact.user_id === message.from_user_id)
		) ?? contacts[0]
	)
}

/**
 * Dispatches a `messages` change: status updates and inbound messages.
 * Each status / message is handled in isolation, so one bad item never stops
 * the rest of the batch from being delivered.
 */
export function dispatchMessagesChange(
	context: DispatchContext,
	entry: WebhookEntry,
	value: unknown
): void {
	if (!isMessagesValue(value)) {
		context.logger.error('skipping undecodable webhook change', { field: 'messages' })
		context.emit(
			'Error',
			new Error('Webhook `messages` change without metadata.phone_number_id')
		)
		return
	}

	const phoneNumber: BusinessPhoneNumber = {
		id: value.metadata.phone_number_id,
		displayPhoneNumber: value.metadata.display_phone_number
	}
	const businessAccountId = entry.id

	for (const status of value.statuses ?? []) {
		try {
			dispatchStatus(context, { businessAccountId, phoneNumber, status })
		} catch (error) {
			context.logger.error('skipping webhook status', { messageId: status?.id, error })
			context.emit('Error', errorOf(error))
		}
	}

	if (!value.messages?.length) return
	const messaging = context.messagingFor(phoneNumber.id)
	for (const message of value.messages) {
		try {
			const sender = senderOf(value.contacts, message)
			dispatchMessage(context, {
				messaging,
				businessAccountId,
				phoneNumber,
				message,
				sender: {
					name: sender?.profile?.name,
					username: sender?.profile?.username,
					waId: sender?.wa_id,
					userId: sender?.user_id,
					parentUserId: sender?.parent_user_id
				}
			})
		} catch (error) {
			context.logger.error('skipping webhook message', {
				messageId: message?.id,
				type: message?.type,
				error
			})
			context.emit('Error', errorOf(error))
		}
	}
}

function dispatchStatus(context: DispatchContext, init: StatusEventInit): void {
	const status: InboundStatus = init.status
	context.emit('MessageStatus', new MessageStatusEvent(init))
	switch (status.status) {
		case 'sent':
			context.emit('MessageSent', new MessageSentEvent(init))
			return
		case 'delivered':
			context.emit('MessageDelivered', new MessageDeliveredEvent(init))
			return
		case 'read':
			context.emit('MessageRead', new MessageReadEvent(init))
			return
		case 'undelivered':
			context.emit('MessageUndelivered', new MessageUndeliveredEvent(init))
			return
		case 'failed':
			if (status.errors?.some(error => error.code === UNDELIVERED_ERROR_CODE)) {
				context.emit('MessageUndelivered', new MessageUndeliveredEvent(init))
			} else {
				context.emit('MessageFailed', new MessageFailedEvent(init))
			}
			return
		default:
			// deleted, warning, ... are delivered through `MessageStatus` only.
			return
	}
}

function dispatchMessage(context: DispatchContext, init: MessageEventInit): void {
	const message = init.message

	if (message.referral) {
		context.emit('AdInteraction', new AdInteractionEvent(init))
	}

	switch (message.type) {
		case 'text':
			if (message.context?.referred_product) {
				context.emit('ProductInquiry', new ProductInquiryEvent(init))
			} else {
				context.emit('TextMessage', new TextMessageEvent(init))
			}
			return
		case 'image':
			context.emit('ImageMessage', new ImageMessageEvent(init))
			return
		case 'audio':
			context.emit('AudioMessage', new AudioMessageEvent(init))
			return
		case 'video':
			context.emit('VideoMessage', new VideoMessageEvent(init))
			return
		case 'document':
			context.emit('DocumentMessage', new DocumentMessageEvent(init))
			return
		case 'sticker':
			context.emit('StickerMessage', new StickerMessageEvent(init))
			return
		case 'location':
			context.emit('LocationMessage', new LocationMessageEvent(init))
			return
		case 'contacts':
			context.emit('ContactsMessage', new ContactMessageEvent(init))
			return
		case 'reaction':
			context.emit('Reaction', new ReactionEvent(init))
			return
		case 'button':
			context.emit('QuickReplyButtonInteraction', new QuickReplyButtonInteractionEvent(init))
			return
		case 'interactive':
			switch (message.interactive?.type) {
				case 'button_reply':
					context.emit('ReplyButtonInteraction', new ReplyButtonInteractionEvent(init))
					return
				case 'list_reply':
					context.emit('ListInteraction', new ListInteractionEvent(init))
					return
				case 'nfm_reply':
					context.emit('FlowCompletion', new FlowCompletionEvent(init))
					return
				default:
					context.emit('UnsupportedMessage', new UnsupportedMessageEvent(init))
					return
			}
		case 'order':
			context.emit('OrderReceived', new OrderMessageEvent(init))
			return
		case 'system':
			if (message.system?.type === 'user_changed_number') {
				context.emit('CustomerNumberChanged', new CustomerNumberChangedEvent(init))
			} else if (message.system?.type === 'customer_identity_changed' || message.identity) {
				context.emit('CustomerIdentityChanged', new CustomerIdentityChangedEvent(init))
			} else {
				context.emit('UnsupportedMessage', new UnsupportedMessageEvent(init))
			}
			return
		default:
			// "unsupported", "unknown" and any type Meta adds in the future.
			context.emit('UnsupportedMessage', new UnsupportedMessageEvent(init))
			return
	}
}
