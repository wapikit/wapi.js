import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type NodeWebhookHandler } from './adapters'

/** Options of the optional built-in webhook server. */
export interface WebhookServerOptions {
	/** Port to listen on. `0` picks a free port. Default `8080`. */
	port?: number
	/**
	 * Interface to bind. Defaults to all interfaces (as 0.1.x did) so it works
	 * in containers; use `"127.0.0.1"` behind a reverse proxy or tunnel.
	 */
	host?: string
	/** Path Meta calls. Default `"/webhook"`. */
	path?: string
	/**
	 * Maximum accepted body size in bytes; larger requests get `413`. Default
	 * 3 MB. Applies to the built-in server and to `nodeHandler` / `fetchHandler`.
	 */
	maxBodyBytes?: number
}

/** Address the server is listening on. */
export interface WebhookServerAddress {
	host: string
	port: number
	path: string
}

/**
 * Minimal `node:http` server mounting the webhook handler on one path. Only
 * used when you call `client.webhook.listen()`; bring your own server with
 * `client.webhook.nodeHandler` / `client.webhook.fetchHandler` instead.
 */
export class WebhookServer {
	private server?: Server

	constructor(
		private readonly handler: NodeWebhookHandler,
		private readonly options: { port: number; host?: string; path: string },
		private readonly onError: (error: Error) => void
	) {}

	get listening(): boolean {
		return this.server?.listening ?? false
	}

	async listen(): Promise<WebhookServerAddress> {
		if (this.server?.listening) return this.address()
		const { createServer } = await import('node:http')
		const { path } = this.options

		const server = createServer((request, response) => {
			const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
			if (pathname !== path) {
				response.statusCode = 404
				response.end('Not Found')
				return
			}
			this.handler(request, response).catch((error: unknown) => {
				this.onError(error instanceof Error ? error : new Error(String(error)))
				if (!response.headersSent) {
					response.statusCode = 500
					response.end('Internal Server Error')
				}
			})
		})
		server.on('clientError', (_error, socket) => {
			socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
		})

		await new Promise<void>((resolve, reject) => {
			const onListenError = (error: Error) => reject(error)
			server.once('error', onListenError)
			server.listen(this.options.port, this.options.host, () => {
				server.off('error', onListenError)
				// runtime errors after a successful bind go to the client's `Error` event
				server.on('error', error => this.onError(error))
				resolve()
			})
		})
		this.server = server
		return this.address()
	}

	address(): WebhookServerAddress {
		const address = this.server?.address() as AddressInfo | null | undefined
		return {
			host: address?.address ?? this.options.host ?? '0.0.0.0',
			port: address?.port ?? this.options.port,
			path: this.options.path
		}
	}

	/** Stops accepting connections and waits for in-flight requests (max `timeoutMs`). */
	async close(timeoutMs = 10_000): Promise<void> {
		const server = this.server
		if (!server) return
		this.server = undefined
		await new Promise<void>(resolve => {
			const timer = setTimeout(() => {
				server.closeAllConnections?.()
				resolve()
			}, timeoutMs)
			server.close(() => {
				clearTimeout(timer)
				resolve()
			})
			server.closeIdleConnections?.()
		})
	}
}
