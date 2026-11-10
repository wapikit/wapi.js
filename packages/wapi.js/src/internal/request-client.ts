import { GraphApiError, RequestError, ValidationError } from '../errors'

/** Graph API version used when none is configured. Matches wapi.go. */
export const DEFAULT_API_VERSION = 'v20.0'
/** Graph API origin used when none is configured. */
export const DEFAULT_GRAPH_BASE_URL = 'https://graph.facebook.com'
/** Default per-request timeout. Uploads get {@link DEFAULT_UPLOAD_TIMEOUT_MS}. */
export const DEFAULT_TIMEOUT_MS = 60_000
/** Default timeout for multipart media uploads. */
export const DEFAULT_UPLOAD_TIMEOUT_MS = 300_000

export type HttpMethod = 'GET' | 'POST' | 'DELETE'

/**
 * Hosts Meta serves WhatsApp media from. `download()` only sends the access
 * token to these (over HTTPS) and to the configured Graph API origin.
 */
const MEDIA_HOST_SUFFIXES = ['fbsbx.com', 'facebook.com', 'fbcdn.net', 'whatsapp.net']

/** A `fetch` compatible function. Defaults to `globalThis.fetch`. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface RequestClientOptions {
	accessToken: string
	apiVersion?: string
	baseUrl?: string
	fetch?: FetchLike
	timeoutMs?: number
}

/**
 * A field of the Graph API `fields` query parameter, with optional modifiers
 * rendered as chained calls: `name.key1(value1).key2(value2)`.
 */
export interface GraphField {
	name: string
	modifiers?: Record<string, string | number>
}

export interface GraphRequest {
	method: HttpMethod
	/** Path below the API version, without a leading slash, e.g. `"123/messages"`. */
	path: string
	query?: Record<string, string | number | boolean | undefined>
	fields?: (string | GraphField)[]
	/** JSON body; serialised with `JSON.stringify`. */
	body?: unknown
	/** Raw body (for example `FormData` for uploads). Takes precedence over `body`. */
	rawBody?: BodyInit
	timeoutMs?: number
	signal?: AbortSignal
}

/**
 * Low level Graph API client shared by every manager. Safe to share across
 * messaging clients; it holds no per-request state.
 */
export class RequestClient {
	readonly apiVersion: string
	readonly baseUrl: string
	private accessToken: string
	private readonly fetchImpl: FetchLike
	private readonly timeoutMs: number

	constructor(options: RequestClientOptions) {
		if (!options.accessToken) {
			throw new TypeError('wapi.js: `accessToken` is required')
		}
		this.accessToken = options.accessToken
		this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION
		this.baseUrl = (options.baseUrl ?? DEFAULT_GRAPH_BASE_URL).replace(/\/+$/, '')
		const fetchImpl = options.fetch ?? globalThis.fetch
		if (typeof fetchImpl !== 'function') {
			throw new TypeError(
				'wapi.js: no global fetch found. Use Node.js 20+ or pass `fetch` in the client config.'
			)
		}
		this.fetchImpl = fetchImpl.bind(globalThis)
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
	}

	/** Replaces the access token used for subsequent requests (token rotation). */
	setAccessToken(accessToken: string): void {
		if (!accessToken) throw new TypeError('wapi.js: `accessToken` is required')
		this.accessToken = accessToken
	}

	/** Builds the full request URL. Query keys are emitted in sorted order. */
	buildUrl(path: string, query?: GraphRequest['query'], fields?: GraphRequest['fields']): string {
		const url = `${this.baseUrl}/${this.apiVersion}/${path.replace(/^\/+/, '')}`
		const params = new URLSearchParams()
		if (fields && fields.length > 0) {
			params.set('fields', renderFields(fields))
		}
		if (query) {
			for (const key of Object.keys(query).sort()) {
				const value = query[key]
				if (value !== undefined) params.set(key, String(value))
			}
		}
		const search = params.toString()
		return search ? `${url}?${search}` : url
	}

