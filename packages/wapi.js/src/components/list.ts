import { assert, compact } from './base'
import {
	InteractiveMessage,
	InteractiveMessageTypeEnum,
	toBodyPayload,
	toFooterPayload,
	toTextHeaderPayload
} from './interactive'
import {
	MessageLimits,
	assertCount,
	assertOptionalText,
	assertText,
	assertUnique
} from './validation'

/** A selectable row of a list message. */
export interface ListRow {
	/** Returned in the `list_reply` webhook. Up to 200 characters, unique across the message. */
	id: string
	/** Up to 24 characters. */
	title: string
	/** Up to 72 characters. */
	description?: string
}

/** A section of a list message. */
export interface ListSection {
	/** Up to 24 characters. Required when the message has more than one section. */
	title?: string
	/** At least one row. */
	rows: ListRow[]
}

/** Input of {@link ListInteractionMessage}. */
export interface ListInteractionMessageOptions {
	/** Up to 4096 characters. */
	bodyText: string
	/** Label of the button that opens the list, up to 20 characters. */
	buttonText: string
	/** One to ten sections, with at most ten rows in total. */
	sections: ListSection[]
	/** Text header, up to 60 characters (list messages only support text headers). */
	header?: string
	/** Up to 60 characters. */
	footerText?: string
}

/**
 * An interactive list message: a button that opens a menu of up to ten rows.
 *
 * @example
 * ```ts
 * new ListInteractionMessage({
 *   header: "Our menu",
 *   bodyText: "What would you like?",
 *   buttonText: "View menu",
 *   sections: [
 *     { title: "Pizza", rows: [{ id: "margherita", title: "Margherita" }] },
 *     { title: "Drinks", rows: [{ id: "cola", title: "Cola", description: "330ml" }] },
 *   ],
 * });
 * ```
 */
export class ListInteractionMessage extends InteractiveMessage<InteractiveMessageTypeEnum.List> {
	readonly data: Readonly<ListInteractionMessageOptions>

	constructor(data: ListInteractionMessageOptions) {
		super(InteractiveMessageTypeEnum.List)
		toBodyPayload(data.bodyText, MessageLimits.listBody)
		toFooterPayload(data.footerText)
		if (data.header !== undefined) toTextHeaderPayload(data.header, 'header')
		assertText(data.buttonText, 'buttonText', MessageLimits.listButtonText)
		assertCount(data.sections, 'sections', 1, MessageLimits.listSections)

		const rowIds: string[] = []
		data.sections.forEach((section, sectionIndex) => {
			const field = `sections[${sectionIndex}]`
			if (data.sections.length > 1) {
				assertText(section.title, `${field}.title`, MessageLimits.listSectionTitle)
			} else {
				assertOptionalText(section.title, `${field}.title`, MessageLimits.listSectionTitle)
			}
			assertCount(section.rows, `${field}.rows`, 1)
			section.rows.forEach((row, rowIndex) => {
				const rowField = `${field}.rows[${rowIndex}]`
				assertText(row.id, `${rowField}.id`, MessageLimits.listRowId)
				assertText(row.title, `${rowField}.title`, MessageLimits.listRowTitle)
				assertOptionalText(
					row.description,
					`${rowField}.description`,
					MessageLimits.listRowDescription
				)
				rowIds.push(row.id)
			})
		})
		assert(
			rowIds.length <= MessageLimits.listRows,
			`A list message allows at most ${MessageLimits.listRows} rows in total, got ${rowIds.length}`
		)
		assertUnique(rowIds, 'sections[].rows[].id')

		this.data = {
			...data,
			sections: data.sections.map(section => ({
				...section,
				rows: section.rows.map(row => ({ ...row }))
			}))
		}
	}

	protected interactive(): Record<string, unknown> {
		const { data } = this
		return {
			header:
				data.header === undefined ? undefined : toTextHeaderPayload(data.header, 'header'),
			body: toBodyPayload(data.bodyText, MessageLimits.listBody),
			footer: toFooterPayload(data.footerText),
			action: {
				button: data.buttonText,
				sections: data.sections.map(section =>
					compact({
						title: section.title,
						rows: section.rows.map(row =>
							compact({ id: row.id, title: row.title, description: row.description })
						)
					})
				)
			}
		}
	}
}
