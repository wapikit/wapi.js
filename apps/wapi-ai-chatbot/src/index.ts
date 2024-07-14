import { TextMessage, type TextMessageEvent } from '@wapijs/wapi.js'
import { whatsappClient } from './utils/client'
import { askAi } from './utils/gpt'
import { getCache, setCache } from './utils/cache'

async function init() {
	try {
		whatsappClient.on('Ready', () => {
			console.log('Client is ready')
		})

		whatsappClient.on('Error', error => {
			console.error('Error', error.message)
		})

		whatsappClient.on('TextMessage', async (event: TextMessageEvent) => {
			const cachedResponse = await getCache(event.text.data.text)
			console.log({ cachedResponse })
			let response = 'Sorry, I am not able to understand that.'
			if (cachedResponse) {
				response = String(cachedResponse)
			} else {
				const aiResponse = await askAi(event.text.data.text)
				response = aiResponse || response
				if (aiResponse) {
					setCache(event.text.data.text, aiResponse)
				}
			}

			console.log({ response })
			await event.reply({
				message: new TextMessage({
					text: response
				})
			})
		})

		whatsappClient.initiate()
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
