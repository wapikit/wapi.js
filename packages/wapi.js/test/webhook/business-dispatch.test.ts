import { describe, expect, it } from 'vitest'
import {
	AccountAlertsEvent,
	AccountReviewUpdateEvent,
	AccountUpdateEvent,
	type BusinessAccountEventInit,
	BusinessCapabilityUpdateEvent,
	type BusinessEventMap,
	BusinessUsernameUpdateEvent,
	HistoryEvent,
	MessageTemplateCategoryUpdateEvent,
	MessageTemplateComponentsUpdateEvent,
	MessageTemplateQualityUpdateEvent,
	MessageTemplateStatusUpdateEvent,
	MessageTemplateStatusUpdateEventEnum,
	PaymentConfigurationUpdateEvent,
	PhoneNumberNameUpdateEvent,
	PhoneNumberQualityUpdateEvent,
	SecurityEvent,
	SmbAppStateSyncEvent,
	SmbMessageEchoesEvent,
	UserIdUpdateEvent,
	UserPreferencesEvent
} from '../../src/events/business-events'
import { dispatchBusinessChange } from '../../src/webhook/business-dispatch'
import { type DispatchContext, type EmitFn } from '../../src/webhook/dispatch-context'
import { type WebhookEntry } from '../../src/webhook/payload'

const WABA_ID = '102290129340398'
const ENTRY_TIME = 1731705721
const METADATA = { display_phone_number: '15550783881', phone_number_id: '106540352242922' }

interface Recorded {
	calls: { event: string; data: unknown }[]
	errors: { message: string; meta?: Record<string, unknown> }[]
	warnings: string[]
	context: DispatchContext
}

function fakeContext(): Recorded {
	const calls: Recorded['calls'] = []
	const errors: Recorded['errors'] = []
	const warnings: string[] = []
	const emit: EmitFn = (event, data) => {
		calls.push({ event, data })
	}
	const noop = () => undefined
	const context: DispatchContext = {
		emit,
		logger: {
			debug: noop,
			info: noop,
			warn: message => {
				warnings.push(message)
			},
			error: (message, meta) => {
				errors.push({ message, meta })
			}
		},
		messagingFor: () => {
			throw new Error('messagingFor is not used by business events')
		}
	}
	return { calls, errors, warnings, context }
}

function entryFor(
	field: string,
	value: unknown,
	time: number | undefined = ENTRY_TIME
): WebhookEntry {
	return { id: WABA_ID, time, changes: [{ field, value }] }
}

/** Dispatches one change and returns the recorder plus the dispatcher's return value. */
function dispatch(field: string, value: unknown, time?: number) {
	const recorded = fakeContext()
	const entry = entryFor(field, value, time ?? ENTRY_TIME)
	const handled = dispatchBusinessChange(recorded.context, entry, entry.changes[0]!)
	return { ...recorded, handled }
}

/** Dispatches one change and returns the single emitted event, checking its name and class. */
function emitted<K extends keyof BusinessEventMap>(
	field: string,
	value: unknown,
	name: K,
	ctor: new (init: BusinessAccountEventInit) => BusinessEventMap[K]
): BusinessEventMap[K] {
	const { calls, errors, handled } = dispatch(field, value)
	expect(handled).toBe(true)
	expect(errors).toEqual([])
	expect(calls).toHaveLength(1)
	expect(calls[0]?.event).toBe(name)
	const data = calls[0]?.data
	expect(data).toBeInstanceOf(ctor)
	const event = data as BusinessEventMap[K]
	expect(event.businessAccountId).toBe(WABA_ID)
	expect(event.timestamp).toBe(ENTRY_TIME)
	expect(event.raw).toBe(value)
	return event
}