	/**
	 * Sends a request and returns the parsed JSON body.
	 *
	 * @throws {GraphApiError} on a non-2xx status, or a 2xx body with an `error` envelope.
	 * @throws {RequestError} when the request could not be completed or timed out.
	 */
	async request<T>(request: GraphRequest): Promise<T> {
		const url = this.buildUrl(request.path, request.query, request.fields)
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.accessToken}`
		}
		let body: BodyInit | undefined
		if (request.rawBody !== undefined) {
			body = request.rawBody
		} else if (request.body !== undefined) {
			headers['Content-Type'] = 'application/json'
			body = JSON.stringify(request.body)
		}

		const timeoutMs = request.timeoutMs ?? this.timeoutMs
		const timeoutSignal = AbortSignal.timeout(timeoutMs)
		const combined = combineSignals(request.signal, timeoutSignal)
		const describe = `${request.method} ${request.path}`

		let status: number
		let ok: boolean
		let text: string
		try {
			const response = await this.fetchImpl(url, {
				method: request.method,
				headers,
				body,
				signal: combined.signal
			})
			status = response.status
			ok = response.ok
			text = await response.text()
		} catch (error) {
			throw toRequestError(error, `Graph API request ${describe}`, timeoutSignal, timeoutMs)
		} finally {
			combined.dispose()
		}

		if (!ok) {
			throw new GraphApiError({ status, body: text })
		}
		if (text === '') return undefined as T
		let parsed: unknown
		try {
			parsed = JSON.parse(text)
		} catch {
			throw new GraphApiError({ status, body: text })
		}
		if (parsed && typeof parsed === 'object' && 'error' in parsed) {
			throw new GraphApiError({ status, body: text })
		}
		return parsed as T
	}

	/**
	 * Downloads a binary resource (for example a media URL returned by
	 * `media.getUrl`) and returns its bytes. Media URLs require the access
	 * token as a bearer header, so the URL must be an HTTPS URL on one of
	 * Meta's media hosts (`*.fbsbx.com`, `*.facebook.com`, `*.fbcdn.net`,
	 * `*.whatsapp.net`) or on the configured Graph API origin.
	 *
	 * @throws {ValidationError} when the URL is on any other host, so the
	 * access token is never sent to a third party.
	 */
	async download(
		url: string,
		options?: { timeoutMs?: number; signal?: AbortSignal }
	): Promise<{ data: ArrayBuffer; mimeType: string }> {
		this.assertMediaUrl(url)
		const timeoutMs = options?.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS
		const timeoutSignal = AbortSignal.timeout(timeoutMs)
		const combined = combineSignals(options?.signal, timeoutSignal)
		try {
			const response = await this.fetchImpl(url, {
				method: 'GET',
				headers: { Authorization: `Bearer ${this.accessToken}` },
				signal: combined.signal
			})
			if (!response.ok) {
				throw new GraphApiError({ status: response.status, body: await response.text() })
			}
			return {
				data: await response.arrayBuffer(),
				mimeType: response.headers.get('content-type') ?? 'application/octet-stream'
			}
		} catch (error) {
			if (error instanceof GraphApiError) throw error
			throw toRequestError(error, 'Media download', timeoutSignal, timeoutMs)
		} finally {
			combined.dispose()
		}
	}

	private assertMediaUrl(url: string): void {
		let parsed: URL
		try {
			parsed = new URL(url)
		} catch {
			throw new ValidationError(`Not a valid media URL: ${url}`)
		}
		if (parsed.origin === new URL(this.baseUrl).origin) return
		const host = parsed.hostname.toLowerCase()
		const isMetaHost = MEDIA_HOST_SUFFIXES.some(
			suffix => host === suffix || host.endsWith(`.${suffix}`)
		)
		if (parsed.protocol !== 'https:' || !isMetaHost) {
			throw new ValidationError(
				`Refusing to send the access token to ${parsed.origin}: media downloads only go to Meta's media hosts. ` +
					'Fetch other URLs yourself.'
			)
		}
	}
}

/** Renders `fields` as Graph API expects: `a,b.limit(10).after(x),c`. */
export function renderFields(fields: (string | GraphField)[]): string {
	return fields
		.map(field => {
			if (typeof field === 'string') return field
			const modifiers = field.modifiers ?? {}
			return (
				field.name +
				Object.keys(modifiers)
					.sort()
					.map(key => `.${key}(${modifiers[key]})`)
					.join('')
			)
		})
		.join(',')
}

/**
 * Combines an optional caller signal with the timeout signal. `dispose()`
 * removes the listeners the fallback adds, so a long-lived caller signal does
 * not accumulate one listener per request.
 */
function combineSignals(
	signal: AbortSignal | undefined,
	timeoutSignal: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
	if (!signal) return { signal: timeoutSignal, dispose: () => undefined }
	const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any
	if (anyFn) return { signal: anyFn([signal, timeoutSignal]), dispose: () => undefined }

	const controller = new AbortController()
	const sources = [signal, timeoutSignal]
	const onAbort = (event: Event) => controller.abort((event.target as AbortSignal).reason)
	const dispose = () => {
		for (const source of sources) source.removeEventListener('abort', onAbort)
	}
	const alreadyAborted = sources.find(source => source.aborted)
	if (alreadyAborted) {
		controller.abort(alreadyAborted.reason)
	} else {
		for (const source of sources) source.addEventListener('abort', onAbort, { once: true })
	}
	return { signal: controller.signal, dispose }
}

function toRequestError(
	error: unknown,
	what: string,
	timeoutSignal: AbortSignal,
	timeoutMs: number
): RequestError {
	if (error instanceof RequestError) return error
	const timedOut = timeoutSignal.aborted
	return new RequestError(
		timedOut ? `${what} timed out after ${timeoutMs}ms` : `${what} failed`,
		{ cause: error, timedOut }
	)
}
