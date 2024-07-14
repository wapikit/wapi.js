import { Client } from '@wapijs/wapi.js'

const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const WHATSAPP_API_ACCESS_TOKEN = process.env.WHATSAPP_API_ACCESS_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET

if (
	!WHATSAPP_API_ACCESS_TOKEN ||
	!WHATSAPP_BUSINESS_ACCOUNT_ID ||
	!WHATSAPP_PHONE_NUMBER_ID ||
	!WHATSAPP_WEBHOOK_SECRET
) {
	throw new Error('Configs not defined!')
}

export const whatsappClient = new Client({
	apiAccessToken: WHATSAPP_API_ACCESS_TOKEN,
	businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
	phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
	port: 8080,
	webhookEndpoint: '/webhook',
	webhookSecret: WHATSAPP_WEBHOOK_SECRET
})