describe('dispatchBusinessChange: templates', () => {
	it('message_template_status_update (approved)', () => {
		const event = emitted(
			'message_template_status_update',
			{
				event: 'APPROVED',
				message_template_id: 594425479261596,
				message_template_name: 'order_confirmation',
				message_template_language: 'en_US',
				reason: 'NONE',
				message_template_category: 'UTILITY'
			},
			'MessageTemplateStatusUpdate',
			MessageTemplateStatusUpdateEvent
		)
		expect(event.event).toBe(MessageTemplateStatusUpdateEventEnum.Approved)
		expect(event.messageTemplateId).toBe('594425479261596')
		expect(event.messageTemplateName).toBe('order_confirmation')
		expect(event.messageTemplateLanguage).toBe('en_US')
		expect(event.reason).toBe('NONE')
		expect(event.messageTemplateCategory).toBe('UTILITY')
		expect(event.disableInfo).toBeUndefined()
		expect(event.rejectionInfo).toBeUndefined()
	})

	it('message_template_status_update (rejected, with rejection_info)', () => {
		const event = emitted(
			'message_template_status_update',
			{
				event: 'REJECTED',
				message_template_id: 806312974732579,
				message_template_name: 'summer_sale',
				message_template_language: 'en_US',
				reason: 'INVALID_FORMAT',
				rejection_info: {
					reason: 'The template has a formatting issue.',
					recommendation: 'Remove the duplicate variable.'
				}
			},
			'MessageTemplateStatusUpdate',
			MessageTemplateStatusUpdateEvent
		)
		expect(event.event).toBe('REJECTED')
		expect(event.reason).toBe('INVALID_FORMAT')
		expect(event.rejectionInfo).toEqual({
			reason: 'The template has a formatting issue.',
			recommendation: 'Remove the duplicate variable.'
		})
	})

	it('message_template_status_update (flagged with disable_info, paused with other_info)', () => {
		const flagged = emitted(
			'message_template_status_update',
			{
				event: 'FLAGGED',
				message_template_id: 1,
				message_template_name: 'promo',
				message_template_language: 'en_US',
				reason: null,
				disable_info: { disable_date: 1732310521 }
			},
			'MessageTemplateStatusUpdate',
			MessageTemplateStatusUpdateEvent
		)
		expect(flagged.reason).toBeUndefined()
		expect(flagged.disableInfo).toEqual({ disableDate: 1732310521 })

		const paused = emitted(
			'message_template_status_update',
			{
				event: 'PAUSED',
				message_template_id: 2,
				message_template_name: 'promo',
				message_template_language: 'en_US',
				reason: 'NONE',
				other_info: {
					title: 'FIRST_PAUSE',
					description: 'Your template has been paused for 3 hours due to low quality.'
				}
			},
			'MessageTemplateStatusUpdate',
			MessageTemplateStatusUpdateEvent
		)
		expect(paused.otherInfo?.title).toBe('FIRST_PAUSE')
		expect(paused.otherInfo?.description).toContain('paused')
	})

	it('message_template_quality_update', () => {
		const event = emitted(
			'message_template_quality_update',
			{
				previous_quality_score: 'GREEN',
				new_quality_score: 'YELLOW',
				message_template_id: 806312974732579,
				message_template_name: 'welcome_template',
				message_template_language: 'en_US'
			},
			'MessageTemplateQualityUpdate',
			MessageTemplateQualityUpdateEvent
		)
		expect(event.previousQualityScore).toBe('GREEN')
		expect(event.newQualityScore).toBe('YELLOW')
		expect(event.messageTemplateId).toBe('806312974732579')
		expect(event.messageTemplateName).toBe('welcome_template')
	})

	it('template_category_update', () => {
		const event = emitted(
			'template_category_update',
			{
				message_template_id: 806312974732579,
				message_template_name: 'welcome_template',
				message_template_language: 'en_US',
				previous_category: 'UTILITY',
				new_category: 'MARKETING',
				correct_category: 'MARKETING'
			},
			'MessageTemplateCategoryUpdate',
			MessageTemplateCategoryUpdateEvent
		)
		expect(event.previousCategory).toBe('UTILITY')
		expect(event.newCategory).toBe('MARKETING')
		expect(event.correctCategory).toBe('MARKETING')
	})

	it('message_template_components_update', () => {
		const event = emitted(
			'message_template_components_update',
			{
				message_template_id: 12345678,
				message_template_name: 'order_shipped',
				message_template_language: 'en_US',
				message_template_title: 'Your order shipped',
				message_template_element: 'Hi {{1}}, order {{2}} is on its way.',
				message_template_footer: 'Lucky Shrub',
				message_template_buttons: [
					{
						message_template_button_type: 'URL',
						message_template_button_text: 'Track',
						message_template_button_url: 'https://example.com/track/{{1}}'
					},
					{
						message_template_button_type: 'PHONE_NUMBER',
						message_template_button_text: 'Call us',
						message_template_button_phone_number: '+15550783881'
					}
				]
			},
			'MessageTemplateComponentsUpdate',
			MessageTemplateComponentsUpdateEvent
		)
		expect(event.messageTemplateElement).toBe('Hi {{1}}, order {{2}} is on its way.')
		expect(event.messageTemplateTitle).toBe('Your order shipped')
		expect(event.messageTemplateFooter).toBe('Lucky Shrub')
		expect(event.messageTemplateButtons).toEqual([
			{
				messageTemplateButtonType: 'URL',
				messageTemplateButtonText: 'Track',
				messageTemplateButtonUrl: 'https://example.com/track/{{1}}',
				messageTemplateButtonPhoneNumber: undefined
			},
			{
				messageTemplateButtonType: 'PHONE_NUMBER',
				messageTemplateButtonText: 'Call us',
				messageTemplateButtonUrl: undefined,
				messageTemplateButtonPhoneNumber: '+15550783881'
			}
		])
	})
})

