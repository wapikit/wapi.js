import { BaseBusinessAccountEvent, type BusinessPhoneNumber, type WebhookEventError } from './base'

/**
 * A string enum that also accepts values Meta adds later. Compare against the
 * enum members; unknown values are passed through unchanged.
 */
export type OpenEnum<E extends string> = E | (string & Record<never, never>)

/** @internal Data every business account event is built from. */
export interface BusinessAccountEventInit {
	/** WhatsApp Business Account id (`entry.id`). */
	businessAccountId: string
	/** `entry.time`, Unix seconds. */
	timestamp?: number
	/** The untouched `change.value`. */
	raw: unknown
}

// ---------------------------------------------------------------------------
// Enums (values are Meta's)
// ---------------------------------------------------------------------------

/** `event` of a `message_template_status_update` webhook. */
export enum MessageTemplateStatusUpdateEventEnum {
	Approved = 'APPROVED',
	Archived = 'ARCHIVED',
	Deleted = 'DELETED',
	Disabled = 'DISABLED',
	Flagged = 'FLAGGED',
	InAppeal = 'IN_APPEAL',
	LimitExceeded = 'LIMIT_EXCEEDED',
	Locked = 'LOCKED',
	Paused = 'PAUSED',
	Pending = 'PENDING',
	PendingDeletion = 'PENDING_DELETION',
	Reinstated = 'REINSTATED',
	Rejected = 'REJECTED'
}

/** `reason` of a `message_template_status_update` webhook. */
export enum MessageTemplateStatusUpdateReasonEnum {
	AbusiveContent = 'ABUSIVE_CONTENT',
	CategoryNotAvailable = 'CATEGORY_NOT_AVAILABLE',
	IncorrectCategory = 'INCORRECT_CATEGORY',
	InvalidFormat = 'INVALID_FORMAT',
	None = 'NONE',
	Promotional = 'PROMOTIONAL',
	Scam = 'SCAM',
	TagContentMismatch = 'TAG_CONTENT_MISMATCH'
}

/** Quality score of a template. */
export enum MessageTemplateQualityUpdateQualityScoreEnum {
	Green = 'GREEN',
	Yellow = 'YELLOW',
	Red = 'RED',
	Unknown = 'UNKNOWN'
}

/** Template category. `OTP` and `TRANSACTIONAL` are legacy values. */
export enum MessageTemplateCategoryEnum {
	Authentication = 'AUTHENTICATION',
	Marketing = 'MARKETING',
	Utility = 'UTILITY',
	Otp = 'OTP',
	Transactional = 'TRANSACTIONAL'
}

/** `decision` of a `phone_number_name_update` webhook. */
export enum PhoneNumberNameUpdateDecisionEnum {
	Approved = 'APPROVED',
	Rejected = 'REJECTED',
	Deferred = 'DEFERRED'
}

/** `event` of a `phone_number_quality_update` webhook. */
export enum PhoneNumberQualityUpdateEventEnum {
	Downgrade = 'DOWNGRADE',
	Flagged = 'FLAGGED',
	Onboarding = 'ONBOARDING',
	Unflagged = 'UNFLAGGED',
	Upgrade = 'UPGRADE'
}

/** Messaging limit tier. */
export enum PhoneNumberQualityUpdateCurrentLimitEnum {
	Tier50 = 'TIER_50',
	Tier250 = 'TIER_250',
	Tier1K = 'TIER_1K',
	Tier2K = 'TIER_2K',
	Tier10K = 'TIER_10K',
	Tier100K = 'TIER_100K',
	TierUnlimited = 'TIER_UNLIMITED'
}

/** `alert_info.alert_severity` of an `account_alerts` webhook. */
export enum AccountAlertSeverityEnum {
	Critical = 'CRITICAL',
	Warning = 'WARNING',
	Informational = 'INFORMATIONAL'
}

/** `alert_info.alert_status` of an `account_alerts` webhook. */
export enum AccountAlertStatusEnum {
	Active = 'ACTIVE',
	Resolved = 'RESOLVED',
	None = 'NONE'
}

