import { BaseMessage, MessageTypeEnum, assert } from './base'
import { assertText } from './validation'

/** Input of {@link ReactionMessage}. */
export interface ReactionMessageOptions {
	/** `wamid.*` of the message to react to. */
	messageId: string
	/** A single emoji, or `""` to remove a previous reaction. */
	emoji: string
}

/** Cloud API `reaction` object. */
export interface ReactionMessagePayload {
	message_id: string
	emoji: string
}

/**
 * Reacts to a message with an emoji. Send `emoji: ""` to remove the reaction.
 *
 * @example
 * ```ts
 * new ReactionMessage({ messageId: "wamid.HBgL...", emoji: "👍" });
 * ```
 */
export class ReactionMessage extends BaseMessage<MessageTypeEnum.Reaction> {
	readonly data: Readonly<ReactionMessageOptions>

	constructor(data: ReactionMessageOptions) {
		super(MessageTypeEnum.Reaction)
		assertText(data.messageId, 'messageId')
		assert(typeof data.emoji === 'string', '`emoji` must be a string')
		this.data = { ...data }
	}

	protected content(): { reaction: ReactionMessagePayload } {
		return {
			reaction: { message_id: this.data.messageId, emoji: this.data.emoji }
		}
	}
}
