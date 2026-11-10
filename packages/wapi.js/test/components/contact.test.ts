import { describe, expect, it } from 'vitest'
import { Contact, ContactMessage, type WhatsappContact } from '../../src/components'
import { ValidationError } from '../../src/errors'

const to = '15550001111'
const envelope = { messaging_product: 'whatsapp', recipient_type: 'individual', to }

describe('Contact', () => {
	it('builds a snake_case contact from camelCase input', () => {
		const contact = new Contact({
			formattedName: 'Jane Q. Doe',
			firstName: 'Jane',
			lastName: 'Doe',
			middleName: 'Q.',
			prefix: 'Dr.',
			suffix: 'PhD',
			birthday: '1990-04-23'
		})
			.addPhone({ phone: '+1 555 000 1111', waId: '15550001111', type: 'CELL' })
			.addEmail({ email: 'jane@example.com', type: 'WORK' })
			.addUrl({ url: 'https://example.com', type: 'WORK' })
			.addAddress({
				street: '1 Hacker Way',
				city: 'Menlo Park',
				state: 'CA',
				zip: '94025',
				country: 'United States',
				countryCode: 'us',
				type: 'WORK'
			})
			.setOrg({ company: 'Acme', department: 'Sales', title: 'Manager' })

		const expected: WhatsappContact = {
			name: {
				formatted_name: 'Jane Q. Doe',
				first_name: 'Jane',
				last_name: 'Doe',
				middle_name: 'Q.',
				prefix: 'Dr.',
				suffix: 'PhD'
			},
			phones: [{ phone: '+1 555 000 1111', wa_id: '15550001111', type: 'CELL' }],
			emails: [{ email: 'jane@example.com', type: 'WORK' }],
			urls: [{ url: 'https://example.com', type: 'WORK' }],
			addresses: [
				{
					street: '1 Hacker Way',
					city: 'Menlo Park',
					state: 'CA',
					zip: '94025',
					country: 'United States',
					country_code: 'us',
					type: 'WORK'
				}
			],
			org: { company: 'Acme', department: 'Sales', title: 'Manager' },
			birthday: '1990-04-23'
		}
		expect(contact.build()).toEqual(expected)
		expect(JSON.parse(JSON.stringify(contact))).toEqual(expected)
	})

	it('accepts phones and emails in the constructor', () => {
		const contact = new Contact({
			formattedName: 'Bob',
			phones: [{ phone: '+15550002222' }],
			emails: [{ email: 'bob@example.com' }]
		})
		expect(contact.build()).toEqual({
			name: { formatted_name: 'Bob' },
			phones: [{ phone: '+15550002222' }],
			emails: [{ email: 'bob@example.com' }]
		})
	})

	it('validates input', () => {
		expect(() => new Contact({ formattedName: '' })).toThrow(ValidationError)
		expect(() => new Contact({ formattedName: 'A' }).setBirthday('23/04/1990')).toThrow(
			ValidationError
		)
		expect(() => new Contact({ formattedName: 'A' }).addPhone({ type: 'CELL' })).toThrow(
			ValidationError
		)
	})
})

describe('ContactMessage', () => {
	it('serialises raw contacts and Contact builders', () => {
		const raw: WhatsappContact = {
			name: { formatted_name: 'Jane Doe', first_name: 'Jane' },
			phones: [{ phone: '+15550001111', type: 'CELL' }]
		}
		const built = new Contact({ formattedName: 'Bob' }).addPhone({ waId: '15550002222' })

		expect(new ContactMessage({ contacts: [raw, built] }).toJson({ to })).toEqual({
			...envelope,
			type: 'contacts',
			contacts: [raw, { name: { formatted_name: 'Bob' }, phones: [{ wa_id: '15550002222' }] }]
		})
	})

	it('needs at least one contact with a formatted name', () => {
		expect(() => new ContactMessage({ contacts: [] })).toThrow(ValidationError)
		expect(() => new ContactMessage({ contacts: [{ name: { formatted_name: '' } }] })).toThrow(
			ValidationError
		)
	})
})