/** `event` of an `account_update` webhook. */
export enum AccountUpdateEventEnum {
	VerifiedAccount = 'VERIFIED_ACCOUNT',
	DisabledUpdate = 'DISABLED_UPDATE',
	AccountViolation = 'ACCOUNT_VIOLATION',
	AccountRestriction = 'ACCOUNT_RESTRICTION',
	AccountDeleted = 'ACCOUNT_DELETED',
	PartnerAdded = 'PARTNER_ADDED',
	PartnerRemoved = 'PARTNER_REMOVED',
	PartnerAppInstalled = 'PARTNER_APP_INSTALLED',
	PartnerAppUninstalled = 'PARTNER_APP_UNINSTALLED',
	AdAccountLinked = 'AD_ACCOUNT_LINKED',
	AuthIntlPriceEligibilityUpdate = 'AUTH_INTL_PRICE_ELIGIBILITY_UPDATE',
	BusinessPrimaryLocationCountryUpdate = 'BUSINESS_PRIMARY_LOCATION_COUNTRY_UPDATE',
	PartnerClientCertificationStatusUpdate = 'PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE'
}

/** `decision` of an `account_review_update` webhook. */
export enum AccountReviewUpdateEventEnum {
	Approved = 'APPROVED',
	Rejected = 'REJECTED',
	Pending = 'PENDING',
	Deferred = 'DEFERRED'
}

// ---------------------------------------------------------------------------
// Defensive readers for `unknown` webhook values
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The value as an object, or `{}`. */
function obj(value: unknown): JsonObject {
	return isObject(value) ? value : {}
}

/** The value as an object, or `undefined`. */
function optObj(value: unknown): JsonObject | undefined {
	return isObject(value) ? value : undefined
}

/** The value as an array, or `[]`. */
function arr(value: unknown): unknown[] {
	return Array.isArray(value) ? value : []
}

/** Strings as-is (empty becomes `undefined`), numbers stringified. */
function str(value: unknown): string | undefined {
	if (typeof value === 'string') return value || undefined
	if (typeof value === 'number' && Number.isFinite(value)) return String(value)
	return undefined
}

/** Numbers as-is, numeric strings parsed. */
function num(value: unknown): number | undefined {
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : undefined
	}
	return undefined
}

/** Numbers (or numeric strings) as numbers, other strings as-is. */
function numOrStr(value: unknown): number | string | undefined {
	return num(value) ?? str(value)
}

function strList(value: unknown): string[] {
	return arr(value).flatMap(item => {
		const text = str(item)
		return text === undefined ? [] : [text]
	})
}

function phoneNumberOf(metadata: unknown): BusinessPhoneNumber {
	const value = obj(metadata)
	return {
		id: str(value.phone_number_id) ?? '',
		displayPhoneNumber: str(value.display_phone_number) ?? ''
	}
}

function errorsOf(value: unknown): WebhookEventError[] {
	return arr(value)
		.filter(isObject)
		.map(error => ({
			code: num(error.code) ?? 0,
			title: str(error.title),
			message: str(error.message),
			details: str(obj(error.error_data).details),
			href: str(error.href)
		}))
}

/** The type-specific body of a message (`message[message.type]`), if it is an object. */
function contentOf(message: JsonObject, type: string): JsonObject | undefined {
	return type ? optObj(message[type]) : undefined
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Base of the template webhooks: id, name and language of the template. */
export abstract class BaseMessageTemplateEvent extends BaseBusinessAccountEvent {
	/** Template id, as a string (Meta sends a number that can exceed 2^53). */
	readonly messageTemplateId: string
	readonly messageTemplateName: string
	/** Language code, e.g. `"en_US"`. */
	readonly messageTemplateLanguage: string

	protected constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.messageTemplateId = str(value.message_template_id) ?? ''
		this.messageTemplateName = str(value.message_template_name) ?? ''
		this.messageTemplateLanguage = str(value.message_template_language) ?? ''
	}
}

