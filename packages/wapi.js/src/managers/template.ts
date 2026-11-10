import { ValidationError } from '../errors'
import type { RequestClient } from '../internal/request-client'
import type { RequestOptions, SuccessResponse } from './business'
import { collectAll, paginationQuery, type Paginated, type PaginationInput } from './pagination'

/** Review status of a message template. */
export enum MessageTemplateStatus {
	Approved = 'APPROVED',
	InAppeal = 'IN_APPEAL',
	Pending = 'PENDING',
	Rejected = 'REJECTED',
	PendingDeletion = 'PENDING_DELETION',
	Deleted = 'DELETED',
	Disabled = 'DISABLED',
	Paused = 'PAUSED',
	LimitExceeded = 'LIMIT_EXCEEDED',
	Archived = 'ARCHIVED'
}

/** Category of a message template. */
export enum MessageTemplateCategory {
	Utility = 'UTILITY',
	Marketing = 'MARKETING',
	Authentication = 'AUTHENTICATION'
}

/** How body and header variables are written: `{{1}}` (positional) or `{{name}}` (named). */
export enum MessageTemplateParameterFormat {
	Positional = 'POSITIONAL',
	Named = 'NAMED'
}

/** Type of a template component. */
export enum MessageTemplateComponentType {
	Greeting = 'GREETING',
	Header = 'HEADER',
	Body = 'BODY',
	Footer = 'FOOTER',
	Buttons = 'BUTTONS',
	Carousel = 'CAROUSEL',
	LimitedTimeOffer = 'LIMITED_TIME_OFFER'
}

/** Format of a header component. */
export enum MessageTemplateComponentFormat {
	Text = 'TEXT',
	Image = 'IMAGE',
	Document = 'DOCUMENT',
	Product = 'PRODUCT',
	Video = 'VIDEO',
	Location = 'LOCATION'
}

/** Type of a template button. */
export enum TemplateMessageButtonType {
	QuickReply = 'QUICK_REPLY',
	Url = 'URL',
	PhoneNumber = 'PHONE_NUMBER',
	CopyCode = 'COPY_CODE',
	Otp = 'OTP',
	Flow = 'FLOW',
	Catalog = 'CATALOG',
	MultiProductMessage = 'MPM',
	SingleProductMessage = 'SPM',
	/**
	 * Asks the recipient to share their contact info. Takes no other fields (the
	 * label is Meta controlled) and needs no parameter when sending.
	 */
	RequestContactInfo = 'REQUEST_CONTACT_INFO'
}

/** OTP delivery style of an authentication template `OTP` button. */
export enum TemplateOtpType {
	CopyCode = 'COPY_CODE',
	OneTap = 'ONE_TAP',
	ZeroTap = 'ZERO_TAP'
}

/** Template quality rating. */
export enum TemplateQualityScoreValue {
	Green = 'GREEN',
	Yellow = 'YELLOW',
	Red = 'RED',
	Unknown = 'UNKNOWN'
}

/** A named parameter and its example value. */
export interface NamedParamExample {
	param_name: string
	example: string
}

/** `example` object of a template component. */
export interface TemplateMessageComponentExample {
	/** Media header handles from the resumable upload API (IMAGE, VIDEO, DOCUMENT). */
	header_handle?: string[]
	/** Positional examples for a text header. */
	header_text?: string[]
	/** Named examples for a text header. */
	header_text_named_params?: NamedParamExample[]
	/** Positional body examples: one inner array per example set. */
	body_text?: string[][]
	/** Named body examples. */
	body_text_named_params?: NamedParamExample[]
}

/** App allowed to autofill one-tap / zero-tap OTP codes. */
export interface TemplateOtpSupportedApp {
	package_name: string
	signature_hash: string
}

/** A template button, as returned by and sent to the Graph API. */
export interface TemplateMessageComponentButton {
	type: TemplateMessageButtonType | `${TemplateMessageButtonType}`
	text?: string
	/** Required for `PHONE_NUMBER`. */
	phone_number?: string
	/** Required for `URL`. */
	url?: string
	/** URL variable or coupon code examples. */
	example?: string[]
	otp_type?: TemplateOtpType | `${TemplateOtpType}`
	autofill_text?: string
	package_name?: string
	signature_hash?: string
	supported_apps?: TemplateOtpSupportedApp[]
	zero_tap_terms_accepted?: boolean
	flow_id?: string
	flow_name?: string
	flow_json?: string
	flow_action?: 'navigate' | 'data_exchange'
	navigate_screen?: string
}

/** Limited time offer component payload. */
export interface TemplateMessageLimitedTimeOffer {
	text?: string
	has_expiration?: boolean
}

