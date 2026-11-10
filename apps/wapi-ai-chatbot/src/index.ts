import { TextMessage, type TextMessageEvent } from '@wapijs/wapi.js'
import { whatsappClient } from './utils/client'
import { askAi } from './utils/gpt'

async function init() {
	try {
		whatsappClient.on('Ready', ({ port, path }) => {
			console.log(`Webhook listening on :${port}${path}`)
		})

		whatsappClient.on('Error', error => {
			console.error('Error', error.message)
		})

		whatsappClient.on('TextMessage', async (event: TextMessageEvent) => {
			await event.markAsRead({ typingIndicator: true })
			const aiResponse = await askAi(event.text, event.from)
			const response = await event.reply(new TextMessage({ text: aiResponse }))
			console.log('Replied', response.messageId)
		})

		await whatsappClient.webhook.listen()
	} catch (error) {
		console.error(error)
		// ! TODO: you may prefer to send a notification to your slack channel or email here
	}
}

init().catch(error => console.error(error))

process.on('unhandledRejection', error => {
	console.error('unhandledRejection', error)
	process.exit(1)
})

process.on('uncaughtException', error => {
	console.error('uncaughtException', error)
	process.exit(1)
})
