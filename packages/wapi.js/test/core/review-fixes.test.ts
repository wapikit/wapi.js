import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '../../src/client/client'
import { RequestError, ValidationError } from '../../src/errors'
import { TypedEventEmitter } from '../../src/internal/event-emitter'
import { type FetchLike, RequestClient } from '../../src/internal/request-client'
import { silentLogger } from '../../src/internal/logger'
import { createFakeFetch } from '../helpers'

class Emitter extends TypedEventEmitter<{ ping: number }> {
	emit(value: number) {
		return this.dispatch('ping', value)
	}
}

describe('RequestClient.download', () => {
	it('refuses to send the token to a host that is not Meta', async () => {
		const fake = createFakeFetch(['binary'])
		const client = new RequestClient({ accessToken: 'secret', fetch: fake.fetch })
		for (const url of [
			'https://attacker.example.com/file.png',
			'https://lookaside.fbsbx.com.attacker.example/x',
			'http://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1',
			'not a url'
		]) {
			await expect(client.download(url)).rejects.toBeInstanceOf(ValidationError)
		}
		expect(fake.requests).toHaveLength(0)
	})

	it('allows Meta media hosts and the configured Graph origin', async () => {
		const fake = createFakeFetch(['a', 'b'])
		const client = new RequestClient({
			accessToken: 'secret',
			baseUrl: 'http://localhost:9999',
			fetch: fake.fetch
		})
		await client.download('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1')
		await client.download('http://localhost:9999/media/1')
		expect(fake.requests.map(request => request.headers.authorization)).toEqual([
			'Bearer secret',
			'Bearer secret'
		])
	})
})

describe('RequestClient body errors', () => {
	it('wraps a failure while reading the response body in RequestError', async () => {
		const fetch: FetchLike = () =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new TypeError('socket hang up'))
						}
					})
				)
			)
		const client = new RequestClient({ accessToken: 'secret', fetch })
		const error = await client.request({ method: 'GET', path: 'me' }).catch(e => e as unknown)
		expect(error).toBeInstanceOf(RequestError)
		expect((error as RequestError).timedOut).toBe(false)
	})

	it('reports a timeout that fires while the body is streaming', async () => {
		const fetch: FetchLike = (_url, init) =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							init.signal?.addEventListener('abort', () =>
								controller.error(init.signal?.reason)
							)
						}
					})
				)
			)
		const client = new RequestClient({ accessToken: 'secret', fetch, timeoutMs: 20 })
		const error = await client.request({ method: 'GET', path: 'me' }).catch(e => e as unknown)
		expect(error).toBeInstanceOf(RequestError)
		expect((error as RequestError).timedOut).toBe(true)
	})
})

describe('signal fallback without AbortSignal.any', () => {
	const original = (AbortSignal as unknown as { any?: unknown }).any
	afterEach(() => {
		;(AbortSignal as unknown as { any?: unknown }).any = original
	})

	it('removes its listeners from a long-lived caller signal', async () => {
		;(AbortSignal as unknown as { any?: unknown }).any = undefined
		const controller = new AbortController()
		const add = vi.spyOn(controller.signal, 'addEventListener')
		const remove = vi.spyOn(controller.signal, 'removeEventListener')
		const client = new RequestClient({
			accessToken: 'secret',
			fetch: createFakeFetch([{ ok: 1 }, { ok: 2 }]).fetch
		})
		await client.request({ method: 'GET', path: 'a', signal: controller.signal })
		await client.request({ method: 'GET', path: 'b', signal: controller.signal })
		expect(add).toHaveBeenCalledTimes(2)
		expect(remove).toHaveBeenCalledTimes(2)
	})

	it('still aborts the request when the caller aborts', async () => {
		;(AbortSignal as unknown as { any?: unknown }).any = undefined
		const controller = new AbortController()
		const fetch: FetchLike = (_url, init) =>
			new Promise((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
			})
		const client = new RequestClient({ accessToken: 'secret', fetch })
		const pending = client.request({ method: 'GET', path: 'a', signal: controller.signal })
		controller.abort(new Error('stop'))
		await expect(pending).rejects.toBeInstanceOf(RequestError)
	})
})

describe('event emitter', () => {
	it('off() removes a listener registered with once()', async () => {
		const emitter = new Emitter()
		const listener = vi.fn()
		emitter.once('ping', listener)
		emitter.off('ping', listener)
		await emitter.emit(1)
		expect(listener).not.toHaveBeenCalled()
		expect(emitter.listenerCount('ping')).toBe(0)
	})

	it('once() still fires exactly once', async () => {
		const emitter = new Emitter()
		const listener = vi.fn()
		emitter.once('ping', listener)
		await emitter.emit(1)
		await emitter.emit(2)
		expect(listener).toHaveBeenCalledOnce()
		expect(listener).toHaveBeenCalledWith(1)
	})
})

describe('media manager', () => {
	it('rejects (rather than throws) on an empty media id', async () => {
		const client = new Client({
			accessToken: 'token',
			phoneNumberId: 'pn',
			fetch: createFakeFetch().fetch,
			logger: silentLogger
		})
		const result = client.media.getMetadata('')
		expect(result).toBeInstanceOf(Promise)
		await expect(result).rejects.toBeInstanceOf(ValidationError)
	})
})