/** One card of a carousel component. */
export interface TemplateMessageComponentCard {
	card_index?: number
	components: TemplateMessageComponent[]
}

/** A template component, as returned by and sent to the Graph API. */
export interface TemplateMessageComponent {
	type: MessageTemplateComponentType | `${MessageTemplateComponentType}`
	format?: MessageTemplateComponentFormat | `${MessageTemplateComponentFormat}`
	text?: string
	example?: TemplateMessageComponentExample
	buttons?: TemplateMessageComponentButton[]
	cards?: TemplateMessageComponentCard[]
	limited_time_offer?: TemplateMessageLimitedTimeOffer
	/** Authentication templates: adds the "do not share this code" disclaimer. */
	add_security_recommendation?: boolean
	/** Authentication templates: adds the code expiry footer. */
	code_expiration_minutes?: number
}

/** Template quality score. `date` is a Unix timestamp. */
export interface TemplateMessageQualityScore {
	score?: TemplateQualityScoreValue | `${TemplateQualityScoreValue}`
	date?: number
	reasons?: string[]
}

/** A message template node (`GET /{template-id}`). */
export interface MessageTemplate {
	id: string
	name: string
	language: string
	status: MessageTemplateStatus | `${MessageTemplateStatus}`
	category: MessageTemplateCategory | `${MessageTemplateCategory}`
	sub_category?: string
	components?: TemplateMessageComponent[]
	parameter_format?: MessageTemplateParameterFormat | `${MessageTemplateParameterFormat}`
	correct_category?: string
	previous_category?: string
	cta_url_link_tracking_opted_out?: boolean
	library_template_name?: string
	message_send_ttl_seconds?: number
	quality_score?: TemplateMessageQualityScore
	rejected_reason?: string
}

/** Body of `POST /{waba-id}/message_templates`. */
export interface TemplateCreateRequest {
	name: string
	language: string
	category: MessageTemplateCategory | `${MessageTemplateCategory}`
	components: TemplateMessageComponent[]
	allow_category_change?: boolean
	parameter_format?: MessageTemplateParameterFormat | `${MessageTemplateParameterFormat}`
	message_send_ttl_seconds?: number
	/** Create from a Template Library template. */
	library_template_name?: string
	library_template_button_inputs?: TemplateMessageComponentButton[]
}

/** Response of a template create. */
export interface TemplateCreateResponse {
	id: string
	status: MessageTemplateStatus | `${MessageTemplateStatus}`
	category: MessageTemplateCategory | `${MessageTemplateCategory}`
}

/** Body of `POST /{template-id}` (edit). Only the given keys change. */
export interface TemplateUpdateRequest {
	components?: TemplateMessageComponent[]
	category?: MessageTemplateCategory | `${MessageTemplateCategory}`
	message_send_ttl_seconds?: number
	parameter_format?: MessageTemplateParameterFormat | `${MessageTemplateParameterFormat}`
}

/** Response of `POST /{waba-id}/migrate_message_templates`. */
export interface TemplateMigrationResponse {
	migrated_templates?: string[]
	/** Template id to failure reason. */
	failed_templates?: Record<string, string>
}

/** Filters and pagination for {@link TemplateManager.list}. */
export interface ListTemplatesParams extends PaginationInput, RequestOptions {
	name?: string
	status?: MessageTemplateStatus | `${MessageTemplateStatus}`
	category?: MessageTemplateCategory | `${MessageTemplateCategory}`
	language?: string
	/** Matches template body content. */
	content?: string
	/** Matches name or body content. */
	nameOrContent?: string
	qualityScore?: TemplateQualityScoreValue | `${TemplateQualityScoreValue}`
}

/** Parameters of {@link TemplateManager.listAll}. */
export interface ListAllTemplatesParams extends Omit<ListTemplatesParams, 'after' | 'before'> {
	/** Stop after this many templates. */
	maxItems?: number
}

/** Parameters of {@link TemplateManager.delete}. */
export interface DeleteTemplateParams extends RequestOptions {
	/** Template name. Without `id`, every language of the template is deleted. */
	name: string
	/** Template id (`hsm_id`): deletes only that language version. */
	id?: string
}

/** Parameters of {@link TemplateManager.migrate}. */
export interface MigrateTemplatesParams extends RequestOptions {
	/** WABA to copy templates from. Both WABAs must belong to the same business. */
	sourceWabaId: string
	/** Page of source templates to migrate (500 per page), starting at 0. */
	pageNumber?: number
}

/** Fields requested for template nodes (same list as wapi.go). */
export const TEMPLATE_FIELDS = [
	'id',
	'category',
	'components',
	'correct_category',
	'cta_url_link_tracking_opted_out',
	'language',
	'library_template_name',
	'message_send_ttl_seconds',
	'name',
	'previous_category',
	'quality_score',
	'rejected_reason',
	'status',
	'sub_category',
	'parameter_format'
] as const