/** A template was approved, rejected, paused, disabled... (`message_template_status_update`). */
export class MessageTemplateStatusUpdateEvent extends BaseMessageTemplateEvent {
	/** New status of the template. */
	readonly event: OpenEnum<MessageTemplateStatusUpdateEventEnum>
	/** Rejection / status reason; `NONE` when there is none. */
	readonly reason?: OpenEnum<MessageTemplateStatusUpdateReasonEnum>
	/** Category of the template, when Meta includes it. */
	readonly messageTemplateCategory?: OpenEnum<MessageTemplateCategoryEnum>
	/** Present when the template is scheduled to be disabled. */
	readonly disableInfo?: {
		/** Unix seconds when Meta sends a number, otherwise Meta's date string. */
		disableDate?: number | string
	}
	/** Extra details, e.g. on `PAUSED` / `LOCKED`. */
	readonly otherInfo?: { title?: string; description?: string }
	/** Details on `REJECTED`. */
	readonly rejectionInfo?: { reason?: string; recommendation?: string }

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.event = str(value.event) ?? ''
		this.reason = str(value.reason)
		this.messageTemplateCategory = str(value.message_template_category)
		const disableInfo = optObj(value.disable_info)
		if (disableInfo) this.disableInfo = { disableDate: numOrStr(disableInfo.disable_date) }
		const otherInfo = optObj(value.other_info)
		if (otherInfo) {
			this.otherInfo = {
				title: str(otherInfo.title),
				description: str(otherInfo.description)
			}
		}
		const rejectionInfo = optObj(value.rejection_info)
		if (rejectionInfo) {
			this.rejectionInfo = {
				reason: str(rejectionInfo.reason),
				recommendation: str(rejectionInfo.recommendation)
			}
		}
	}
}

/** A template's quality score changed (`message_template_quality_update`). */
export class MessageTemplateQualityUpdateEvent extends BaseMessageTemplateEvent {
	readonly previousQualityScore: OpenEnum<MessageTemplateQualityUpdateQualityScoreEnum>
	readonly newQualityScore: OpenEnum<MessageTemplateQualityUpdateQualityScoreEnum>

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.previousQualityScore = str(value.previous_quality_score) ?? ''
		this.newQualityScore = str(value.new_quality_score) ?? ''
	}
}

/** Meta changed (or will change) a template's category (`template_category_update`). */
export class MessageTemplateCategoryUpdateEvent extends BaseMessageTemplateEvent {
	readonly previousCategory?: OpenEnum<MessageTemplateCategoryEnum>
	readonly newCategory?: OpenEnum<MessageTemplateCategoryEnum>
	/** Category Meta determined to be correct, when included. */
	readonly correctCategory?: OpenEnum<MessageTemplateCategoryEnum>

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.previousCategory = str(value.previous_category)
		this.newCategory = str(value.new_category)
		this.correctCategory = str(value.correct_category)
	}
}

/** A button of a template, as sent in `message_template_components_update`. */
export interface MessageTemplateComponentsUpdateButton {
	/** `URL`, `PHONE_NUMBER`, `QUICK_REPLY`, ... */
	messageTemplateButtonType: string
	messageTemplateButtonText: string
	/** URL buttons only. */
	messageTemplateButtonUrl?: string
	/** Phone number buttons only. */
	messageTemplateButtonPhoneNumber?: string
}

/** A template's components were edited (`message_template_components_update`). */
export class MessageTemplateComponentsUpdateEvent extends BaseMessageTemplateEvent {
	/** Body text of the template. */
	readonly messageTemplateElement: string
	/** Header text, only for templates with a text header. */
	readonly messageTemplateTitle?: string
	/** Footer text, only for templates with a footer. */
	readonly messageTemplateFooter?: string
	/** URL and phone number buttons. */
	readonly messageTemplateButtons: MessageTemplateComponentsUpdateButton[]

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.messageTemplateElement = str(value.message_template_element) ?? ''
		this.messageTemplateTitle = str(value.message_template_title)
		this.messageTemplateFooter = str(value.message_template_footer)
		this.messageTemplateButtons = arr(value.message_template_buttons)
			.filter(isObject)
			.map(button => ({
				messageTemplateButtonType: str(button.message_template_button_type) ?? '',
				messageTemplateButtonText: str(button.message_template_button_text) ?? '',
				messageTemplateButtonUrl: str(button.message_template_button_url),
				messageTemplateButtonPhoneNumber: str(button.message_template_button_phone_number)
			}))
	}
}

