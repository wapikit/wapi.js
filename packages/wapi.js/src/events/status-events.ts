import { BaseStatusEvent } from './base'

/** Any status update. Emitted as `MessageStatus` for every status, including ones without a dedicated event. */
export class MessageStatusEvent extends BaseStatusEvent {}

/** The message was sent (one grey tick). */
export class MessageSentEvent extends BaseStatusEvent {}

/** The message was delivered to the device (two grey ticks). */
export class MessageDeliveredEvent extends BaseStatusEvent {}

/** The message was read (blue ticks). */
export class MessageReadEvent extends BaseStatusEvent {}

/** The message could not be sent. `error` explains why. */
export class MessageFailedEvent extends BaseStatusEvent {
	/** `errors[0].title`, kept for parity with wapi.go's `FailReason`. */
	get failReason(): string | undefined {
		return this.error?.title ?? this.error?.message
	}
}

/**
 * The message was not delivered: status `undelivered`, or `failed` with error
 * 130472 (recipient is part of a Meta experiment).
 */
export class MessageUndeliveredEvent extends BaseStatusEvent {
	get undeliveredReason(): string | undefined {
		return this.error?.title ?? this.error?.message
	}
}
