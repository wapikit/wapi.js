import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/errors'
import { RequestClient } from '../../src/internal/request-client'
import {
	AnalyticsGranularity,
	BusinessAccountManager,
	ConversationAnalyticsGranularity,
	ConversationCategory,
	ConversationDimension,
	PricingAnalyticsDimension,
	PricingCategory,
	WABA_FIELDS
} from '../../src/managers/business'

interface RecordedCall {
	url: string
	method: string
	body: unknown
}

function setup(responses: unknown[]) {
	const calls: RecordedCall[] = []
	const queue = [...responses]
	const fetch = async (input: string, init: RequestInit): Promise<Response> => {
		calls.push({
			url: input,
			method: init.method ?? 'GET',
			body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined
		})
		return new Response(JSON.stringify(queue.shift() ?? {}), { status: 200 })
	}
	const requester = new RequestClient({ accessToken: 't', fetch })
	return { calls, manager: new BusinessAccountManager(requester, 'waba1') }
}

const BASE = 'https://graph.facebook.com/v20.0'
const START = new Date('2024-01-01T00:00:00Z') // 1704067200
const END = 1704153600

function fields(call: RecordedCall | undefined): string | null {
	return new URL(call?.url ?? '').searchParams.get('fields')
}

describe('BusinessAccountManager', () => {
	it("fetches the WABA with wapi.go's fields", async () => {
		const waba = {
			id: 'waba1',
			name: 'Acme',
			currency: 'USD',
			owner_business_info: { id: 'b1', name: 'Acme Inc' },
			marketing_messages_onboarding_status: 'ONBOARDED'
		}
		const { calls, manager } = setup([waba])
		const result = await manager.fetch()
		expect(calls[0]?.url.startsWith(`${BASE}/waba1?`)).toBe(true)
		expect(fields(calls[0])).toBe(
			'id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,country,ownership_type,primary_business_location,currency,owner_business_info,marketing_messages_onboarding_status'
		)
		expect(WABA_FIELDS).toHaveLength(12)
		expect(result).toEqual(waba)
	})

	it('renders analytics modifiers like wapi.go (empty filters)', async () => {
		const response = {
			id: 'waba1',
			analytics: {
				granularity: 'DAY',
				data_points: [{ start: 1, end: 2, sent: 3, delivered: 2 }]
			}
		}
		const { calls, manager } = setup([response])
		const result = await manager.analytics({
			start: START,
			end: END,
			granularity: AnalyticsGranularity.Day
		})
		expect(fields(calls[0])).toBe(
			'analytics.country_codes([]).end(1704153600).granularity(DAY).phone_numbers([]).start(1704067200)'
		)
		expect(result.analytics?.data_points?.[0]?.sent).toBe(3)
	})

	it('renders analytics list filters like wapi.go (comma separated)', async () => {
		const { calls, manager } = setup([{ id: 'waba1' }])
		await manager.analytics({
			start: 1704067200,
			end: END,
			granularity: 'MONTH',
			phoneNumbers: ['15550100', '15550101'],
			countryCodes: ['US']
		})
		expect(fields(calls[0])).toBe(
			'analytics.country_codes(["US"]).end(1704153600).granularity(MONTH).phone_numbers(["15550100","15550101"]).start(1704067200)'
		)
	})

	it('renders conversation analytics modifiers like wapi.go', async () => {
		const response = {
			id: 'waba1',
			conversation_analytics: {
				data: [
					{
						data_points: [
							{ start: 1, end: 2, conversation: 5, cost: 0.25, country: 'US' }
						]
					}
				]
			}
		}
		const { calls, manager } = setup([response, { id: 'waba1' }])
		const result = await manager.conversationAnalytics({
			start: START,
			end: END,
			granularity: ConversationAnalyticsGranularity.Daily
		})
		expect(fields(calls[0])).toBe(
			'conversation_analytics.conversation_categories([]).conversation_directions([]).conversation_types([]).dimensions([]).end(1704153600).granularity(DAILY).phone_numbers([]).start(1704067200)'
		)
		expect(result.conversation_analytics?.data[0]?.data_points[0]?.cost).toBe(0.25)

		await manager.conversationAnalytics({
			start: START,
			end: END,
			granularity: 'MONTHLY',
			phoneNumbers: ['1555'],
			conversationCategories: [ConversationCategory.Marketing, ConversationCategory.Utility],
			conversationTypes: ['REGULAR'],
			conversationDirections: ['BUSINESS_INITIATED'],
			dimensions: [ConversationDimension.Country, ConversationDimension.Phone]
		})
		expect(fields(calls[1])).toBe(
			'conversation_analytics.conversation_categories(["MARKETING","UTILITY"]).conversation_directions(["BUSINESS_INITIATED"]).conversation_types(["REGULAR"]).dimensions(["COUNTRY","PHONE"]).end(1704153600).granularity(MONTHLY).phone_numbers(["1555"]).start(1704067200)'
		)
	})

	it('renders pricing analytics with JSON array filters', async () => {
		const response = {
			id: 'waba1',
			pricing_analytics: {
				data: [{ data_points: [{ start: 1, end: 2, volume: 10, cost: 1.5 }] }]
			}
		}
		const { calls, manager } = setup([response])
		const result = await manager.pricingAnalytics({
			start: START,
			end: END,
			granularity: 'DAILY',
			countryCodes: ['US', 'BR'],
			pricingCategories: [PricingCategory.Marketing],
			dimensions: [PricingAnalyticsDimension.Country]
		})
		expect(fields(calls[0])).toBe(
			'pricing_analytics.country_codes(["US","BR"]).dimensions(["COUNTRY"]).end(1704153600).granularity(DAILY).pricing_categories(["MARKETING"]).start(1704067200)'
		)
		expect(result.pricing_analytics?.data[0]?.data_points[0]?.volume).toBe(10)
	})

	it('validates timestamps', async () => {
		const { calls, manager } = setup([])
		await expect(
			manager.analytics({ start: new Date('nope'), end: END, granularity: 'DAY' })
		).rejects.toBeInstanceOf(ValidationError)
		expect(calls).toHaveLength(0)
	})

	it('subscribes, lists and unsubscribes apps', async () => {
		const apps = { data: [{ whatsapp_business_api_data: { id: 'app1', name: 'Bot' } }] }
		const { calls, manager } = setup([
			{ success: true },
			{ success: true },
			apps,
			{ success: true }
		])
		await manager.subscribeApp()
		await manager.subscribeApp({
			overrideCallbackUri: 'https://hook.test/wa',
			verifyToken: 'vt'
		})
		const listed = await manager.listSubscribedApps()
		const removed = await manager.unsubscribeApp()
		expect(calls[0]).toEqual({
			url: `${BASE}/waba1/subscribed_apps`,
			method: 'POST',
			body: undefined
		})
		expect(calls[1]?.body).toEqual({
			override_callback_uri: 'https://hook.test/wa',
			verify_token: 'vt'
		})
		expect(calls[2]).toEqual({
			url: `${BASE}/waba1/subscribed_apps`,
			method: 'GET',
			body: undefined
		})
		expect(calls[3]).toEqual({
			url: `${BASE}/waba1/subscribed_apps`,
			method: 'DELETE',
			body: undefined
		})
		expect(listed.data[0]?.whatsapp_business_api_data.id).toBe('app1')
		expect(removed.success).toBe(true)
	})

	it('requires a verify token with an override callback', async () => {
		const { manager } = setup([])
		await expect(
			manager.subscribeApp({ overrideCallbackUri: 'https://hook.test/wa' })
		).rejects.toBeInstanceOf(ValidationError)
	})
})