describe('dispatchBusinessChange: phone numbers', () => {
	it('phone_number_name_update', () => {
		const event = emitted(
			'phone_number_name_update',
			{
				display_phone_number: '15550783881',
				decision: 'REJECTED',
				requested_verified_name: 'Lucky Shrub',
				rejection_reason: 'NAME_FORMAT_UNACCEPTABLE'
			},
			'PhoneNumberNameUpdate',
			PhoneNumberNameUpdateEvent
		)
		expect(event.displayPhoneNumber).toBe('15550783881')
		expect(event.decision).toBe('REJECTED')
		expect(event.requestedVerifiedName).toBe('Lucky Shrub')
		expect(event.rejectionReason).toBe('NAME_FORMAT_UNACCEPTABLE')
	})

	it('phone_number_quality_update', () => {
		const event = emitted(
			'phone_number_quality_update',
			{
				display_phone_number: '15550783881',
				event: 'UPGRADE',
				current_limit: 'TIER_10K',
				old_limit: 'TIER_2K',
				max_daily_conversations_per_business: 'TIER_10K'
			},
			'PhoneNumberQualityUpdate',
			PhoneNumberQualityUpdateEvent
		)
		expect(event.displayPhoneNumber).toBe('15550783881')
		expect(event.event).toBe('UPGRADE')
		expect(event.currentLimit).toBe('TIER_10K')
		expect(event.oldLimit).toBe('TIER_2K')
		expect(event.maxDailyConversationsPerBusiness).toBe('TIER_10K')
	})

	it('security', () => {
		const event = emitted(
			'security',
			{
				display_phone_number: '15550783881',
				event: 'PIN_CHANGED',
				requester: '2513324895595123'
			},
			'Security',
			SecurityEvent
		)
		expect(event.displayPhoneNumber).toBe('15550783881')
		expect(event.event).toBe('PIN_CHANGED')
		expect(event.requester).toBe('2513324895595123')
	})

	it('business_username_update', () => {
		const event = emitted(
			'business_username_update',
			{
				metadata: METADATA,
				username: 'luckyshrub',
				previous_username: 'lucky.shrub',
				event: 'APPROVED'
			},
			'BusinessUsernameUpdate',
			BusinessUsernameUpdateEvent
		)
		expect(event.phoneNumber).toEqual({
			id: '106540352242922',
			displayPhoneNumber: '15550783881'
		})
		expect(event.username).toBe('luckyshrub')
		expect(event.previousUsername).toBe('lucky.shrub')
		expect(event.event).toBe('APPROVED')
	})
})

