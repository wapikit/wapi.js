import { InvalidWebhookSignatureError } from '../errors'

const encoder = new TextEncoder()

function toBytes(body: string | Uint8Array | ArrayBuffer): Uint8Array {
	if (typeof body === 'string') return encoder.encode(body)
	return body instanceof Uint8Array ? body : new Uint8Array(body)
}

function hexToBytes(hex: string): Uint8Array | undefined {
	if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
		return undefined
	}
	const bytes = new Uint8Array(hex.length / 2)
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16)
	}
	return bytes
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false
	let diff = 0
	for (let index = 0; index < left.length; index += 1) {
		diff |= (left[index] ?? 0) ^ (right[index] ?? 0)
	}
	return diff === 0
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header (`sha256=<hex>`) against the
 * HMAC-SHA256 of the **raw** request body keyed with your app secret.
 *
 * Uses Web Crypto, so it runs on Node.js 20+, Bun, Deno and edge runtimes.
 *
 * @param appSecret - The Meta app secret (App settings → Basic).
 * @param rawBody - The body exactly as received. Re-serialised JSON will not match.
 * @param signatureHeader - Value of the `X-Hub-Signature-256` header.
 * @returns `true` when the signature is valid.
 */
export async function isValidWebhookSignature(
	appSecret: string,
	rawBody: string | Uint8Array | ArrayBuffer,
	signatureHeader: string | null | undefined
): Promise<boolean> {
	if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false
	const expected = hexToBytes(signatureHeader.slice('sha256='.length))
	if (!expected) return false
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(appSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)
	const actual = new Uint8Array(await crypto.subtle.sign('HMAC', key, toBytes(rawBody)))
	return constantTimeEqual(actual, expected)
}

/**
 * Like {@link isValidWebhookSignature} but throws
 * {@link InvalidWebhookSignatureError} on mismatch. Mirrors wapi.go's
 * `VerifyWebhookSignature`.
 */
export async function verifyWebhookSignature(
	appSecret: string,
	rawBody: string | Uint8Array | ArrayBuffer,
	signatureHeader: string | null | undefined
): Promise<void> {
	if (!(await isValidWebhookSignature(appSecret, rawBody, signatureHeader))) {
		throw new InvalidWebhookSignatureError()
	}
}
