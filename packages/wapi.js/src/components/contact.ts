import { BaseMessage, MessageTypeEnum, assert, compact } from './base'
import { assertCount, assertOptionalText, assertText } from './validation'

/** Any string, while still suggesting the known values in editors. */
type KnownOr<T extends string> = T | (string & Record<never, never>)

/** Phone `type` values documented by Meta. */
export type ContactPhoneType = 'CELL' | 'MAIN' | 'IPHONE' | 'HOME' | 'WORK'

/** Address / email / URL `type` values documented by Meta. */
export type ContactInfoType = 'HOME' | 'WORK'

/** `name` of a {@link WhatsappContact}. `formatted_name` is required. */
export interface WhatsappContactName {
	formatted_name: string
	first_name?: string
	last_name?: string
	middle_name?: string
	suffix?: string
	prefix?: string
}

/** A phone number of a {@link WhatsappContact}. */
export interface WhatsappContactPhone {
	phone?: string
	/** WhatsApp id. When set, the recipient sees "Message" / "Add to contacts" buttons. */
	wa_id?: string
	type?: KnownOr<ContactPhoneType>
}

/** An email address of a {@link WhatsappContact}. */
export interface WhatsappContactEmail {
	email?: string
	type?: KnownOr<ContactInfoType>
}

/** A URL of a {@link WhatsappContact}. */
export interface WhatsappContactUrl {
	url?: string
	type?: KnownOr<ContactInfoType>
}

/** A postal address of a {@link WhatsappContact}. */
export interface WhatsappContactAddress {
	street?: string
	city?: string
	state?: string
	zip?: string
	country?: string
	/** ISO two-letter country code. */
	country_code?: string
	type?: KnownOr<ContactInfoType>
}

/** Organisation of a {@link WhatsappContact}. */
export interface WhatsappContactOrg {
	company?: string
	department?: string
	title?: string
}

/**
 * A contact card exactly as the Cloud API sends and receives it (snake_case).
 * Inbound `contacts` webhooks carry the same shape.
 */
export interface WhatsappContact {
	name: WhatsappContactName
	phones?: WhatsappContactPhone[]
	emails?: WhatsappContactEmail[]
	urls?: WhatsappContactUrl[]
	addresses?: WhatsappContactAddress[]
	org?: WhatsappContactOrg
	/** `YYYY-MM-DD`. */
	birthday?: string
}

/** A phone number for {@link Contact.addPhone}. */
export interface ContactPhoneOptions {
	phone?: string
	waId?: string
	type?: KnownOr<ContactPhoneType>
}

/** An email address for {@link Contact.addEmail}. */
export interface ContactEmailOptions {
	email: string
	type?: KnownOr<ContactInfoType>
}

/** A URL for {@link Contact.addUrl}. */
export interface ContactUrlOptions {
	url: string
	type?: KnownOr<ContactInfoType>
}

/** A postal address for {@link Contact.addAddress}. */
export interface ContactAddressOptions {
	street?: string
	city?: string
	state?: string
	zip?: string
	country?: string
	countryCode?: string
	type?: KnownOr<ContactInfoType>
}

/** Organisation for {@link Contact.setOrg}. */
export interface ContactOrgOptions {
	company?: string
	department?: string
	title?: string
}

/** Input of {@link Contact}. Only `formattedName` is required. */
export interface ContactOptions {
	/** Full name as displayed, for example `"Jane Q. Doe"`. */
	formattedName: string
	firstName?: string
	lastName?: string
	middleName?: string
	suffix?: string
	prefix?: string
	phones?: ContactPhoneOptions[]
	emails?: ContactEmailOptions[]
	urls?: ContactUrlOptions[]
	addresses?: ContactAddressOptions[]
	org?: ContactOrgOptions
	/** `YYYY-MM-DD`. */
	birthday?: string
}

const BIRTHDAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function assertBirthday(value: string | undefined): void {
	if (value === undefined) return
	assert(
		typeof value === 'string' && BIRTHDAY_PATTERN.test(value),
		'`birthday` must be formatted as YYYY-MM-DD'
	)
}

function hasKeys(value: object): boolean {
	return Object.keys(value).length > 0
}

/**
 * Builds a {@link WhatsappContact} from camelCase input.
 *
 * @example
 * ```ts
 * const contact = new Contact({ formattedName: "Jane Doe", firstName: "Jane" })
 *   .addPhone({ phone: "+1 555 000 1111", waId: "15550001111", type: "CELL" })
 *   .addEmail({ email: "jane@example.com", type: "WORK" })
 *   .setOrg({ company: "Acme" });
 * new ContactMessage({ contacts: [contact] });
 * ```
 */
