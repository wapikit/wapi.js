import { ValidationError } from '../errors'
import type { GraphField, RequestClient } from '../internal/request-client'
import type { Paginated } from './pagination'

/** Options accepted by every manager method. */
export interface RequestOptions {
	/** Aborts the request. */
	signal?: AbortSignal
}

/** `{ "success": true }` style response. */
export interface SuccessResponse {
	success: boolean
}

/** A point in time: a `Date`, or a Unix timestamp in **seconds**. */
export type Timestamp = Date | number

/** Granularity of {@link BusinessAccountManager.analytics}. */
export enum AnalyticsGranularity {
	HalfHour = 'HALF_HOUR',
	Day = 'DAY',
	Month = 'MONTH'
}

/** Granularity of conversation and pricing analytics. */
export enum ConversationAnalyticsGranularity {
	HalfHour = 'HALF_HOUR',
	Daily = 'DAILY',
	Monthly = 'MONTHLY'
}

export enum ConversationCategory {
	Authentication = 'AUTHENTICATION',
	Marketing = 'MARKETING',
	Service = 'SERVICE',
	Utility = 'UTILITY'
}

export enum ConversationType {
	FreeEntry = 'FREE_ENTRY',
	FreeTier = 'FREE_TIER',
	Regular = 'REGULAR'
}

export enum ConversationDirection {
	BusinessInitiated = 'BUSINESS_INITIATED',
	UserInitiated = 'USER_INITIATED'
}

export enum ConversationDimension {
	ConversationCategory = 'CONVERSATION_CATEGORY',
	ConversationDirection = 'CONVERSATION_DIRECTION',
	ConversationType = 'CONVERSATION_TYPE',
	Country = 'COUNTRY',
	Phone = 'PHONE'
}

export enum PricingAnalyticsMetricType {
	Cost = 'COST',
	Volume = 'VOLUME'
}

export enum PricingType {
	FreeCustomerService = 'FREE_CUSTOMER_SERVICE',
	FreeEntryPoint = 'FREE_ENTRY_POINT',
	Regular = 'REGULAR'
}

export enum PricingCategory {
	Authentication = 'AUTHENTICATION',
	AuthenticationInternational = 'AUTHENTICATION_INTERNATIONAL',
	Marketing = 'MARKETING',
	MarketingLite = 'MARKETING_LITE',
	Service = 'SERVICE',
	Utility = 'UTILITY'
}

export enum PricingAnalyticsDimension {
	Country = 'COUNTRY',
	Phone = 'PHONE',
	PricingCategory = 'PRICING_CATEGORY',
	PricingType = 'PRICING_TYPE',
	Tier = 'TIER'
}

/** Roles a user can hold on a WABA. */
export enum BusinessRole {
	Manage = 'MANAGE',
	Develop = 'DEVELOP',
	ManageTemplates = 'MANAGE_TEMPLATES',
	ManagePhone = 'MANAGE_PHONE',
	ViewCost = 'VIEW_COST',
	ManageExtensions = 'MANAGE_EXTENSIONS',
	ViewPhoneAssets = 'VIEW_PHONE_ASSETS',
	ManagePhoneAssets = 'MANAGE_PHONE_ASSETS',
	ViewTemplates = 'VIEW_TEMPLATES',
	Messaging = 'MESSAGING',
	ManageBusinessPhones = 'MANAGE_BUSINESS_PHONES'
}

/** Response of `GET /{waba-id}` with {@link WABA_FIELDS}. */
export interface BusinessAccount {
	id: string
	name?: string
	timezone_id?: string
	currency?: string
	message_template_namespace?: string
	/** `PENDING`, `APPROVED` or `REJECTED`. */
	account_review_status?: string
	business_verification_status?: string
	country?: string
	ownership_type?: string
	primary_business_location?: string
	owner_business_info?: { id: string; name: string }
	marketing_messages_onboarding_status?: string
}

/** Fields requested by {@link BusinessAccountManager.fetch} (same list as wapi.go). */
export const WABA_FIELDS = [
	'id',
	'name',
	'timezone_id',
	'message_template_namespace',
	'account_review_status',
	'business_verification_status',
	'country',
	'ownership_type',
	'primary_business_location',
	'currency',
	'owner_business_info',
	'marketing_messages_onboarding_status'
] as const

export interface AnalyticsParams extends RequestOptions {
	start: Timestamp
	end: Timestamp
	granularity: AnalyticsGranularity | `${AnalyticsGranularity}`
	/** Display phone numbers to include. Empty or omitted means all. */
	phoneNumbers?: string[]
	/** ISO country codes to include. Empty or omitted means all. */
	countryCodes?: string[]
}

