import {
	AccountAlertsEvent,
	AccountReviewUpdateEvent,
	AccountUpdateEvent,
	type BusinessAccountEventInit,
	BusinessCapabilityUpdateEvent,
	BusinessUsernameUpdateEvent,
	HistoryEvent,
	MessageTemplateCategoryUpdateEvent,
	MessageTemplateComponentsUpdateEvent,
	MessageTemplateQualityUpdateEvent,
	MessageTemplateStatusUpdateEvent,
	PaymentConfigurationUpdateEvent,
	PhoneNumberNameUpdateEvent,
	PhoneNumberQualityUpdateEvent,
	SecurityEvent,
	SmbAppStateSyncEvent,
	SmbMessageEchoesEvent,
	UserIdUpdateEvent,
	UserPreferencesEvent
} from '../events/business-events'
import { type DispatchContext } from './dispatch-context'
import { type WebhookChange, type WebhookEntry } from './payload'

/**
 * Meta's webhook field names. The short aliases (`message_template_status`,
 * `phone_number_quality`, ...) are the names wapi.go matches on; they are
 * accepted too so payloads shaped after wapi.go keep working.
 */
const FIELD_ALIASES: Readonly<Record<string, string>> = {
	message_template_status: 'message_template_status_update',
	message_template_quality: 'message_template_quality_update',
	template_category: 'template_category_update',
	phone_number_name: 'phone_number_name_update',
	phone_number_quality: 'phone_number_quality_update',
	account_review: 'account_review_update',
	business_capability: 'business_capability_update',
	business_username_updates: 'business_username_update'
}

/** Business account fields this dispatcher handles (Meta's names). */
const BUSINESS_FIELDS: ReadonlySet<string> = new Set([
	'message_template_status_update',
	'message_template_quality_update',
	'template_category_update',
	'message_template_components_update',
	'phone_number_name_update',
	'phone_number_quality_update',
	'account_update',
	'account_review_update',
	'account_alerts',
	'business_capability_update',
	'security',
	'user_preferences',
	'payment_configuration_update',
	'smb_app_state_sync',
	'smb_message_echoes',
	'history',
	'user_id_update',
	'business_username_update'
])

function normalizeField(field: string): string {
	return FIELD_ALIASES[field] ?? field
}

function emitBusinessEvent(
	context: DispatchContext,
	field: string,
	init: BusinessAccountEventInit
): void {
	switch (field) {
		case 'message_template_status_update':
			return context.emit(
				'MessageTemplateStatusUpdate',
				new MessageTemplateStatusUpdateEvent(init)
			)
		case 'message_template_quality_update':
			return context.emit(
				'MessageTemplateQualityUpdate',
				new MessageTemplateQualityUpdateEvent(init)
			)
		case 'template_category_update':
			return context.emit(
				'MessageTemplateCategoryUpdate',
				new MessageTemplateCategoryUpdateEvent(init)
			)
		case 'message_template_components_update':
			return context.emit(
				'MessageTemplateComponentsUpdate',
				new MessageTemplateComponentsUpdateEvent(init)
			)
		case 'phone_number_name_update':
			return context.emit('PhoneNumberNameUpdate', new PhoneNumberNameUpdateEvent(init))
		case 'phone_number_quality_update':
			return context.emit('PhoneNumberQualityUpdate', new PhoneNumberQualityUpdateEvent(init))
		case 'account_update':
			return context.emit('AccountUpdate', new AccountUpdateEvent(init))
		case 'account_review_update':
			return context.emit('AccountReviewUpdate', new AccountReviewUpdateEvent(init))
		case 'account_alerts':
			return context.emit('AccountAlerts', new AccountAlertsEvent(init))
		case 'business_capability_update':
			return context.emit('BusinessCapabilityUpdate', new BusinessCapabilityUpdateEvent(init))
		case 'security':
			return context.emit('Security', new SecurityEvent(init))
		case 'user_preferences':
			return context.emit('UserPreferences', new UserPreferencesEvent(init))
		case 'payment_configuration_update':
			return context.emit(
				'PaymentConfigurationUpdate',
				new PaymentConfigurationUpdateEvent(init)
			)
		case 'smb_app_state_sync':
			return context.emit('SmbAppStateSync', new SmbAppStateSyncEvent(init))
		case 'smb_message_echoes':
			return context.emit('SmbMessageEchoes', new SmbMessageEchoesEvent(init))
		case 'history':
			return context.emit('History', new HistoryEvent(init))
		case 'user_id_update':
			return context.emit('UserIdUpdate', new UserIdUpdateEvent(init))
		case 'business_username_update':
			return context.emit('BusinessUsernameUpdate', new BusinessUsernameUpdateEvent(init))
	}
}

/**
 * Decodes one WhatsApp Business Account change (everything except `messages`)
 * and emits its event. Returns `false` for an unknown field so the caller can
 * warn; never throws: an undecodable change is logged and skipped.
 */
export function dispatchBusinessChange(
	context: DispatchContext,
	entry: WebhookEntry,
	change: WebhookChange
): boolean {
	const field = normalizeField(change.field)
	if (!BUSINESS_FIELDS.has(field)) return false

	try {
		const value: unknown = change.value
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
			throw new TypeError(`expected change.value to be an object, got ${kind}`)
		}
		emitBusinessEvent(context, field, {
			businessAccountId: String(entry.id ?? ''),
			timestamp: entry.time,
			raw: value
		})
	} catch (error) {
		context.logger.error('skipping undecodable webhook change', { field: change.field, error })
	}
	return true
}