export class Contact {
	readonly data: Readonly<ContactOptions>
	private readonly phones: WhatsappContactPhone[] = []
	private readonly emails: WhatsappContactEmail[] = []
	private readonly urls: WhatsappContactUrl[] = []
	private readonly addresses: WhatsappContactAddress[] = []
	private org?: WhatsappContactOrg
	private birthday?: string

	constructor(data: ContactOptions) {
		assertText(data.formattedName, 'formattedName')
		this.data = { ...data }
		for (const phone of data.phones ?? []) this.addPhone(phone)
		for (const email of data.emails ?? []) this.addEmail(email)
		for (const url of data.urls ?? []) this.addUrl(url)
		for (const address of data.addresses ?? []) this.addAddress(address)
		if (data.org) this.setOrg(data.org)
		if (data.birthday !== undefined) this.setBirthday(data.birthday)
	}

	/** Adds a phone number. At least one of `phone` or `waId` is required. */
	addPhone(phone: ContactPhoneOptions): this {
		assert(
			phone.phone !== undefined || phone.waId !== undefined,
			'A contact phone needs `phone` or `waId`'
		)
		assertOptionalText(phone.phone, 'phone.phone')
		assertOptionalText(phone.waId, 'phone.waId')
		this.phones.push(compact({ phone: phone.phone, wa_id: phone.waId, type: phone.type }))
		return this
	}

	/** Adds an email address. */
	addEmail(email: ContactEmailOptions): this {
		assertText(email.email, 'email.email')
		this.emails.push(compact({ email: email.email, type: email.type }))
		return this
	}

	/** Adds a URL. */
	addUrl(url: ContactUrlOptions): this {
		assertText(url.url, 'url.url')
		this.urls.push(compact({ url: url.url, type: url.type }))
		return this
	}

	/** Adds a postal address. */
	addAddress(address: ContactAddressOptions): this {
		const payload = compact({
			street: address.street,
			city: address.city,
			state: address.state,
			zip: address.zip,
			country: address.country,
			country_code: address.countryCode,
			type: address.type
		})
		assert(hasKeys(payload), 'A contact address must not be empty')
		this.addresses.push(payload)
		return this
	}

	/** Sets (replaces) the organisation. */
	setOrg(org: ContactOrgOptions): this {
		const payload = compact({
			company: org.company,
			department: org.department,
			title: org.title
		})
		this.org = hasKeys(payload) ? payload : undefined
		return this
	}

	/** Sets the birthday, formatted as `YYYY-MM-DD`. */
	setBirthday(date: string): this {
		assertBirthday(date)
		this.birthday = date
		return this
	}

	/** Returns the Cloud API contact object. */
	build(): WhatsappContact {
		const { data } = this
		return compact({
			name: compact({
				formatted_name: data.formattedName,
				first_name: data.firstName,
				last_name: data.lastName,
				middle_name: data.middleName,
				suffix: data.suffix,
				prefix: data.prefix
			}),
			phones: this.phones.length ? [...this.phones] : undefined,
			emails: this.emails.length ? [...this.emails] : undefined,
			urls: this.urls.length ? [...this.urls] : undefined,
			addresses: this.addresses.length ? [...this.addresses] : undefined,
			org: this.org ? { ...this.org } : undefined,
			birthday: this.birthday
		})
	}

	/** Same as {@link Contact.build}; lets `JSON.stringify` serialise a contact. */
	toJSON(): WhatsappContact {
		return this.build()
	}
}

/** Input of {@link ContactMessage}. */
export interface ContactMessageOptions {
	/** One or more contacts, as raw {@link WhatsappContact} objects or {@link Contact} builders. */
	contacts: (WhatsappContact | Contact)[]
}

/**
 * Shares one or more contact cards.
 *
 * @example
 * ```ts
 * new ContactMessage({
 *   contacts: [
 *     { name: { formatted_name: "Jane Doe" }, phones: [{ phone: "+15550001111", type: "CELL" }] },
 *   ],
 * });
 * ```
 */
export class ContactMessage extends BaseMessage<MessageTypeEnum.Contacts> {
	readonly data: Readonly<ContactMessageOptions>

	constructor(data: ContactMessageOptions) {
		super(MessageTypeEnum.Contacts)
		assertCount(data.contacts, 'contacts', 1)
		data.contacts.forEach((contact, index) => {
			if (contact instanceof Contact) return
			assert(
				typeof contact === 'object' && contact !== null && typeof contact.name === 'object',
				`\`contacts[${index}].name\` is required`
			)
			assertText(contact.name.formatted_name, `contacts[${index}].name.formatted_name`)
			assertBirthday(contact.birthday)
		})
		this.data = { ...data, contacts: [...data.contacts] }
	}

	protected content(): { contacts: WhatsappContact[] } {
		return {
			contacts: this.data.contacts.map(contact =>
				contact instanceof Contact ? contact.build() : contact
			)
		}
	}
}
