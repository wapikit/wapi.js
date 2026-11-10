import { ValidationError } from '../errors'
import type { GraphField, RequestClient } from '../internal/request-client'
import type { RequestOptions, SuccessResponse } from './business'
import { collectAll, paginationQuery, type Paginated, type PaginationInput } from './pagination'

export enum PhoneNumberCodeVerificationStatus {
	Verified = 'VERIFIED',
	NotVerified = 'NOT_VERIFIED',
	Expired = 'EXPIRED'
}

export enum PhoneNumberMessagingLimitTier {
	Tier50 = 'TIER_50',
	Tier250 = 'TIER_250',
	Tier1K = 'TIER_1K',
	Tier10K = 'TIER_10K',
	Tier100K = 'TIER_100K',
	TierUnlimited = 'TIER_UNLIMITED'
}

export enum PhoneNumberNameStatus {
	Approved = 'APPROVED',
	AvailableWithoutReview = 'AVAILABLE_WITHOUT_REVIEW',
	Declined = 'DECLINED',
	Expired = 'EXPIRED',
	NonExists = 'NON_EXISTS',
	None = 'NONE',
	PendingReview = 'PENDING_REVIEW'
}

export enum PhoneNumberPlatformType {
	CloudApi = 'CLOUD_API',
	NotApplicable = 'NOT_APPLICABLE',
	OnPremise = 'ON_PREMISE'
}

export enum PhoneNumberStatus {
	Pending = 'PENDING',
	Deleted = 'DELETED',
	Migrated = 'MIGRATED',
	Banned = 'BANNED',
	Restricted = 'RESTRICTED',
	RateLimited = 'RATE_LIMITED',
	Flagged = 'FLAGGED',
	Connected = 'CONNECTED',
	Disconnected = 'DISCONNECTED',
	Unknown = 'UNKNOWN',
	Unverified = 'UNVERIFIED'
}

export enum PhoneNumberAccountMode {
	Live = 'LIVE',
	Sandbox = 'SANDBOX'
}

export enum PhoneNumberQualityRating {
	Green = 'GREEN',
	Yellow = 'YELLOW',
	Red = 'RED',
	Unknown = 'UNKNOWN',
	NotApplicable = 'NA'
}

/** How the verification code is delivered. */
export enum VerifyCodeMethod {
	Sms = 'SMS',
	Voice = 'VOICE'
}

/** QR code image format. */
export enum QrImageFormat {
	Png = 'PNG',
	Svg = 'SVG'
}

/** Business profile industry. */
export enum BusinessProfileVertical {
	Undefined = 'UNDEFINED',
	Other = 'OTHER',
	Auto = 'AUTO',
	Beauty = 'BEAUTY',
	Apparel = 'APPAREL',
	Edu = 'EDU',
	Entertain = 'ENTERTAIN',
	EventPlan = 'EVENT_PLAN',
	Finance = 'FINANCE',
	Grocery = 'GROCERY',
	Govt = 'GOVT',
	Hotel = 'HOTEL',
	Health = 'HEALTH',
	Nonprofit = 'NONPROFIT',
	ProfServices = 'PROF_SERVICES',
	Retail = 'RETAIL',
	Travel = 'TRAVEL',
	Restaurant = 'RESTAURANT',
	NotABiz = 'NOT_A_BIZ'
}

export interface PhoneNumberHealthStatusError {
	error_code: number
	error_description: string
	possible_solution?: string
}

export interface PhoneNumberHealthStatus {
	can_send_message: string
	entities: {
		entity_type: string
		id: string
		can_send_message?: string
		can_receive_call_sip?: string
		errors?: PhoneNumberHealthStatusError[]
	}[]
}

export interface ConversationalAutomation {
	id?: string
	enable_welcome_message?: boolean
	prompts?: string[]
	commands?: { command_name: string; command_description: string }[]
}

/** A business phone number. */
export interface PhoneNumber {
	id: string
	verified_name?: string
	display_phone_number?: string
	quality_rating?: PhoneNumberQualityRating | `${PhoneNumberQualityRating}`
	code_verification_status?:
		| PhoneNumberCodeVerificationStatus
		| `${PhoneNumberCodeVerificationStatus}`
	status?: PhoneNumberStatus | `${PhoneNumberStatus}`
	platform_type?: PhoneNumberPlatformType | `${PhoneNumberPlatformType}`
	country_dial_code?: string
	search_visibility?: string
	certificate?: string
	conversational_automation?: ConversationalAutomation
	health_status?: PhoneNumberHealthStatus
	is_official_business_account?: boolean
	is_on_biz_app?: boolean
	is_pin_enabled?: boolean
	is_preverified_number?: boolean
	last_onboarded_time?: string
	messaging_limit_tier?: PhoneNumberMessagingLimitTier | `${PhoneNumberMessagingLimitTier}`
	name_status?: PhoneNumberNameStatus | `${PhoneNumberNameStatus}`
	new_certificate?: string
	new_display_name?: string
	new_name_status?: PhoneNumberNameStatus | `${PhoneNumberNameStatus}`
	eligibility_for_api_business_global_search?: string
	account_mode?: PhoneNumberAccountMode | `${PhoneNumberAccountMode}`
	throughput?: { level: string }
	official_business_account?: { oba_status: string }
	quality_score?: { score: string }
}

