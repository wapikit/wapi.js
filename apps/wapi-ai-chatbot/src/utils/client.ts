import { Client } from '@wapijs/wapi.js'

const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const WHATSAPP_API_ACCESS_TOKEN = process.env.WHATSAPP_API_ACCESS_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
const META_APP_SECRET = process.env.META_APP_SECRET

if (!WHATSAPP_API_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
	throw new Error('Configs not defined!')
}

export const whatsappClient = new Client({
	accessToken: WHATSAPP_API_ACCESS_TOKEN,
	businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
	phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
	webhook: {
		verifyToken: WHATSAPP_WEBHOOK_VERIFY_TOKEN,
		appSecret: META_APP_SECRET,
		path: '/webhook',
		port: 8080
	}
})
