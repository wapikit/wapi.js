import { Client } from '@wapijs/wapi.js'
import {
	WHATSAPP_API_ACCESS_TOKEN,
	WHATSAPP_BUSINESS_ACCOUNT_ID,
	WHATSAPP_PHONE_NUMBER_ID,
	WHATSAPP_WEBHOOK_SECRET
} from '../constant'

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
