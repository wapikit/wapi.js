import { AiConversationRoleEnum, ConversationMessageType } from '~/types'
import { caching } from 'cache-manager'

const cacheStore = caching({
	store: 'memory'
})

export async function cacheData(params: { key: string; data: any; ttl?: number }) {
	const { key, ttl, data } = params
	await cacheStore.set(key, data, { ...(ttl ? { ttl: ttl } : {}) })
}

export async function getCachedData<T>(key: string): Promise<T> {
	const response = await cacheStore.get(key)
	console.log(response)
	return response as T
}

export function computeCacheKey(params: { id: string; context: string }) {
	return `${params.id}-${params.context}`
}

export function getConversationContextCacheKey(phoneNumber: string) {
	return computeCacheKey({
		id: phoneNumber,
		context: 'conversation'
	})
}