// ---------------------------------------------------------------------------
// Phone numbers
// ---------------------------------------------------------------------------

/** A display name request was decided (`phone_number_name_update`). */
export class PhoneNumberNameUpdateEvent extends BaseBusinessAccountEvent {
	readonly displayPhoneNumber: string
	readonly decision: OpenEnum<PhoneNumberNameUpdateDecisionEnum>
	readonly requestedVerifiedName: string
	/** Set when the name was rejected. */
	readonly rejectionReason?: string

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.displayPhoneNumber = str(value.display_phone_number) ?? ''
		this.decision = str(value.decision) ?? ''
		this.requestedVerifiedName = str(value.requested_verified_name) ?? ''
		this.rejectionReason = str(value.rejection_reason)
	}
}

/** A phone number's quality or messaging limit changed (`phone_number_quality_update`). */
export class PhoneNumberQualityUpdateEvent extends BaseBusinessAccountEvent {
	readonly displayPhoneNumber: string
	readonly event: OpenEnum<PhoneNumberQualityUpdateEventEnum>
	/** Messaging limit after the change. */
	readonly currentLimit?: OpenEnum<PhoneNumberQualityUpdateCurrentLimitEnum>
	/** Messaging limit before the change, when included. */
	readonly oldLimit?: OpenEnum<PhoneNumberQualityUpdateCurrentLimitEnum>
	/** Business-level messaging limit, when included. */
	readonly maxDailyConversationsPerBusiness?: OpenEnum<PhoneNumberQualityUpdateCurrentLimitEnum>
	/** Legacy per-number conversation limit, when included. */
	readonly maxDailyConversationPerPhone?: number

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.displayPhoneNumber = str(value.display_phone_number) ?? ''
		this.event = str(value.event) ?? ''
		this.currentLimit = str(value.current_limit)
		this.oldLimit = str(value.old_limit)
		this.maxDailyConversationsPerBusiness = str(value.max_daily_conversations_per_business)
		this.maxDailyConversationPerPhone = num(value.max_daily_conversation_per_phone)
	}
}

/** Two-step verification PIN changed or a reset was requested (`security`). */
export class SecurityEvent extends BaseBusinessAccountEvent {
	readonly displayPhoneNumber: string
	/** e.g. `PIN_CHANGED`, `PIN_RESET_REQUEST`. */
	readonly event: string
	/** Who requested the change, when included. */
	readonly requester?: string

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.displayPhoneNumber = str(value.display_phone_number) ?? ''
		this.event = str(value.event) ?? ''
		this.requester = str(value.requester)
	}
}

/** The business username of a phone number changed (`business_username_update`). */
export class BusinessUsernameUpdateEvent extends BaseBusinessAccountEvent {
	/** Phone number the username belongs to. */
	readonly phoneNumber: BusinessPhoneNumber
	readonly username?: string
	readonly previousUsername?: string
	readonly event?: string

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.phoneNumber = phoneNumberOf(value.metadata)
		this.username = str(value.username)
		this.previousUsername = str(value.previous_username)
		this.event = str(value.event)
	}
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/** `waba_info` of an `account_update` webhook. */
export interface AccountUpdateWabaInfo {
	wabaId?: string
	ownerBusinessId?: string
	/** `AD_ACCOUNT_LINKED` only. */
	adAccountLinked?: string
	/** `PARTNER_APP_INSTALLED` / `PARTNER_APP_UNINSTALLED` only. */
	partnerAppId?: string
	/** Multi-partner solution onboarding only. */
	solutionId?: string
	solutionPartnerBusinessIds: string[]
}