/** Fields requested for phone numbers (same list as wapi.go, each once). */
export const PHONE_NUMBER_FIELDS = [
	'id',
	'account_mode',
	'certificate',
	'code_verification_status',
	'conversational_automation',
	'display_phone_number',
	'health_status',
	'eligibility_for_api_business_global_search',
	'is_official_business_account',
	'is_on_biz_app',
	'is_pin_enabled',
	'is_preverified_number',
	'last_onboarded_time',
	'messaging_limit_tier',
	'name_status',
	'new_certificate',
	'new_display_name',
	'new_name_status',
	'official_business_account',
	'platform_type',
	'quality_score',
	'search_visibility',
	'status',
	'throughput',
	'verified_name'
] as const

export interface ListPhoneNumbersParams extends PaginationInput, RequestOptions {
	/**
	 * `true` lists only SANDBOX numbers. Default (`false`): only LIVE numbers,
	 * matching wapi.go, which always filters on `account_mode = LIVE`.
	 */
	sandbox?: boolean
}

export interface ListAllPhoneNumbersParams
	extends Omit<ListPhoneNumbersParams, 'after' | 'before'> {
	maxItems?: number
}

export interface CreatePhoneNumberParams extends RequestOptions {
	/** Number without the country code. */
	phoneNumber: string
	/** Country calling code, for example `"1"`. */
	countryCode: string
	verifiedName: string
}

export interface RequestVerificationCodeParams extends RequestOptions {
	codeMethod: VerifyCodeMethod | `${VerifyCodeMethod}`
	/** Language of the SMS / voice message, for example `"en_US"`. */
	language: string
}

export interface RegisterParams extends RequestOptions {
	/** ISO country code of the local storage region, when using local storage. */
	dataLocalizationRegion?: string
}

/** A WhatsApp QR code / short link with a prefilled message. */
export interface QrCode {
	code: string
	prefilled_message: string
	deep_link_url: string
	/** Present when an image format was requested. */
	qr_image_url?: string
}

export interface CreateQrCodeParams extends RequestOptions {
	prefilledMessage: string
	/** Defaults to PNG, as in wapi.go. */
	imageFormat?: QrImageFormat | `${QrImageFormat}`
}

export interface QrCodeReadParams extends RequestOptions {
	/** Also return `qr_image_url` in this format. */
	imageFormat?: QrImageFormat | `${QrImageFormat}`
}

export interface UpdateQrCodeParams extends RequestOptions {
	prefilledMessage: string
}

export interface BusinessUsername {
	id?: string
	/** Empty when no username is set. */
	username?: string
}

/** WhatsApp business profile (`/{phone-number-id}/whatsapp_business_profile`). */
export interface BusinessProfile {
	messaging_product?: 'whatsapp'
	about?: string
	address?: string
	description?: string
	email?: string
	profile_picture_url?: string
	vertical?: BusinessProfileVertical | `${BusinessProfileVertical}`
	websites?: string[]
}

/** Body of a business profile update. Unset keys are left unchanged. */
export interface BusinessProfileUpdate {
	about?: string
	address?: string
	description?: string
	email?: string
	/** Handle from the resumable upload API. */
	profile_picture_handle?: string
	vertical?: BusinessProfileVertical | `${BusinessProfileVertical}`
	/** Up to two URLs, including `http://` or `https://`. */
	websites?: string[]
}

export const BUSINESS_PROFILE_FIELDS = [
	'about',
	'address',
	'description',
	'email',
	'profile_picture_url',
	'websites',
	'vertical'
] as const

const LIST_DEFAULT_LIMIT = 100

/**
 * Phone numbers of a WhatsApp Business Account and per-number settings:
 * registration, verification, two-step PIN, QR codes, username and business
 * profile.
 */
export class PhoneNumberManager {
	constructor(
		private readonly requester: RequestClient,
		readonly businessAccountId: string
	) {}

	/** Lists one page of the WABA's phone numbers. `GET /{waba-id}/phone_numbers`. */
	async list(params?: ListPhoneNumbersParams): Promise<Paginated<PhoneNumber>> {
		const mode = params?.sandbox ? PhoneNumberAccountMode.Sandbox : PhoneNumberAccountMode.Live
		return this.requester.request<Paginated<PhoneNumber>>({
			method: 'GET',
			path: `${this.businessAccountId}/phone_numbers`,
			fields: [...PHONE_NUMBER_FIELDS],
			query: {
				...paginationQuery(params, LIST_DEFAULT_LIMIT),
				filtering: JSON.stringify([
					{ field: 'account_mode', operator: 'EQUAL', value: mode }
				])
			},
			signal: params?.signal
		})
	}

