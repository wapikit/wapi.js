import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/errors'
import { RequestClient } from '../../src/internal/request-client'
import {
	BUSINESS_PROFILE_FIELDS,
	PHONE_NUMBER_FIELDS,
	PhoneNumberManager,
	QrImageFormat,
	VerifyCodeMethod
} from '../../src/managers/phone-number'

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
	return { calls, manager: new PhoneNumberManager(requester, 'waba1') }
}

const BASE = 'https://graph.facebook.com/v20.0'
const GO_FIELDS =
	'id,account_mode,certificate,code_verification_status,conversational_automation,display_phone_number,health_status,eligibility_for_api_business_global_search,is_official_business_account,is_on_biz_app,is_pin_enabled,is_preverified_number,last_onboarded_time,messaging_limit_tier,name_status,new_certificate,new_display_name,new_name_status,official_business_account,platform_type,quality_score,search_visibility,status,throughput,verified_name'

function params(call: RecordedCall | undefined): URLSearchParams {
	return new URL(call?.url ?? '').searchParams
}

function pathOf(call: RecordedCall | undefined): string {
	const url = new URL(call?.url ?? '')
	return url.origin + url.pathname
}

describe('PhoneNumberManager', () => {
	it("uses exactly wapi.go's field list, with no repeats", () => {
		expect(PHONE_NUMBER_FIELDS.join(',')).toBe(GO_FIELDS)
		expect(new Set(PHONE_NUMBER_FIELDS).size).toBe(PHONE_NUMBER_FIELDS.length)
	})

	it('lists LIVE numbers by default', async () => {
		const { calls, manager } = setup([
			{ data: [{ id: 'p1', display_phone_number: '+1 555', account_mode: 'LIVE' }] }
		])
		const page = await manager.list()
		expect(pathOf(calls[0])).toBe(`${BASE}/waba1/phone_numbers`)
		const q = params(calls[0])
		expect(q.get('fields')).toBe(GO_FIELDS)
		expect(q.get('filtering')).toBe(
			'[{"field":"account_mode","operator":"EQUAL","value":"LIVE"}]'
		)
		expect(q.get('limit')).toBe('100')
		expect(page.data[0]?.id).toBe('p1')
	})

	it('lists SANDBOX numbers when asked', async () => {
		const { calls, manager } = setup([{ data: [] }])
		await manager.list({ sandbox: true, limit: 10 })
		const q = params(calls[0])
		expect(q.get('filtering')).toBe(
			'[{"field":"account_mode","operator":"EQUAL","value":"SANDBOX"}]'
		)
		expect(q.get('limit')).toBe('10')
	})

	it('listAll follows cursors', async () => {
		const { calls, manager } = setup([
			{ data: [{ id: 'p1' }], paging: { cursors: { after: 'A' }, next: 'n' } },
			{ data: [{ id: 'p2' }], paging: {} }
		])
		const all = await manager.listAll()
		expect(all.map(p => p.id)).toEqual(['p1', 'p2'])
		expect(params(calls[1]).get('after')).toBe('A')
	})

	it('gets a phone number', async () => {
		const { calls, manager } = setup([{ id: 'p1', quality_rating: 'GREEN' }])
		const result = await manager.get('p1')
		expect(pathOf(calls[0])).toBe(`${BASE}/p1`)
		expect(params(calls[0]).get('fields')).toBe(GO_FIELDS)
		expect(result.quality_rating).toBe('GREEN')
	})

	it('creates a phone number with query params', async () => {
		const { calls, manager } = setup([{ id: 'p9' }])
		const result = await manager.create({
			phoneNumber: '5550100',
			countryCode: '1',
			verifiedName: 'Acme'
		})
		expect(calls[0]?.url).toBe(
			`${BASE}/waba1/phone_numbers?cc=1&phone_number=5550100&verified_name=Acme`
		)
		expect(calls[0]?.method).toBe('POST')
		expect(result.id).toBe('p9')
	})

	it('requests and verifies a code', async () => {
		const { calls, manager } = setup([{ success: true }, { success: true }])
		await manager.requestVerificationCode('p1', {
			codeMethod: VerifyCodeMethod.Sms,
			language: 'en_US'
		})
		await manager.verifyCode('p1', '123456')
		expect(calls[0]?.url).toBe(`${BASE}/p1/request_code?code_method=SMS&language=en_US`)
		expect(calls[1]?.url).toBe(`${BASE}/p1/verify_code?code=123456`)
	})

	it('registers and deregisters', async () => {
		const { calls, manager } = setup([{ success: true }, { success: true }])
		const registered = await manager.register('p1', '123456')
		await manager.deregister('p1')
		expect(calls[0]).toEqual({
			url: `${BASE}/p1/register`,
			method: 'POST',
			body: { messaging_product: 'whatsapp', pin: '123456' }
		})
		expect(calls[1]).toEqual({ url: `${BASE}/p1/deregister`, method: 'POST', body: undefined })
		expect(registered.success).toBe(true)
	})

	it('validates the PIN', async () => {
		const { calls, manager } = setup([])
		await expect(manager.register('p1', '12345')).rejects.toBeInstanceOf(ValidationError)
		await expect(manager.setTwoStepVerificationPin('p1', 'abcdef')).rejects.toBeInstanceOf(
			ValidationError
		)
		expect(calls).toHaveLength(0)
	})

	it('sets the two-step verification PIN', async () => {
		const { calls, manager } = setup([{ success: true }])
		await manager.setTwoStepVerificationPin('p1', '654321')
		expect(calls[0]).toEqual({ url: `${BASE}/p1`, method: 'POST', body: { pin: '654321' } })
	})

	it('manages QR codes', async () => {
		const qr = {
			code: 'C1',
			prefilled_message: 'hi',
			deep_link_url: 'https://wa.me/message/C1'
		}
		const { calls, manager } = setup([
			{ ...qr, qr_image_url: 'https://img' },
			{ data: [qr] },
			{ data: [qr] },
			{ ...qr, prefilled_message: 'hello' },
			{ success: true }
		])
		const created = await manager.createQrCode('p1', { prefilledMessage: 'hi' })
		const list = await manager.listQrCodes('p1', { imageFormat: QrImageFormat.Svg })
		const one = await manager.getQrCode('p1', 'C1')
		await manager.updateQrCode('p1', 'C1', { prefilledMessage: 'hello' })
		await manager.deleteQrCode('p1', 'C1')

		expect(calls[0]).toEqual({
			url: `${BASE}/p1/message_qrdls`,
			method: 'POST',
			body: { prefilled_message: 'hi', generate_qr_image: 'PNG' }
		})
		expect(pathOf(calls[1])).toBe(`${BASE}/p1/message_qrdls`)
		expect(params(calls[1]).get('fields')).toBe(
			'code,prefilled_message,deep_link_url,qr_image_url.format(SVG)'
		)
		expect(calls[2]?.url).toBe(`${BASE}/p1/message_qrdls/C1`)
		expect(calls[3]?.body).toEqual({ code: 'C1', prefilled_message: 'hello' })
		expect(calls[4]).toEqual({
			url: `${BASE}/p1/message_qrdls/C1`,
			method: 'DELETE',
			body: undefined
		})
		expect(created.qr_image_url).toBe('https://img')
		expect(list.data).toHaveLength(1)
		expect(one).toEqual(qr)
	})

	it('manages the username', async () => {
		const { calls, manager } = setup([
			{ username: 'acme' },
			{ success: true },
			{ success: true }
		])
		const current = await manager.getUsername('p1')
		await manager.setUsername('p1', 'acme2')
		await manager.deleteUsername('p1')
		expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
			`GET ${BASE}/p1/username`,
			`POST ${BASE}/p1/username`,
			`DELETE ${BASE}/p1/username`
		])
		expect(calls[1]?.body).toEqual({ username: 'acme2' })
		expect(current.username).toBe('acme')
	})

	it('gets and updates the business profile', async () => {
		const profile = { about: 'We sell', vertical: 'RETAIL', websites: ['https://acme.test'] }
		const { calls, manager } = setup([{ data: [profile] }, { success: true }])
		const got = await manager.getBusinessProfile('p1')
		await manager.updateBusinessProfile('p1', { about: 'New', vertical: 'RETAIL' })
		expect(pathOf(calls[0])).toBe(`${BASE}/p1/whatsapp_business_profile`)
		expect(params(calls[0]).get('fields')).toBe(BUSINESS_PROFILE_FIELDS.join(','))
		expect(got).toEqual(profile)
		expect(calls[1]).toEqual({
			url: `${BASE}/p1/whatsapp_business_profile`,
			method: 'POST',
			body: { messaging_product: 'whatsapp', about: 'New', vertical: 'RETAIL' }
		})
	})

	it('rejects more than two websites', async () => {
		const { manager } = setup([])
		await expect(
			manager.updateBusinessProfile('p1', { websites: ['a', 'b', 'c'] })
		).rejects.toBeInstanceOf(ValidationError)
	})
})
