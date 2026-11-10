import { Client } from '@wapijs/wapi.js'
import {
	META_APP_SECRET,
	WHATSAPP_API_ACCESS_TOKEN,
	WHATSAPP_BUSINESS_ACCOUNT_ID,
	WHATSAPP_PHONE_NUMBER_ID,
	WHATSAPP_WEBHOOK_VERIFY_TOKEN
} from '../constant'

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