/** `auth_international_rate_eligibility` of an `account_update` webhook. */
export interface AccountUpdateAuthInternationalRateEligibility {
	/** Unix seconds. */
	startTime?: number
	exceptionCountries: { countryCode: string; startTime?: number }[]
}

/** `ban_info` of an `account_update` webhook (`DISABLED_UPDATE`). */
export interface AccountUpdateBanInfo {
	/** e.g. `["SCHEDULE_FOR_DISABLE"]`, `["DISABLE"]`, `["REINSTATE"]`. */
	wabaBanState: string[]
	wabaBanDate?: string
}

/** One entry of `restriction_info` of an `account_update` webhook (`ACCOUNT_RESTRICTION`). */
export interface AccountUpdateRestrictionInfo {
	restrictionType?: string
	/** Unix seconds when Meta sends a number, otherwise Meta's date string. */
	expiration?: number | string
}

/** `partner_client_certification_info` of an `account_update` webhook. */
export interface AccountUpdatePartnerClientCertificationInfo {
	clientBusinessId?: string
	status?: string
	rejectionReasons: string[]
}

/** The WhatsApp Business Account changed: verified, banned, restricted, partner added... (`account_update`). */
export class AccountUpdateEvent extends BaseBusinessAccountEvent {
	readonly event: OpenEnum<AccountUpdateEventEnum>
	readonly phoneNumber?: string
	/** `BUSINESS_PRIMARY_LOCATION_COUNTRY_UPDATE` only. */
	readonly country?: string
	readonly wabaInfo?: AccountUpdateWabaInfo
	/** `ACCOUNT_VIOLATION` only. */
	readonly violationInfo?: { violationType?: string }
	/** `AUTH_INTL_PRICE_ELIGIBILITY_UPDATE` only. */
	readonly authInternationalRateEligibility?: AccountUpdateAuthInternationalRateEligibility
	/** `DISABLED_UPDATE` only. */
	readonly banInfo?: AccountUpdateBanInfo
	/** `ACCOUNT_RESTRICTION` only. Meta sends a list; a single object is accepted too. */
	readonly restrictionInfo?: AccountUpdateRestrictionInfo[]
	/** `PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE` only. */
	readonly partnerClientCertificationInfo?: AccountUpdatePartnerClientCertificationInfo

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.event = str(value.event) ?? ''
		this.phoneNumber = str(value.phone_number)
		this.country = str(value.country)

		const wabaInfo = optObj(value.waba_info)
		if (wabaInfo) {
			this.wabaInfo = {
				wabaId: str(wabaInfo.waba_id),
				ownerBusinessId: str(wabaInfo.owner_business_id),
				adAccountLinked: str(wabaInfo.ad_account_linked),
				partnerAppId: str(wabaInfo.partner_app_id),
				solutionId: str(wabaInfo.solution_id),
				solutionPartnerBusinessIds: strList(wabaInfo.solution_partner_business_ids)
			}
		}

		const violationInfo = optObj(value.violation_info)
		if (violationInfo) this.violationInfo = { violationType: str(violationInfo.violation_type) }

		const eligibility = optObj(value.auth_international_rate_eligibility)
		if (eligibility) {
			this.authInternationalRateEligibility = {
				startTime: num(eligibility.start_time),
				exceptionCountries: arr(eligibility.exception_countries)
					.filter(isObject)
					.map(country => ({
						countryCode: str(country.country_code) ?? '',
						startTime: num(country.start_time)
					}))
			}
		}

		const banInfo = optObj(value.ban_info)
		if (banInfo) {
			const state = banInfo.waba_ban_state
			this.banInfo = {
				wabaBanState: Array.isArray(state) ? strList(state) : strList([state]),
				wabaBanDate: str(banInfo.waba_ban_date)
			}
		}

		const restriction = value.restriction_info
		if (restriction !== undefined && restriction !== null) {
			const items = Array.isArray(restriction) ? restriction : [restriction]
			this.restrictionInfo = items.filter(isObject).map(item => ({
				restrictionType: str(item.restriction_type),
				expiration: numOrStr(item.expiration)
			}))
		}

