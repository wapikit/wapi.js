declare global {
    namespace NodeJS {
        interface ProcessEnv {
            WHATSAPP_API_ACCESS_TOKEN: string
            WHATSAPP_PHONE_NUMBER_ID: string
            WHATSAPP_BUSINESS_ACCOUNT_ID: string
            WHATSAPP_WEBHOOK_SECRET: string
            OPEN_AI_API_KEY: string
            OPEN_AI_ORG_ID: string
            OPEN_AI_PROJECT_ID: string

        }
    }
}

export { }