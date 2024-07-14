import { whatsappClient } from './utils/client'
import { ListInteractionMessage, TextMessage } from '@wapijs/wapi.js'

function init() {
	whatsappClient.on('Ready', () => {
		console.log('Client is ready')
	})

	const faq = {
		'What is wapijs': [
			{
				question: 'What is wapi.js?',
				answer: 'wapi.js is a Tyepscript SDK for building WhatsApp chatbots.'
			},
			{
				question: 'Main features of wapi.js?',
				answer: 'Object-oriented design, single client, easy messaging, event handling, media upload.'
			},
			{
				question: 'Can I build AI chatbots with wapi.js?',
				answer: "wapi.js itself doesn't have AI, but you can integrate with NLU services."
			}
		],
		'Getting Started': [
			{
				question: 'How do I get started with wapi.js?',
				answer: 'Check out the docs at https://javascript.wapikit.com/ and use the "create-wapi-app" template.'
			},
			{
				question: 'Is wapi.js easy to learn?',
				answer: 'Yes, designed for all levels. Docs and examples help you get started quickly.'
			}
		],
		Capabilities: [
			{
				question: 'What kind of chatbots can I build?',
				answer: 'Customer support, marketing, notifications, and more! Leverage WhatsApp Business API.'
			},
			{
				question: 'Can I integrate wapi.js with other systems?',
				answer: 'Absolutely! Integrate with existing backend system.'
			},
			{
				question: 'Are there examples of chatbots built with wapi.js?',
				answer: "It's in beta, so not many yet. Be among the first to build and share yours!"
			}
		],
		'Help & Support': [
			{
				question: 'Is wapi.js free and open-source?',
				answer: "Yes, it's completely free and open-source under the AGPL 3.0 License."
			},
			{
				question: 'Where can I get help or support for wapi.js?',
				answer: 'Create an issue on our GitHub repository: https://github.com/sarthakjdev/wapi.js/issues.'
			}
		]
	}

	const listMessage = new ListInteractionMessage({
		bodyText: 'Welcome to Wapi.js',
		buttonText: 'Ask questions',
		footerText: 'Beta version',
		sections: Object.keys(faq).map((section, sectionIndex) => {
			return {
				// @ts-ignore
				rows: faq[section].map((question, index) => {
					return {
						description: question.question,
						id: `section-${sectionIndex + 1}-question-${index + 1}`,
						title: `FAQ ${index + 1}`
					}
				}),
				title: section
			}
		})
	})

	whatsappClient.on('Error', error => {
		console.log('Error', error.message)
	})

	whatsappClient.on('TextMessage', async message => {
		console.log('Text Message')
		if (message.text.data.text.toLowerCase() === 'hello') {
			const response = await message.client.message.send({
				message: listMessage,
				phoneNumber: message.context.from
			})
			console.log({ response })
		} else {
			await message.reply({
				message: new TextMessage({
					text: 'Please say "hello" to proceed.'
				})
			})
		}
	})

	whatsappClient.on('ListInteraction', async message => {
		console.log('List Interaction', message)

		// it would be something like : section-1-question-1
		const messageListId = message.listId

		const sectionIndex = parseInt(messageListId.split('-')[1]) - 1
		const questionIndex = parseInt(messageListId.split('-')[3]) - 1

		// @ts-ignore
		const answerToReply = faq[Object.keys(faq)[sectionIndex]][questionIndex].answer

		await message.reply({
			message: new TextMessage({
				text: answerToReply
			})
		})
	})

	whatsappClient.initiate()
}

init()