export interface AnalyticsDataPoint {
	start: number
	end: number
	sent?: number
	delivered?: number
}

/** Response of the `analytics` field of `GET /{waba-id}`. */
export interface AnalyticsResponse {
	id: string
	analytics?: {
		phone_numbers?: string[]
		country_codes?: string[]
		granularity?: string
		data_points?: AnalyticsDataPoint[]
	}
}

export interface ConversationAnalyticsParams extends RequestOptions {
	start: Timestamp
	end: Timestamp
	granularity: ConversationAnalyticsGranularity | `${ConversationAnalyticsGranularity}`
	phoneNumbers?: string[]
	conversationCategories?: (ConversationCategory | `${ConversationCategory}`)[]
	conversationTypes?: (ConversationType | `${ConversationType}`)[]
	conversationDirections?: (ConversationDirection | `${ConversationDirection}`)[]
	dimensions?: (ConversationDimension | `${ConversationDimension}`)[]
}

export interface ConversationAnalyticsDataPoint {
	start: number
	end: number
	conversation?: number
	phone_number?: string
	country?: string
	conversation_type?: string
	conversation_direction?: string
	conversation_category?: string
	/** Approximate charge, in the WABA currency. */
	cost?: number
}

/** Response of the `conversation_analytics` field of `GET /{waba-id}`. */
export interface ConversationAnalyticsResponse {
	id: string
	conversation_analytics?: Paginated<{ data_points: ConversationAnalyticsDataPoint[] }>
}

export interface PricingAnalyticsParams extends RequestOptions {
	start: Timestamp
	end: Timestamp
	granularity: ConversationAnalyticsGranularity | `${ConversationAnalyticsGranularity}`
	phoneNumbers?: string[]
	countryCodes?: string[]
	metricTypes?: (PricingAnalyticsMetricType | `${PricingAnalyticsMetricType}`)[]
	pricingTypes?: (PricingType | `${PricingType}`)[]
	pricingCategories?: (PricingCategory | `${PricingCategory}`)[]
	dimensions?: (PricingAnalyticsDimension | `${PricingAnalyticsDimension}`)[]
}

export interface PricingAnalyticsDataPoint {
	start: number
	end: number
	volume?: number
	cost?: number
	phone_number?: string
	country?: string
	pricing_type?: string
	pricing_category?: string
	tier?: string
}

/** Response of the `pricing_analytics` field of `GET /{waba-id}`. */
export interface PricingAnalyticsResponse {
	id: string
	pricing_analytics?: Paginated<{ data_points: PricingAnalyticsDataPoint[] }>
}

/** An app subscribed to the WABA's webhooks. */
export interface SubscribedApp {
	whatsapp_business_api_data: { id: string; name?: string; link?: string }
	override_callback_uri?: string
}

export interface SubscribeAppParams extends RequestOptions {
	/** Per-WABA webhook URL that overrides the app's callback URL. */
	overrideCallbackUri?: string
	/** Verify token for `overrideCallbackUri`. Required with it. */
	verifyToken?: string
}

/**
 * WhatsApp Business Account level calls: account details, analytics and
 * webhook app subscriptions.
 */
export class BusinessAccountManager {
	constructor(
		private readonly requester: RequestClient,
		readonly businessAccountId: string
	) {}

	/** Fetches the WABA's details. `GET /{waba-id}?fields=...`. */
	async fetch(options?: RequestOptions): Promise<BusinessAccount> {
		return this.requester.request<BusinessAccount>({
			method: 'GET',
			path: this.businessAccountId,
			fields: [...WABA_FIELDS],
			signal: options?.signal
		})
	}

	/**
	 * Fetches sent/delivered message counts. `GET /{waba-id}?fields=analytics...`.
	 * List filters are rendered as Meta documents them: JSON arrays, `[]` when empty.
	 */
	async analytics(params: AnalyticsParams): Promise<AnalyticsResponse> {
		const field: GraphField = {
			name: 'analytics',
			modifiers: {
				start: toUnixSeconds(params.start, 'start'),
				end: toUnixSeconds(params.end, 'end'),
				granularity: requireValue(params.granularity, 'granularity'),
				phone_numbers: listModifier(params.phoneNumbers),
				country_codes: listModifier(params.countryCodes)
			}
		}
		return this.requester.request<AnalyticsResponse>({
			method: 'GET',
			path: this.businessAccountId,
			fields: [field],
			signal: params.signal
		})
	}

