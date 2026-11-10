/** Cursor pagination input accepted by every list call. */
export interface PaginationInput {
	/** Page size. Each manager documents its default. */
	limit?: number
	/** Cursor from `paging.cursors.after` of the previous page. */
	after?: string
	/** Cursor from `paging.cursors.before` of the previous page. */
	before?: string
}

/** Graph API paging block. */
export interface Paging {
	cursors?: { before?: string; after?: string }
	next?: string
	previous?: string
}

/** One page of a Graph API edge. */
export interface Paginated<T> {
	data: T[]
	paging?: Paging
	/** Present on some edges (for example `summary.total_count`). */
	summary?: Record<string, unknown>
}

/** Converts a {@link PaginationInput} into query parameters. */
export function paginationQuery(
	input: PaginationInput | undefined,
	defaultLimit: number
): Record<string, string | number | undefined> {
	return {
		limit: input?.limit ?? defaultLimit,
		after: input?.after,
		before: input?.before
	}
}

/**
 * Iterates over every item of a paginated edge, following `paging.cursors.after`
 * until Meta stops returning a `next` link.
 *
 * @example
 * ```ts
 * for await (const template of iterateAll((page) => client.templates.list(page))) {
 *   console.log(template.name);
 * }
 * ```
 */
export async function* iterateAll<T>(
	fetchPage: (input: PaginationInput) => Promise<Paginated<T>>,
	options?: { limit?: number; maxItems?: number }
): AsyncGenerator<T, void, undefined> {
	let after: string | undefined
	let yielded = 0
	const maxItems = options?.maxItems ?? Number.POSITIVE_INFINITY
	for (;;) {
		const page = await fetchPage({ limit: options?.limit, after })
		for (const item of page.data ?? []) {
			if (yielded >= maxItems) return
			yield item
			yielded += 1
		}
		const nextCursor = page.paging?.cursors?.after
		if (!page.paging?.next || !nextCursor || nextCursor === after) return
		after = nextCursor
	}
}

/** Collects {@link iterateAll} into an array. */
export async function collectAll<T>(
	fetchPage: (input: PaginationInput) => Promise<Paginated<T>>,
	options?: { limit?: number; maxItems?: number }
): Promise<T[]> {
	const items: T[] = []
	for await (const item of iterateAll(fetchPage, options)) items.push(item)
	return items
}