		const certification = optObj(value.partner_client_certification_info)
		if (certification) {
			this.partnerClientCertificationInfo = {
				clientBusinessId: str(certification.client_business_id),
				status: str(certification.status),
				rejectionReasons: strList(certification.rejection_reasons)
			}
		}
	}
}

/** The account review finished (`account_review_update`). */
export class AccountReviewUpdateEvent extends BaseBusinessAccountEvent {
	readonly decision: OpenEnum<AccountReviewUpdateEventEnum>

	constructor(init: BusinessAccountEventInit) {
		super(init)
		this.decision = str(obj(init.raw).decision) ?? ''
	}
}

/** An alert was raised or resolved on the account or a phone number (`account_alerts`). */
export class AccountAlertsEvent extends BaseBusinessAccountEvent {
	/** `WABA`, `PHONE_NUMBER`, `BUSINESS`, ... */
	readonly entityType: string
	readonly entityId: string
	readonly alertSeverity: OpenEnum<AccountAlertSeverityEnum>
	readonly alertStatus: OpenEnum<AccountAlertStatusEnum>
	/** e.g. `OBA_APPROVED`, `INCREASED_CAPABILITIES_ELIGIBILITY_NEED_MORE_INFO`. */
	readonly alertType: string
	readonly alertDescription: string

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		const alertInfo = obj(value.alert_info)
		this.entityType = str(value.entity_type) ?? ''
		this.entityId = str(value.entity_id) ?? ''
		this.alertSeverity = str(alertInfo.alert_severity) ?? ''
		this.alertStatus = str(alertInfo.alert_status) ?? ''
		this.alertType = str(alertInfo.alert_type) ?? ''
		this.alertDescription = str(alertInfo.alert_description) ?? ''
	}
}

/** The account's messaging or phone number limits changed (`business_capability_update`). */
export class BusinessCapabilityUpdateEvent extends BaseBusinessAccountEvent {
	/** Legacy per-number daily conversation limit. */
	readonly maxDailyConversationPerPhone?: number
	readonly maxPhoneNumbersPerBusiness?: number
	/** Business-level messaging limit (a tier name or a number), when included. */
	readonly maxDailyConversationsPerBusiness?: number | string

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.maxDailyConversationPerPhone = num(value.max_daily_conversation_per_phone)
		this.maxPhoneNumbersPerBusiness = num(value.max_phone_numbers_per_business)
		this.maxDailyConversationsPerBusiness = numOrStr(value.max_daily_conversations_per_business)
	}
}

/** Payment configuration (WhatsApp Pay) was created or changed (`payment_configuration_update`). */
export class PaymentConfigurationUpdateEvent extends BaseBusinessAccountEvent {
	readonly configurationName: string
	/** e.g. `razorpay`, `payu`. */
	readonly providerName: string
	/** Merchant id at the provider. */
	readonly providerMid: string
	readonly status: string
	/** Unix seconds. */
	readonly createdTimestamp?: number
	/** Unix seconds. */
	readonly updatedTimestamp?: number

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.configurationName = str(value.configuration_name) ?? ''
		this.providerName = str(value.provider_name) ?? ''
		this.providerMid = str(value.provider_mid) ?? ''
		this.status = str(value.status) ?? ''
		this.createdTimestamp = num(value.created_timestamp)
		this.updatedTimestamp = num(value.updated_timestamp)
	}
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** A contact block of a `user_preferences` webhook. */
export interface UserPreferencesContact {
	waId?: string
	userId?: string
	name?: string
}

/** One preference change. */
export interface UserPreference {
	waId: string
	/** BSUID of the user, when included. */
	userId?: string
	/** Human readable description. */
	detail?: string
	/** e.g. `marketing_messages`. */
	category: string
	/** e.g. `stop`, `resume`. */
	value: string
	/** Unix seconds. */
	timestamp?: number
}