describe('dispatchBusinessChange: account', () => {
	it('account_update (VERIFIED_ACCOUNT)', () => {
		const event = emitted(
			'account_update',
			{ phone_number: '15550783881', event: 'VERIFIED_ACCOUNT' },
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(event.event).toBe('VERIFIED_ACCOUNT')
		expect(event.phoneNumber).toBe('15550783881')
		expect(event.banInfo).toBeUndefined()
	})

	it('account_update (DISABLED_UPDATE with ban_info)', () => {
		const event = emitted(
			'account_update',
			{
				event: 'DISABLED_UPDATE',
				ban_info: { waba_ban_state: ['DISABLE'], waba_ban_date: '2024-11-15' }
			},
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(event.banInfo).toEqual({ wabaBanState: ['DISABLE'], wabaBanDate: '2024-11-15' })
	})

	it('account_update (ACCOUNT_RESTRICTION, list or single restriction_info)', () => {
		const list = emitted(
			'account_update',
			{
				event: 'ACCOUNT_RESTRICTION',
				restriction_info: [
					{
						restriction_type: 'RESTRICTED_BIZ_INITIATED_MESSAGING',
						expiration: 1732310521
					},
					{
						restriction_type: 'RESTRICTED_ADD_PHONE_NUMBER_ACTION',
						expiration: '1732310522'
					}
				]
			},
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(list.restrictionInfo).toEqual([
			{ restrictionType: 'RESTRICTED_BIZ_INITIATED_MESSAGING', expiration: 1732310521 },
			{ restrictionType: 'RESTRICTED_ADD_PHONE_NUMBER_ACTION', expiration: 1732310522 }
		])

		const single = emitted(
			'account_update',
			{
				event: 'ACCOUNT_RESTRICTION',
				restriction_info: { restriction_type: 'RESTRICTED_CUSTOMER_INITIATED_MESSAGING' }
			},
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(single.restrictionInfo).toEqual([
			{ restrictionType: 'RESTRICTED_CUSTOMER_INITIATED_MESSAGING', expiration: undefined }
		])
	})

	it('account_update (violation, partner, eligibility, certification, country)', () => {
		const violation = emitted(
			'account_update',
			{ event: 'ACCOUNT_VIOLATION', violation_info: { violation_type: 'SCAM' } },
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(violation.violationInfo).toEqual({ violationType: 'SCAM' })

		const partner = emitted(
			'account_update',
			{
				event: 'PARTNER_ADDED',
				waba_info: {
					waba_id: WABA_ID,
					owner_business_id: '1234567890',
					solution_id: '555',
					solution_partner_business_ids: ['111', '222']
				}
			},
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(partner.wabaInfo).toEqual({
			wabaId: WABA_ID,
			ownerBusinessId: '1234567890',
			adAccountLinked: undefined,
			partnerAppId: undefined,
			solutionId: '555',
			solutionPartnerBusinessIds: ['111', '222']
		})

		const eligibility = emitted(
			'account_update',
			{
				event: 'AUTH_INTL_PRICE_ELIGIBILITY_UPDATE',
				auth_international_rate_eligibility: {
					start_time: 1717200000,
					exception_countries: [{ country_code: 'ID', start_time: 1719792000 }]
				}
			},
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(eligibility.authInternationalRateEligibility).toEqual({
			startTime: 1717200000,
			exceptionCountries: [{ countryCode: 'ID', startTime: 1719792000 }]
		})

		const certification = emitted(
			'account_update',
			{
				event: 'PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE',
				partner_client_certification_info: {
					client_business_id: '987',
					status: 'REJECTED',
					rejection_reasons: ['LEGAL_NAME_NOT_MATCHING']
				}
			},
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(certification.partnerClientCertificationInfo).toEqual({
			clientBusinessId: '987',
			status: 'REJECTED',
			rejectionReasons: ['LEGAL_NAME_NOT_MATCHING']
		})

		const country = emitted(
			'account_update',
			{ event: 'BUSINESS_PRIMARY_LOCATION_COUNTRY_UPDATE', country: 'IN' },
			'AccountUpdate',
			AccountUpdateEvent
		)
		expect(country.country).toBe('IN')
	})

	it('account_review_update', () => {
		const event = emitted(
			'account_review_update',
			{ decision: 'APPROVED' },
			'AccountReviewUpdate',
			AccountReviewUpdateEvent
		)
		expect(event.decision).toBe('APPROVED')
	})

	it('account_alerts', () => {
		const event = emitted(
			'account_alerts',
			{
				entity_type: 'WABA',
				entity_id: WABA_ID,
				alert_info: {
					alert_severity: 'WARNING',
					alert_status: 'NONE',
					alert_type: 'INCREASED_CAPABILITIES_ELIGIBILITY_NEED_MORE_INFO',
					alert_description: 'Your account needs more information to raise its limit.'
				}
			},
			'AccountAlerts',
			AccountAlertsEvent
		)
		expect(event.entityType).toBe('WABA')
		expect(event.entityId).toBe(WABA_ID)
		expect(event.alertSeverity).toBe('WARNING')
		expect(event.alertStatus).toBe('NONE')
		expect(event.alertType).toBe('INCREASED_CAPABILITIES_ELIGIBILITY_NEED_MORE_INFO')
		expect(event.alertDescription).toContain('more information')
	})

	it('business_capability_update', () => {
		const event = emitted(
			'business_capability_update',
			{ max_daily_conversation_per_phone: 1000, max_phone_numbers_per_business: 2 },
			'BusinessCapabilityUpdate',
			BusinessCapabilityUpdateEvent
		)
		expect(event.maxDailyConversationPerPhone).toBe(1000)
		expect(event.maxPhoneNumbersPerBusiness).toBe(2)
		expect(event.maxDailyConversationsPerBusiness).toBeUndefined()
	})

	it('payment_configuration_update', () => {
		const event = emitted(
			'payment_configuration_update',
			{
				configuration_name: 'test-payment-configuration',
				provider_name: 'razorpay',
				provider_mid: 'acc_123',
				status: 'Active',
				created_timestamp: 1720764000,
				updated_timestamp: 1720765000
			},
			'PaymentConfigurationUpdate',
			PaymentConfigurationUpdateEvent
		)
		expect(event.configurationName).toBe('test-payment-configuration')
		expect(event.providerName).toBe('razorpay')
		expect(event.providerMid).toBe('acc_123')
		expect(event.status).toBe('Active')
		expect(event.createdTimestamp).toBe(1720764000)
		expect(event.updatedTimestamp).toBe(1720765000)
	})
})

describe('dispatchBusinessChange: users', () => {
	it('user_preferences', () => {
		const event = emitted(
			'user_preferences',
			{
				messaging_product: 'whatsapp',
				metadata: METADATA,
				contacts: [{ wa_id: '16505551234', profile: { name: 'Pablo Morales' } }],
				user_preferences: [
					{
						wa_id: '16505551234',
						detail: 'User requested to stop marketing messages',
						category: 'marketing_messages',
						value: 'stop',
						timestamp: 1731705721
					}
				]
			},
			'UserPreferences',
			UserPreferencesEvent
		)
		expect(event.phoneNumber.id).toBe('106540352242922')
		expect(event.contacts).toEqual([
			{ waId: '16505551234', userId: undefined, name: 'Pablo Morales' }
		])
		expect(event.userPreferences).toEqual([
			{
				waId: '16505551234',
				userId: undefined,
				detail: 'User requested to stop marketing messages',
				category: 'marketing_messages',
				value: 'stop',
				timestamp: 1731705721
			}
		])
	})

	it('user_id_update (old/new and user_id fallback)', () => {
		const event = emitted(
			'user_id_update',
			{
				wa_id: '16505551234',
				old_user_id: 'US.13491208655302741918',
				new_user_id: 'US.98216412093820461922',
				parent_user_id: 'US.ENT.11815799212886844830'
			},
			'UserIdUpdate',
			UserIdUpdateEvent
		)
		expect(event.waId).toBe('16505551234')
		expect(event.oldUserId).toBe('US.13491208655302741918')
		expect(event.newUserId).toBe('US.98216412093820461922')
		expect(event.parentUserId).toBe('US.ENT.11815799212886844830')

		const fallback = emitted(
			'user_id_update',
			{ wa_id: '16505551234', user_id: 'US.98216412093820461922' },
			'UserIdUpdate',
			UserIdUpdateEvent
		)
		expect(fallback.newUserId).toBe('US.98216412093820461922')
		expect(fallback.userId).toBe('US.98216412093820461922')
		expect(fallback.oldUserId).toBeUndefined()
	})
})

describe('dispatchBusinessChange: WhatsApp Business app (coexistence)', () => {
	it('smb_app_state_sync', () => {
		const event = emitted(
			'smb_app_state_sync',
			{
				messaging_product: 'whatsapp',
				metadata: METADATA,
				state_sync: [
					{
						type: 'contact',
						contact: {
							full_name: 'Pablo Morales',
							first_name: 'Pablo',
							phone_number: '16505551234'
						},
						action: 'add',
						metadata: { timestamp: '1700000000' }
					},
					{
						type: 'contact',
						contact: { phone_number: '16505550000' },
						action: 'remove',
						metadata: { timestamp: '1700000100' }
					}
				]
			},
			'SmbAppStateSync',
			SmbAppStateSyncEvent
		)
		expect(event.messagingProduct).toBe('whatsapp')
		expect(event.phoneNumber).toEqual({
			id: '106540352242922',
			displayPhoneNumber: '15550783881'
		})
		expect(event.stateSync).toHaveLength(2)
		expect(event.stateSync[0]).toEqual({
			type: 'contact',
			contact: { fullName: 'Pablo Morales', firstName: 'Pablo', phoneNumber: '16505551234' },
			action: 'add',
			timestamp: 1700000000
		})
		expect(event.stateSync[1]?.action).toBe('remove')
	})

	it('smb_message_echoes (with type-specific content)', () => {
		const event = emitted(
			'smb_message_echoes',
			{
				messaging_product: 'whatsapp',
				metadata: METADATA,
				message_echoes: [
					{
						from: '15550783881',
						to: '16505551234',
						id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgARGBJDQjZCMzlEQUE4OTJBMTE4RTUA',
						timestamp: '1700000000',
						type: 'text',
						text: { body: 'Your order is ready for pickup.' }
					},
					{
						from: '15550783881',
						to: '16505551234',
						id: 'wamid.2',
						timestamp: '1700000100',
						type: 'image',
						image: {
							id: '1479537139650973',
							mime_type: 'image/jpeg',
							sha256: 'abc',
							caption: 'Receipt'
						}
					}
				]
			},
			'SmbMessageEchoes',
			SmbMessageEchoesEvent
		)
		expect(event.messageEchoes).toHaveLength(2)
		expect(event.messageEchoes[0]).toEqual({
			from: '15550783881',
			to: '16505551234',
			id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgARGBJDQjZCMzlEQUE4OTJBMTE4RTUA',
			timestamp: 1700000000,
			type: 'text',
			content: { body: 'Your order is ready for pickup.' }
		})
		expect(event.messageEchoes[1]?.content).toMatchObject({
			id: '1479537139650973',
			caption: 'Receipt'
		})
	})

	it('history (threads)', () => {
		const event = emitted(
			'history',
			{
				messaging_product: 'whatsapp',
				metadata: METADATA,
				history: [
					{
						metadata: { phase: 0, chunk_order: 1, progress: 55 },
						threads: [
							{
								id: '16505551234',
								messages: [
									{
										from: '16505551234',
										id: 'wamid.A',
										timestamp: '1700000000',
										type: 'text',
										text: { body: 'Is the fern in stock?' },
										history_context: { status: 'READ' }
									},
									{
										from: '15550783881',
										to: '16505551234',
										id: 'wamid.B',
										timestamp: '1700000100',
										type: 'text',
										text: { body: 'Yes!' },
										history_context: { status: 'DELIVERED' }
									}
								]
							}
						]
					}
				]
			},
			'History',
			HistoryEvent
		)
		expect(event.historyChunks).toHaveLength(1)
		const chunk = event.historyChunks[0]!
		expect(chunk.phase).toBe(0)
		expect(chunk.chunkOrder).toBe(1)
		expect(chunk.progress).toBe(55)
		expect(chunk.errors).toEqual([])
		expect(chunk.threads[0]?.id).toBe('16505551234')
		expect(chunk.threads[0]?.messages).toEqual([
			{
				from: '16505551234',
				to: undefined,
				id: 'wamid.A',
				timestamp: 1700000000,
				type: 'text',
				messageStatus: 'READ',
				content: { body: 'Is the fern in stock?' }
			},
			{
				from: '15550783881',
				to: '16505551234',
				id: 'wamid.B',
				timestamp: 1700000100,
				type: 'text',
				messageStatus: 'DELIVERED',
				content: { body: 'Yes!' }
			}
		])
	})

	it('history (declined, errors instead of threads)', () => {
		const event = emitted(
			'history',
			{
				messaging_product: 'whatsapp',
				metadata: METADATA,
				history: [
					{
						errors: [
							{
								code: 2593109,
								title: 'History sync is turned off by the business from the WhatsApp Business App',
								message:
									'History sync is turned off by the business from the WhatsApp Business App',
								error_data: {
									details: 'History sharing is turned off by the business'
								}
							}
						]
					}
				]
			},
			'History',
			HistoryEvent
		)
		const chunk = event.historyChunks[0]!
		expect(chunk.threads).toEqual([])
		expect(chunk.errors[0]?.code).toBe(2593109)
		expect(chunk.errors[0]?.details).toBe('History sharing is turned off by the business')
	})
})

describe('dispatchBusinessChange: routing', () => {
	it('emits each field under its own event name, never AccountAlerts (wapi.go bug)', () => {
		const routes: [string, keyof BusinessEventMap][] = [
			['account_review_update', 'AccountReviewUpdate'],
			['business_capability_update', 'BusinessCapabilityUpdate'],
			['message_template_quality_update', 'MessageTemplateQualityUpdate'],
			['message_template_status_update', 'MessageTemplateStatusUpdate'],
			['phone_number_name_update', 'PhoneNumberNameUpdate'],
			['phone_number_quality_update', 'PhoneNumberQualityUpdate'],
			['template_category_update', 'MessageTemplateCategoryUpdate'],
			['security', 'Security']
		]
		for (const [field, name] of routes) {
			const { calls, handled } = dispatch(field, {})
			expect(handled).toBe(true)
			expect(calls.map(call => call.event)).toEqual([name])
		}
	})

	it("accepts wapi.go's short field names as aliases", () => {
		const aliases: [string, keyof BusinessEventMap][] = [
			['message_template_status', 'MessageTemplateStatusUpdate'],
			['message_template_quality', 'MessageTemplateQualityUpdate'],
			['template_category', 'MessageTemplateCategoryUpdate'],
			['phone_number_name', 'PhoneNumberNameUpdate'],
			['phone_number_quality', 'PhoneNumberQualityUpdate'],
			['account_review', 'AccountReviewUpdate'],
			['business_capability', 'BusinessCapabilityUpdate'],
			['business_username_updates', 'BusinessUsernameUpdate']
		]
		for (const [field, name] of aliases) {
			const { calls, handled } = dispatch(field, {})
			expect(handled).toBe(true)
			expect(calls.map(call => call.event)).toEqual([name])
		}
	})

	it('returns false for an unknown field without emitting or logging', () => {
		for (const field of ['some_future_field', 'messages', '']) {
			const { calls, errors, handled } = dispatch(field, { anything: true })
			expect(handled).toBe(false)
			expect(calls).toEqual([])
			expect(errors).toEqual([])
		}
	})

	it('uses timestamp 0 when entry.time is missing', () => {
		const recorded = fakeContext()
		const entry: WebhookEntry = {
			id: WABA_ID,
			changes: [{ field: 'account_review_update', value: { decision: 'APPROVED' } }]
		}
		expect(dispatchBusinessChange(recorded.context, entry, entry.changes[0]!)).toBe(true)
		const event = recorded.calls[0]?.data
		expect(event).toBeInstanceOf(AccountReviewUpdateEvent)
		expect((event as AccountReviewUpdateEvent).timestamp).toBe(0)
	})
})

describe('dispatchBusinessChange: malformed values', () => {
	it('logs and skips a non-object value without throwing', () => {
		for (const value of ['not an object', null, undefined, 42, [1, 2, 3]]) {
			const { calls, errors, handled } = dispatch('message_template_status_update', value)
			expect(handled).toBe(true)
			expect(calls).toEqual([])
			expect(errors).toHaveLength(1)
			expect(errors[0]?.message).toBe('skipping undecodable webhook change')
			expect(errors[0]?.meta?.field).toBe('message_template_status_update')
			expect(errors[0]?.meta?.error).toBeInstanceOf(Error)
		}
	})

	it('tolerates wrongly typed nested fields', () => {
		const history = dispatch('history', { history: 'oops', metadata: 7 })
		expect(history.errors).toEqual([])
		const historyEvent = history.calls[0]?.data as HistoryEvent
		expect(historyEvent.historyChunks).toEqual([])
		expect(historyEvent.phoneNumber).toEqual({ id: '', displayPhoneNumber: '' })

		const components = dispatch('message_template_components_update', {
			message_template_id: { nested: true },
			message_template_buttons: [null, 'x', { message_template_button_type: 5 }]
		})
		expect(components.errors).toEqual([])
		const componentsEvent = components.calls[0]?.data as MessageTemplateComponentsUpdateEvent
		expect(componentsEvent.messageTemplateId).toBe('')
		expect(componentsEvent.messageTemplateButtons).toEqual([
			{
				messageTemplateButtonType: '5',
				messageTemplateButtonText: '',
				messageTemplateButtonUrl: undefined,
				messageTemplateButtonPhoneNumber: undefined
			}
		])

		const account = dispatch('account_update', {
			event: 'ACCOUNT_RESTRICTION',
			restriction_info: 'bad',
			ban_info: { waba_ban_state: 'DISABLE' },
			auth_international_rate_eligibility: { exception_countries: {} }
		})
		expect(account.errors).toEqual([])
		const accountEvent = account.calls[0]?.data as AccountUpdateEvent
		expect(accountEvent.restrictionInfo).toEqual([])
		expect(accountEvent.banInfo?.wabaBanState).toEqual(['DISABLE'])
		expect(accountEvent.authInternationalRateEligibility?.exceptionCountries).toEqual([])

		const prefs = dispatch('user_preferences', {
			user_preferences: { wa_id: '1' },
			contacts: null
		})
		expect(prefs.errors).toEqual([])
		const prefsEvent = prefs.calls[0]?.data as UserPreferencesEvent
		expect(prefsEvent.userPreferences).toEqual([])
		expect(prefsEvent.contacts).toEqual([])
	})
})