/** Default page size of {@link TemplateManager.list}. */
const LIST_DEFAULT_LIMIT = 100
/** Default page size of {@link TemplateManager.listAll} (matches wapi.go). */
const LIST_ALL_DEFAULT_LIMIT = 1000

/**
 * Create, edit, delete, fetch and migrate message templates of a WhatsApp
 * Business Account.
 */
export class TemplateManager {
	constructor(
		private readonly requester: RequestClient,
		readonly businessAccountId: string
	) {}

	/** Submits a template for review. `POST /{waba-id}/message_templates`. */
	async create(
		template: TemplateCreateRequest,
		options?: RequestOptions
	): Promise<TemplateCreateResponse> {
		if (!template.name) throw new ValidationError('template `name` is required')
		if (!template.language) throw new ValidationError('template `language` is required')
		if (!template.category) throw new ValidationError('template `category` is required')
		if (!Array.isArray(template.components)) {
			throw new ValidationError('template `components` must be an array')
		}
		return this.requester.request<TemplateCreateResponse>({
			method: 'POST',
			path: `${this.businessAccountId}/message_templates`,
			body: template,
			signal: options?.signal
		})
	}

	/** Edits a template's components, category or TTL. `POST /{template-id}`. */
	async update(
		templateId: string,
		updates: TemplateUpdateRequest,
		options?: RequestOptions
	): Promise<SuccessResponse> {
		requireId(templateId, 'templateId')
		return this.requester.request<SuccessResponse>({
			method: 'POST',
			path: templateId,
			body: updates,
			signal: options?.signal
		})
	}

	/**
	 * Deletes a template by name (all languages), or one language version by
	 * name and id. `DELETE /{waba-id}/message_templates?name=..&hsm_id=..`.
	 */
	async delete(params: DeleteTemplateParams): Promise<SuccessResponse> {
		if (!params.name) {
			throw new ValidationError(
				'`name` is required to delete a template, even when `id` is given'
			)
		}
		return this.requester.request<SuccessResponse>({
			method: 'DELETE',
			path: `${this.businessAccountId}/message_templates`,
			query: { name: params.name, hsm_id: params.id },
			signal: params.signal
		})
	}

	/** Fetches one template. `GET /{template-id}`. */
	async get(templateId: string, options?: RequestOptions): Promise<MessageTemplate> {
		requireId(templateId, 'templateId')
		return this.requester.request<MessageTemplate>({
			method: 'GET',
			path: templateId,
			fields: [...TEMPLATE_FIELDS],
			signal: options?.signal
		})
	}

	/**
	 * Fetches one page of templates (default 100 per page), optionally filtered.
	 * `GET /{waba-id}/message_templates`.
	 */
	async list(params?: ListTemplatesParams): Promise<Paginated<MessageTemplate>> {
		return this.requester.request<Paginated<MessageTemplate>>({
			method: 'GET',
			path: `${this.businessAccountId}/message_templates`,
			fields: [...TEMPLATE_FIELDS],
			query: {
				...paginationQuery(params, LIST_DEFAULT_LIMIT),
				name: params?.name,
				status: params?.status,
				category: params?.category,
				language: params?.language,
				content: params?.content,
				name_or_content: params?.nameOrContent,
				quality_score: params?.qualityScore
			},
			signal: params?.signal
		})
	}

	/**
	 * Fetches every template across all pages (1000 per page by default, as in
	 * wapi.go). `GET /{waba-id}/message_templates`.
	 */
	async listAll(params?: ListAllTemplatesParams): Promise<MessageTemplate[]> {
		const { maxItems, limit, ...filters } = params ?? {}
		return collectAll(page => this.list({ ...filters, ...page }), {
			limit: limit ?? LIST_ALL_DEFAULT_LIMIT,
			maxItems
		})
	}

	/**
	 * Copies templates from another WABA of the same business into this one.
	 * `POST /{waba-id}/migrate_message_templates`.
	 */
	async migrate(params: MigrateTemplatesParams): Promise<TemplateMigrationResponse> {
		requireId(params.sourceWabaId, 'sourceWabaId')
		const body: { source_waba_id: string; page_number?: number } = {
			source_waba_id: params.sourceWabaId
		}
		if (params.pageNumber !== undefined) body.page_number = params.pageNumber
		return this.requester.request<TemplateMigrationResponse>({
			method: 'POST',
			path: `${this.businessAccountId}/migrate_message_templates`,
			body,
			signal: params.signal
		})
	}
}

function requireId(value: string, name: string): void {
	if (!value) throw new ValidationError(`\`${name}\` is required`)
}
