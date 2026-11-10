// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventMap = Record<string, any>

/** A listener may be sync or async. */
export type Listener<T> = (data: T) => void | Promise<void>

/**
 * Small, runtime-agnostic typed event emitter (no `node:events` dependency, so
 * it also runs on edge runtimes).
 *
 * Unlike `EventEmitter`, a listener that throws or rejects never propagates
 * into the code that emitted the event (for wapi.js: the webhook request). The
 * error is passed to {@link TypedEventEmitter.onListenerError} instead,
 * mirroring how wapi.go recovers handler panics.
 */
export class TypedEventEmitter<Events extends AnyEventMap> {
	private readonly listeners = new Map<keyof Events, Set<Listener<never>>>()

	/** Called when a listener throws or rejects. Subclasses override it. */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	protected onListenerError(_error: unknown, _event: keyof Events): void {
		// ignored by default
	}

	/**
	 * Registers a listener. Returns a function that removes it.
	 */
	on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
		let set = this.listeners.get(event)
		if (!set) {
			set = new Set()
			this.listeners.set(event, set)
		}
		set.add(listener as Listener<never>)
		return () => this.off(event, listener)
	}

	/**
	 * Registers a listener that is removed after its first call.
	 */
	once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
		const wrapped: Listener<Events[K]> = data => {
			this.off(event, wrapped)
			return listener(data)
		}
		return this.on(event, wrapped)
	}

	/** Removes a listener previously passed to {@link on}. */
	off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
		this.listeners.get(event)?.delete(listener as Listener<never>)
	}

	/** Removes every listener of `event`, or of every event when omitted. */
	removeAllListeners(event?: keyof Events): void {
		if (event === undefined) this.listeners.clear()
		else this.listeners.delete(event)
	}

	/** Number of listeners registered for `event`. */
	listenerCount(event: keyof Events): number {
		return this.listeners.get(event)?.size ?? 0
	}

	/**
	 * Calls every listener of `event` with `data`. Resolves once every listener
	 * has settled. Never rejects: listener errors go to `onListenerError`.
	 */
	protected async dispatch<K extends keyof Events>(event: K, data: Events[K]): Promise<void> {
		const set = this.listeners.get(event)
		if (!set || set.size === 0) return
		const pending: Promise<void>[] = []
		for (const listener of [...set]) {
			try {
				const result = (listener as Listener<Events[K]>)(data)
				if (result && typeof result.then === 'function') {
					pending.push(
						result.catch((error: unknown) => this.onListenerError(error, event))
					)
				}
			} catch (error) {
				this.onListenerError(error, event)
			}
		}
		await Promise.all(pending)
	}
}