/** A user opted out of / back into a message category (`user_preferences`). */
export class UserPreferencesEvent extends BaseBusinessAccountEvent {
	/** Business phone number the preference applies to. */
	readonly phoneNumber: BusinessPhoneNumber
	readonly contacts: UserPreferencesContact[]
	readonly userPreferences: UserPreference[]

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.phoneNumber = phoneNumberOf(value.metadata)
		this.contacts = arr(value.contacts)
			.filter(isObject)
			.map(contact => ({
				waId: str(contact.wa_id),
				userId: str(contact.user_id),
				name: str(obj(contact.profile).name)
			}))
		this.userPreferences = arr(value.user_preferences)
			.filter(isObject)
			.map(preference => ({
				waId: str(preference.wa_id) ?? '',
				userId: str(preference.user_id),
				detail: str(preference.detail),
				category: str(preference.category) ?? '',
				value: str(preference.value) ?? '',
				timestamp: num(preference.timestamp)
			}))
	}
}

/** A user's business-scoped user id (BSUID) changed (`user_id_update`). */
export class UserIdUpdateEvent extends BaseBusinessAccountEvent {
	readonly waId?: string
	readonly oldUserId?: string
	/** `new_user_id`, falling back to `user_id` when Meta only sends the current id. */
	readonly newUserId?: string
	/** `user_id` exactly as sent. */
	readonly userId?: string
	readonly parentUserId?: string

	constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.waId = str(value.wa_id)
		this.oldUserId = str(value.old_user_id)
		this.userId = str(value.user_id)
		this.newUserId = str(value.new_user_id) ?? this.userId
		this.parentUserId = str(value.parent_user_id)
	}
}

// ---------------------------------------------------------------------------
// WhatsApp Business app (coexistence)
// ---------------------------------------------------------------------------

/** Base of the WhatsApp Business app (coexistence) webhooks. */
export abstract class BaseSmbEvent extends BaseBusinessAccountEvent {
	/** Always `"whatsapp"`. */
	readonly messagingProduct: string
	/** Business phone number the webhook is about. */
	readonly phoneNumber: BusinessPhoneNumber

	protected constructor(init: BusinessAccountEventInit) {
		super(init)
		const value = obj(init.raw)
		this.messagingProduct = str(value.messaging_product) ?? ''
		this.phoneNumber = phoneNumberOf(value.metadata)
	}
}

/** One contact change synced from the WhatsApp Business app. */
export interface SmbStateSyncItem {
	/** e.g. `contact`. */
	type: string
	contact?: { fullName?: string; firstName?: string; phoneNumber?: string }
	/** e.g. `add`, `remove`. */
	action: string
	/** Unix seconds (`metadata.timestamp`). */
	timestamp?: number
}

/** Contacts were added / removed in the WhatsApp Business app (`smb_app_state_sync`). */
export class SmbAppStateSyncEvent extends BaseSmbEvent {
	readonly stateSync: SmbStateSyncItem[]

	constructor(init: BusinessAccountEventInit) {
		super(init)
		this.stateSync = arr(obj(init.raw).state_sync)
			.filter(isObject)
			.map(item => {
				const contact = optObj(item.contact)
				return {
					type: str(item.type) ?? '',
					contact: contact && {
						fullName: str(contact.full_name),
						firstName: str(contact.first_name),
						phoneNumber: str(contact.phone_number)
					},
					action: str(item.action) ?? '',
					timestamp: num(obj(item.metadata).timestamp)
				}
			})
	}
}

/** A message the business sent from the WhatsApp Business app. */
export interface SmbMessageEcho {
	/** Business phone number. */
	from: string
	/** Customer wa_id. */
	to: string
	id: string
	/** Unix seconds. */
	timestamp?: number
	/** Message type, e.g. `text`, `image`. */
	type: string
	/** The type-specific body (`echo[echo.type]`), e.g. `{ body: "hi" }` for text. */
	content?: Record<string, unknown>
}