	/**
	 * Fetches conversation counts and cost. `GET /{waba-id}?fields=conversation_analytics...`.
	 * Filter names and list rendering follow Meta's docs (wapi.go uses singular names and comma lists).
	 */
	async conversationAnalytics(
		params: ConversationAnalyticsParams
	): Promise<ConversationAnalyticsResponse> {
		const field: GraphField = {
			name: 'conversation_analytics',
			modifiers: {
				start: toUnixSeconds(params.start, 'start'),
				end: toUnixSeconds(params.end, 'end'),
				granularity: requireValue(params.granularity, 'granularity'),
				phone_numbers: listModifier(params.phoneNumbers),
				conversation_categories: listModifier(params.conversationCategories),
				conversation_types: listModifier(params.conversationTypes),
				conversation_directions: listModifier(params.conversationDirections),
				dimensions: listModifier(params.dimensions)
			}
		}
		return this.requester.request<ConversationAnalyticsResponse>({
			method: 'GET',
			path: this.businessAccountId,
			fields: [field],
			signal: params.signal
		})
	}

	/**
	 * Fetches per-message pricing volume and cost. `GET /{waba-id}?fields=pricing_analytics...`.
	 * Not in wapi.go; list filters use Meta's documented JSON array form and are
	 * omitted when not given.
	 */
	async pricingAnalytics(params: PricingAnalyticsParams): Promise<PricingAnalyticsResponse> {
		const modifiers: Record<string, string | number> = {
			start: toUnixSeconds(params.start, 'start'),
			end: toUnixSeconds(params.end, 'end'),
			granularity: requireValue(params.granularity, 'granularity')
		}
		const lists: Record<string, string[] | undefined> = {
			phone_numbers: params.phoneNumbers,
			country_codes: params.countryCodes,
			metric_types: params.metricTypes,
			pricing_types: params.pricingTypes,
			pricing_categories: params.pricingCategories,
			dimensions: params.dimensions
		}
		for (const [key, values] of Object.entries(lists)) {
			if (values && values.length > 0) modifiers[key] = JSON.stringify(values)
		}
		return this.requester.request<PricingAnalyticsResponse>({
			method: 'GET',
			path: this.businessAccountId,
			fields: [{ name: 'pricing_analytics', modifiers }],
			signal: params.signal
		})
	}

	/**
	 * Subscribes the calling app to this WABA's webhooks (required to receive
	 * messages). `POST /{waba-id}/subscribed_apps`.
	 */
	async subscribeApp(params?: SubscribeAppParams): Promise<SuccessResponse> {
		if (params?.overrideCallbackUri && !params.verifyToken) {
			throw new ValidationError('`verifyToken` is required with `overrideCallbackUri`')
		}
		const body = params?.overrideCallbackUri
			? {
					override_callback_uri: params.overrideCallbackUri,
					verify_token: params.verifyToken
				}
			: undefined
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: `${this.businessAccountId}/subscribed_apps`,
			body,
			signal: params?.signal
		})
	}

	/** Lists apps subscribed to this WABA's webhooks. `GET /{waba-id}/subscribed_apps`. */
	async listSubscribedApps(options?: RequestOptions): Promise<Paginated<SubscribedApp>> {
		return this.requester.request<Paginated<SubscribedApp>>({
			method: 'GET',
			path: `${this.businessAccountId}/subscribed_apps`,
			signal: options?.signal
		})
	}

	/** Unsubscribes the calling app from this WABA's webhooks. `DELETE /{waba-id}/subscribed_apps`. */
	async unsubscribeApp(options?: RequestOptions): Promise<SuccessResponse> {
		return this.requester.request<SuccessResponse>({
			method: 'DELETE',
			path: `${this.businessAccountId}/subscribed_apps`,
			signal: options?.signal
		})
	}
}

/** Converts a {@link Timestamp} to whole Unix seconds. */
export function toUnixSeconds(value: Timestamp, name: string): number {
	const seconds = value instanceof Date ? Math.floor(value.getTime() / 1000) : Math.floor(value)
	if (!Number.isFinite(seconds)) {
		throw new ValidationError(`\`${name}\` must be a valid Date or Unix timestamp in seconds`)
	}
	return seconds
}

function requireValue(value: string, name: string): string {
	if (!value) throw new ValidationError(`\`${name}\` is required`)
	return value
}

/** Renders a list filter as Meta documents it: a JSON array, `[]` when empty. */
function listModifier(values: readonly string[] | undefined): string {
	return JSON.stringify(values ?? [])
}
