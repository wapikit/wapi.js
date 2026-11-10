import { BaseMessage, MessageTypeEnum, assert, compact } from './base'
import { assertOptionalText } from './validation'

/** Input of {@link LocationMessage}. */
export interface LocationMessageOptions {
	/** -90 to 90. */
	latitude: number
	/** -180 to 180. */
	longitude: number
	/** Name of the place, for example a store name. */
	name?: string
	/** Street address. */
	address?: string
}

/** Cloud API `location` object. */
export interface LocationMessagePayload {
	latitude: number
	longitude: number
	name?: string
	address?: string
}

/** Asserts a latitude / longitude pair is in range. @internal */
export function assertCoordinates(latitude: unknown, longitude: unknown): void {
	assert(
		typeof latitude === 'number' &&
			Number.isFinite(latitude) &&
			latitude >= -90 &&
			latitude <= 90,
		'`latitude` must be a number between -90 and 90'
	)
	assert(
		typeof longitude === 'number' &&
			Number.isFinite(longitude) &&
			longitude >= -180 &&
			longitude <= 180,
		'`longitude` must be a number between -180 and 180'
	)
}

/**
 * A location pin.
 *
 * @example
 * ```ts
 * new LocationMessage({ latitude: 37.4847, longitude: -122.1477, name: "Meta HQ" });
 * ```
 */
export class LocationMessage extends BaseMessage<MessageTypeEnum.Location> {
	readonly data: Readonly<LocationMessageOptions>

	constructor(data: LocationMessageOptions) {
		super(MessageTypeEnum.Location)
		assertCoordinates(data.latitude, data.longitude)
		assertOptionalText(data.name, 'name')
		assertOptionalText(data.address, 'address')
		this.data = { ...data }
	}

	protected content(): { location: LocationMessagePayload } {
		return {
			location: compact({
				latitude: this.data.latitude,
				longitude: this.data.longitude,
				name: this.data.name,
				address: this.data.address
			})
		}
	}
}