/** Messages sent from the WhatsApp Business app, echoed to the API (`smb_message_echoes`). */
export class SmbMessageEchoesEvent extends BaseSmbEvent {
	readonly messageEchoes: SmbMessageEcho[]

	constructor(init: BusinessAccountEventInit) {
		super(init)
		this.messageEchoes = arr(obj(init.raw).message_echoes)
			.filter(isObject)
			.map(echo => {
				const type = str(echo.type) ?? ''
				return {
					from: str(echo.from) ?? '',
					to: str(echo.to) ?? '',
					id: str(echo.id) ?? '',
					timestamp: num(echo.timestamp),
					type,
					content: contentOf(echo, type)
				}
			})
	}
}

/** A message from the chat history shared by the WhatsApp Business app. */
export interface HistoryMessage {
	from: string
	/** Only on messages the business sent. */
	to?: string
	id: string
	/** Unix seconds. */
	timestamp?: number
	type: string
	/** `history_context.status`, e.g. `READ`, `DELIVERED`. */
	messageStatus?: string
	/** The type-specific body (`message[message.type]`). */
	content?: Record<string, unknown>
}

/** A chat thread of a history chunk. */
export interface HistoryThread {
	/** Customer wa_id. */
	id: string
	messages: HistoryMessage[]
}

/** One chunk of the chat history sync. */
export interface HistoryChunk {
	phase?: number
	chunkOrder?: number
	/** Percentage, 0-100. */
	progress?: number
	threads: HistoryThread[]
	/** Set instead of threads when the history could not be shared (e.g. declined by the business). */
	errors: WebhookEventError[]
}

/** Chat history shared when onboarding a WhatsApp Business app number (`history`). */
export class HistoryEvent extends BaseSmbEvent {
	readonly historyChunks: HistoryChunk[]

	constructor(init: BusinessAccountEventInit) {
		super(init)
		this.historyChunks = arr(obj(init.raw).history)
			.filter(isObject)
			.map(chunk => {
				const metadata = obj(chunk.metadata)
				return {
					phase: num(metadata.phase),
					chunkOrder: num(metadata.chunk_order),
					progress: num(metadata.progress),
					threads: arr(chunk.threads)
						.filter(isObject)
						.map(thread => ({
							id: str(thread.id) ?? '',
							messages: arr(thread.messages)
								.filter(isObject)
								.map(message => {
									const type = str(message.type) ?? ''
									return {
										from: str(message.from) ?? '',
										to: str(message.to),
										id: str(message.id) ?? '',
										timestamp: num(message.timestamp),
										type,
										messageStatus: str(obj(message.history_context).status),
										content: contentOf(message, type)
									}
								})
						})),
					errors: errorsOf(chunk.errors)
				}
			})
	}
}

/** Business account events, keyed by the name `client.on()` accepts. */
export type BusinessEventMap = {
	MessageTemplateStatusUpdate: MessageTemplateStatusUpdateEvent
	MessageTemplateQualityUpdate: MessageTemplateQualityUpdateEvent
	MessageTemplateCategoryUpdate: MessageTemplateCategoryUpdateEvent
	MessageTemplateComponentsUpdate: MessageTemplateComponentsUpdateEvent
	PhoneNumberNameUpdate: PhoneNumberNameUpdateEvent
	PhoneNumberQualityUpdate: PhoneNumberQualityUpdateEvent
	AccountUpdate: AccountUpdateEvent
	AccountReviewUpdate: AccountReviewUpdateEvent
	AccountAlerts: AccountAlertsEvent
	BusinessCapabilityUpdate: BusinessCapabilityUpdateEvent
	Security: SecurityEvent
	UserPreferences: UserPreferencesEvent
	PaymentConfigurationUpdate: PaymentConfigurationUpdateEvent
	SmbAppStateSync: SmbAppStateSyncEvent
	SmbMessageEchoes: SmbMessageEchoesEvent
	History: HistoryEvent
	UserIdUpdate: UserIdUpdateEvent
	BusinessUsernameUpdate: BusinessUsernameUpdateEvent
}
