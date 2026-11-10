import {
	type InteractiveHeader,
	InteractiveMessage,
	InteractiveMessageTypeEnum,
	toBodyPayload,
	toFooterPayload,
	toHeaderPayload
} from './interactive'
import { MessageLimits, assertCount, assertText, assertUnique } from './validation'

/** A quick reply button. */
export interface ReplyButton {
	/** Returned in the `button_reply` webhook. Up to 256 characters, unique within the message. */
	id: string
	/** Up to 20 characters. */
	title: string
}

/** Input of {@link ButtonInteractionMessage}. */
export interface ButtonInteractionMessageOptions {
	/** Up to 1024 characters. */
	bodyText: string
	/** One to three buttons. */
	buttons: ReplyButton[]
	/** Text (up to 60 characters), image, video or document header. */
	header?: InteractiveHeader
	/** Up to 60 characters. */
	footerText?: string
}

/**
 * An interactive message with up to three quick reply buttons.
 *
 * @example
 * ```ts
 * new ButtonInteractionMessage({
 *   header: "Order #42",
 *   bodyText: "Did your order arrive?",
 *   footerText: "Reply within 24h",
 *   buttons: [
 *     { id: "yes", title: "Yes" },
 *     { id: "no", title: "No" },
 *   ],
 * });
 * ```
 */
export class ButtonInteractionMessage extends InteractiveMessage<InteractiveMessageTypeEnum.Button> {
	readonly data: Readonly<ButtonInteractionMessageOptions>

	constructor(data: ButtonInteractionMessageOptions) {
		super(InteractiveMessageTypeEnum.Button)
		toBodyPayload(data.bodyText)
		toFooterPayload(data.footerText)
		if (data.header !== undefined) toHeaderPayload(data.header)
		assertCount(data.buttons, 'buttons', 1, MessageLimits.replyButtons)
		data.buttons.forEach((button, index) => {
			assertText(button.id, `buttons[${index}].id`, MessageLimits.replyButtonId)
			assertText(button.title, `buttons[${index}].title`, MessageLimits.replyButtonTitle)
		})
		assertUnique(
			data.buttons.map(button => button.id),
			'buttons[].id'
		)
		this.data = { ...data, buttons: data.buttons.map(button => ({ ...button })) }
	}

	protected interactive(): Record<string, unknown> {
		const { data } = this
		return {
			header: data.header === undefined ? undefined : toHeaderPayload(data.header),
			body: toBodyPayload(data.bodyText),
			footer: toFooterPayload(data.footerText),
			action: {
				buttons: data.buttons.map(button => ({
					type: 'reply',
					reply: { id: button.id, title: button.title }
				}))
			}
		}
	}
}
