import NodeCache from 'node-cache'

const cache = new NodeCache()

export const setCache = (key: string, value: any, ttl: number = 3600) => {
    cache.set(key, value, ttl)
}

export const getCache = (key: string) => {
    return cache.get(key)
}
