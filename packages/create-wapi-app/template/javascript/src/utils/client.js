import { Client } from "@wapijs/wapi.js";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const client = new Client({
  accessToken: required("WHATSAPP_API_ACCESS_TOKEN"),
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
  webhook: {
    verifyToken: required("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    // App settings → Basic → App secret. Rejects forged webhook requests.
    appSecret: process.env.META_APP_SECRET,
    path: "/webhook",
    port: Number(process.env.PORT ?? 8080),
  },
});