	/** Lists every phone number across all pages. `GET /{waba-id}/phone_numbers`. */
	async listAll(params?: ListAllPhoneNumbersParams): Promise<PhoneNumber[]> {
		const { maxItems, limit, ...rest } = params ?? {}
		return collectAll(page => this.list({ ...rest, ...page }), {
			limit: limit ?? LIST_DEFAULT_LIMIT,
			maxItems
		})
	}

	/** Fetches one phone number. `GET /{phone-number-id}`. */
	async get(phoneNumberId: string, options?: RequestOptions): Promise<PhoneNumber> {
		requireId(phoneNumberId, 'phoneNumberId')
		return this.requester.request<PhoneNumber>({
			method: 'GET',
			path: phoneNumberId,
			fields: [...PHONE_NUMBER_FIELDS],
			signal: options?.signal
		})
	}

	/** Adds a phone number to the WABA. `POST /{waba-id}/phone_numbers`. */
	async create(params: CreatePhoneNumberParams): Promise<{ id: string }> {
		if (!params.phoneNumber) throw new ValidationError('`phoneNumber` is required')
		if (!params.countryCode) throw new ValidationError('`countryCode` is required')
		if (!params.verifiedName) throw new ValidationError('`verifiedName` is required')
		return this.requester.request<{ id: string }>({
			method: 'POST',
			path: `${this.businessAccountId}/phone_numbers`,
			query: {
				cc: params.countryCode,
				phone_number: params.phoneNumber,
				verified_name: params.verifiedName
			},
			signal: params.signal
		})
	}

