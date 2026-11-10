import { describe, expect, it } from 'vitest'
import { GraphApiError, ValidationError } from '../../src/errors'
import { RequestClient } from '../../src/internal/request-client'
import {
	MessageTemplateCategory,
	MessageTemplateComponentType,
	MessageTemplateStatus,
	TEMPLATE_FIELDS,
	TemplateManager,
	type MessageTemplate
} from '../../src/managers/template'

interface RecordedCall {
	url: string
	method: string
	body: unknown
}

function setup(responses: unknown[], status = 200) {
	const calls: RecordedCall[] = []
	const queue = [...responses]
	const fetch = async (input: string, init: RequestInit): Promise<Response> => {
		calls.push({
			url: input,
			method: init.method ?? 'GET',
			body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined
		})
		return new Response(JSON.stringify(queue.shift() ?? {}), { status })
	}
	const requester = new RequestClient({ accessToken: 't', fetch })
	return { calls, manager: new TemplateManager(requester, 'waba1') }
}

const BASE = 'https://graph.facebook.com/v20.0'
const FIELDS = encodeURIComponent(TEMPLATE_FIELDS.join(','))

const template: MessageTemplate = {
	id: 't1',
	name: 'order_update',
	language: 'en_US',
	status: MessageTemplateStatus.Approved,
	category: MessageTemplateCategory.Utility,
	components: [
		{
			type: MessageTemplateComponentType.Body,
			text: 'Hi {{name}}',
			example: { body_text_named_params: [{ param_name: 'name', example: 'Ann' }] }
		}
	],
	quality_score: { score: 'GREEN', date: 1700000000 }
}

describe('TemplateManager', () => {
	it('creates a template', async () => {
		const { calls, manager } = setup([{ id: 't1', status: 'PENDING', category: 'UTILITY' }])
		const body = {
			name: 'order_update',
			language: 'en_US',
			category: MessageTemplateCategory.Utility,
			parameter_format: 'NAMED' as const,
			components: template.components ?? []
		}
		const result = await manager.create(body)
		expect(calls[0]).toEqual({
			url: `${BASE}/waba1/message_templates`,
			method: 'POST',
			body
		})
		expect(result).toEqual({ id: 't1', status: 'PENDING', category: 'UTILITY' })
	})

	it('rejects a create without a name', async () => {
		const { calls, manager } = setup([])
		await expect(
			manager.create({ name: '', language: 'en_US', category: 'UTILITY', components: [] })
		).rejects.toBeInstanceOf(ValidationError)
		expect(calls).toHaveLength(0)
	})

	it('updates a template', async () => {
		const { calls, manager } = setup([{ success: true }])
		const result = await manager.update('t1', { message_send_ttl_seconds: 600 })
		expect(calls[0]).toEqual({
			url: `${BASE}/t1`,
			method: 'POST',
			body: { message_send_ttl_seconds: 600 }
		})
		expect(result.success).toBe(true)
	})

	it('deletes by name', async () => {
		const { calls, manager } = setup([{ success: true }])
		await manager.delete({ name: 'order_update' })
		expect(calls[0]?.url).toBe(`${BASE}/waba1/message_templates?name=order_update`)
		expect(calls[0]?.method).toBe('DELETE')
	})

	it('deletes one language by name and id', async () => {
		const { calls, manager } = setup([{ success: true }])
		await manager.delete({ name: 'order_update', id: 't1' })
		expect(calls[0]?.url).toBe(`${BASE}/waba1/message_templates?hsm_id=t1&name=order_update`)
	})

	it('requires a name to delete', async () => {
		const { manager } = setup([])
		await expect(manager.delete({ name: '', id: 't1' })).rejects.toBeInstanceOf(ValidationError)
	})

	it('gets a template with every field', async () => {
		const { calls, manager } = setup([template])
		const result = await manager.get('t1')
		expect(calls[0]?.url).toBe(`${BASE}/t1?fields=${FIELDS}`)
		expect(result).toEqual(template)
	})

	it('lists with default limit and filters', async () => {
		const { calls, manager } = setup([{ data: [template] }])
		const page = await manager.list({
			status: MessageTemplateStatus.Approved,
			nameOrContent: 'order'
		})
		expect(calls[0]?.url).toBe(
			`${BASE}/waba1/message_templates?fields=${FIELDS}&limit=100&name_or_content=order&status=APPROVED`
		)
		expect(page.data[0]?.name).toBe('order_update')
	})

	it('lists with explicit cursors', async () => {
		const { calls, manager } = setup([{ data: [] }])
		await manager.list({ limit: 5, after: 'A' })
		const params = new URL(calls[0]?.url ?? '').searchParams
		expect(params.get('limit')).toBe('5')
		expect(params.get('after')).toBe('A')
		expect(params.get('fields')).toBe(TEMPLATE_FIELDS.join(','))
	})

	it('listAll follows cursors with a page size of 1000', async () => {
		const { calls, manager } = setup([
			{ data: [template], paging: { cursors: { after: 'A' }, next: 'https://next' } },
			{ data: [{ ...template, id: 't2' }], paging: { cursors: { after: 'B' } } }
		])
		const all = await manager.listAll({ language: 'en_US' })
		expect(all.map(t => t.id)).toEqual(['t1', 't2'])
		expect(calls).toHaveLength(2)
		const first = new URL(calls[0]?.url ?? '').searchParams
		const second = new URL(calls[1]?.url ?? '').searchParams
		expect(first.get('limit')).toBe('1000')
		expect(first.get('language')).toBe('en_US')
		expect(first.get('after')).toBeNull()
		expect(second.get('after')).toBe('A')
		expect(second.get('language')).toBe('en_US')
	})

	it('migrates templates from another WABA', async () => {
		const { calls, manager } = setup([
			{ migrated_templates: ['1'], failed_templates: { '2': 'bad' } }
		])
		const result = await manager.migrate({ sourceWabaId: 'waba2', pageNumber: 0 })
		expect(calls[0]).toEqual({
			url: `${BASE}/waba1/migrate_message_templates`,
			method: 'POST',
			body: { source_waba_id: 'waba2', page_number: 0 }
		})
		expect(result.failed_templates).toEqual({ '2': 'bad' })
	})

	it('surfaces Graph API errors', async () => {
		const { manager } = setup([{ error: { message: 'nope', code: 100 } }], 400)
		await expect(manager.get('t1')).rejects.toBeInstanceOf(GraphApiError)
	})

	it('forwards the abort signal', async () => {
		let seen: AbortSignal | null | undefined
		const fetch = async (_input: string, init: RequestInit): Promise<Response> => {
			seen = init.signal
			return new Response('{}')
		}
		const manager = new TemplateManager(new RequestClient({ accessToken: 't', fetch }), 'waba1')
		const controller = new AbortController()
		controller.abort()
		await manager.get('t1', { signal: controller.signal })
		expect(seen?.aborted).toBe(true)
	})
})