	/** Sends a verification code by SMS or voice. `POST /{phone-number-id}/request_code`. */
	async requestVerificationCode(
		phoneNumberId: string,
		params: RequestVerificationCodeParams
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		if (!params.codeMethod) throw new ValidationError('`codeMethod` is required')
		if (!params.language) throw new ValidationError('`language` is required')
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${phoneNumberId}/request_code`,
			query: { code_method: params.codeMethod, language: params.language },
			signal: params.signal
		})
	}

	/** Verifies the code received by SMS or voice. `POST /{phone-number-id}/verify_code`. */
	async verifyCode(
		phoneNumberId: string,
		code: string,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		if (!code) throw new ValidationError('`code` is required')
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${phoneNumberId}/verify_code`,
			query: { code },
			signal: options?.signal
		})
	}

	/**
	 * Registers the number for the Cloud API, setting (or reusing) its six digit
	 * two-step PIN. `POST /{phone-number-id}/register`.
	 */
	async register(
		phoneNumberId: string,
		pin: string,
		options?: RegisterParams
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		requirePin(pin)
		const body: {
			messaging_product: 'whatsapp'
			pin: string
			data_localization_region?: string
		} = {
			messaging_product: 'whatsapp',
			pin
		}
		if (options?.dataLocalizationRegion) {
			body.data_localization_region = options.dataLocalizationRegion
		}
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${phoneNumberId}/register`,
			body,
			signal: options?.signal
		})
	}

	/** Deregisters the number from the Cloud API. `POST /{phone-number-id}/deregister`. */
	async deregister(phoneNumberId: string, options?: RequestOptions): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${phoneNumberId}/deregister`,
			signal: options?.signal
		})
	}

	/** Sets or changes the six digit two-step verification PIN. `POST /{phone-number-id}`. */
	async setTwoStepVerificationPin(
		phoneNumberId: string,
		pin: string,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		requirePin(pin)
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: phoneNumberId,
			body: { pin },
			signal: options?.signal
		})
	}

	/** Creates a QR code with a prefilled message. `POST /{phone-number-id}/message_qrdls`. */
	async createQrCode(phoneNumberId: string, params: CreateQrCodeParams): Promise<QrCode> {
		requireId(phoneNumberId, 'phoneNumberId')
		if (!params.prefilledMessage) throw new ValidationError('`prefilledMessage` is required')
		return this.requester.request<QrCode>({
			method: 'POST',
			path: `${phoneNumberId}/message_qrdls`,
			body: {
				prefilled_message: params.prefilledMessage,
				generate_qr_image: params.imageFormat ?? QrImageFormat.Png
			},
			signal: params.signal
		})
	}

	/** Lists the number's QR codes. `GET /{phone-number-id}/message_qrdls`. */
	async listQrCodes(
		phoneNumberId: string,
		params?: QrCodeReadParams
	): Promise<Paginated<QrCode>> {
		requireId(phoneNumberId, 'phoneNumberId')
		return this.requester.request<Paginated<QrCode>>({
			method: 'GET',
			path: `${phoneNumberId}/message_qrdls`,
			fields: qrFields(params?.imageFormat),
			signal: params?.signal
		})
	}

	/**
	 * Fetches one QR code, or `undefined` when Meta returns none.
	 * `GET /{phone-number-id}/message_qrdls/{code}`.
	 */
	async getQrCode(
		phoneNumberId: string,
		code: string,
		params?: QrCodeReadParams
	): Promise<QrCode | undefined> {
		requireId(phoneNumberId, 'phoneNumberId')
		requireId(code, 'code')
		const page = await this.requester.request<Paginated<QrCode>>({
			method: 'GET',
			path: `${phoneNumberId}/message_qrdls/${encodeURIComponent(code)}`,
			fields: qrFields(params?.imageFormat),
			signal: params?.signal
		})
		return page?.data?.[0]
	}

	/** Changes a QR code's prefilled message. `POST /{phone-number-id}/message_qrdls`. */
	async updateQrCode(
		phoneNumberId: string,
		code: string,
		params: UpdateQrCodeParams
	): Promise<QrCode> {
		requireId(phoneNumberId, 'phoneNumberId')
		requireId(code, 'code')
		if (!params.prefilledMessage) throw new ValidationError('`prefilledMessage` is required')
		return this.requester.request<QrCode>({
			method: 'POST',
			path: `${phoneNumberId}/message_qrdls`,
			body: { code, prefilled_message: params.prefilledMessage },
			signal: params.signal
		})
	}

	/** Deletes a QR code. `DELETE /{phone-number-id}/message_qrdls/{code}`. */
	async deleteQrCode(
		phoneNumberId: string,
		code: string,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		requireId(code, 'code')
		return this.requester.request<SuccessResponse>({
			method: 'DELETE',
			path: `${phoneNumberId}/message_qrdls/${encodeURIComponent(code)}`,
			signal: options?.signal
		})
	}

	/** Fetches the number's business username. `GET /{phone-number-id}/username`. */
	async getUsername(phoneNumberId: string, options?: RequestOptions): Promise<BusinessUsername> {
		requireId(phoneNumberId, 'phoneNumberId')
		return this.requester.request<BusinessUsername>({
			method: 'GET',
			path: `${phoneNumberId}/username`,
			signal: options?.signal
		})
	}

	/** Sets or changes the business username. `POST /{phone-number-id}/username`. */
	async setUsername(
		phoneNumberId: string,
		username: string,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		if (!username) throw new ValidationError('`username` is required')
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${phoneNumberId}/username`,
			body: { username },
			signal: options?.signal
		})
	}

	/** Removes the business username. `DELETE /{phone-number-id}/username`. */
	async deleteUsername(
		phoneNumberId: string,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		return this.requester.request<SuccessResponse>({
			method: 'DELETE',
			path: `${phoneNumberId}/username`,
			signal: options?.signal
		})
	}

	/**
	 * Fetches the number's business profile, or `undefined` when Meta returns
	 * none. `GET /{phone-number-id}/whatsapp_business_profile`.
	 */
	async getBusinessProfile(
		phoneNumberId: string,
		options?: RequestOptions
	): Promise<BusinessProfile | undefined> {
		requireId(phoneNumberId, 'phoneNumberId')
		const page = await this.requester.request<{ data?: BusinessProfile[] }>({
			method: 'GET',
			path: `${phoneNumberId}/whatsapp_business_profile`,
			fields: [...BUSINESS_PROFILE_FIELDS],
			signal: options?.signal
		})
		return page?.data?.[0]
	}

	/** Updates the number's business profile. `POST /{phone-number-id}/whatsapp_business_profile`. */
	async updateBusinessProfile(
		phoneNumberId: string,
		profile: BusinessProfileUpdate,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(phoneNumberId, 'phoneNumberId')
		if (profile.websites && profile.websites.length > 2) {
			throw new ValidationError('a business profile accepts at most 2 `websites`')
		}
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${phoneNumberId}/whatsapp_business_profile`,
			body: { messaging_product: 'whatsapp', ...profile },
			signal: options?.signal
		})
	}
}

function qrFields(
	imageFormat: QrImageFormat | `${QrImageFormat}` | undefined
): (string | GraphField)[] | undefined {
	if (!imageFormat) return undefined
	return [
		'code',
		'prefilled_message',
		'deep_link_url',
		{ name: 'qr_image_url', modifiers: { format: imageFormat } }
	]
}

function requireId(value: string, name: string): void {
	if (!value) throw new ValidationError(`\`${name}\` is required`)
}

function requirePin(pin: string): void {
	if (!/^\d{6}$/.test(pin ?? '')) {
		throw new ValidationError('`pin` must be exactly 6 digits')
	}
}
