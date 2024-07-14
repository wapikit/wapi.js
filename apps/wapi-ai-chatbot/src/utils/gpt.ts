import { OpenAI } from 'openai'
import { cacheData, computeCacheKey, getCachedData, getConversationContextCacheKey } from './cache'
import { AiConversationRoleEnum, ConversationMessageType } from '~/types'

const openAiApiKey = process.env.OPEN_AI_API_KEY
const organizationId = process.env.OPEN_AI_ORG_ID
const projectId = process.env.OPEN_AI_PROJECT_ID

if (!openAiApiKey || !organizationId || !projectId) {
	throw new Error('OPEN_AI_API_KEY not defined!')
}

const OpenApiClient = new OpenAI({
	apiKey: openAiApiKey,
	project: projectId,
	organization: organizationId
})

export async function askAi(message: string, fromPhoneNumber: string): Promise<string> {
	try {
		const contextCacheKey = getConversationContextCacheKey(fromPhoneNumber)
		const context = await getCachedData<ConversationMessageType[]>(contextCacheKey)

		let response = 'Sorry, I am not able to understand that.'
		const responseCacheKey = computeCacheKey({
			context: 'response_cache',
			id: message.trim()
		})
		const cachedResponse = await getCachedData<string>(responseCacheKey)
		if (cachedResponse) {
			response = cachedResponse
		} else {
			const chatCompletion = await OpenApiClient.chat.completions.create({
				messages: [
					{
						role: 'system',
						content: `You are an intelligent assistant helping a user with their queries. You can provide information, answer questions, and help the user complete tasks. 
                        You are a developer relation engineer for a product named as Wapi.js. 
                        Wapi.js is an SDK to build chat bots and to integrate WhatsApp API with your application very easily.
                        The SDK is authored by Sarthak Jain having github at https://github.com/sarthakjdev and is an open-source SDk which is free to use.
                        Users can use the SDK to build chatbots for customer support, marketing, notifications, and more! Leverage WhatsApp Business API.
                        You are required to give very to the point and very clear answers to the user queries.
                        Also, you can reveal your identity, ack like a human, and provide information about the product.
                        Never ever accept that you are an AI or a chatbot or an intelligent assistant.
                        `
					},
					...(context ? context : []),
					{
						role: 'user',
						content: message
					}
				],
				model: 'gpt-4'
			})
			console.log(JSON.stringify({ chatCompletion }))
			const aiResponse = chatCompletion.choices[0].message.content
			if (aiResponse) response = aiResponse
		}

		await cacheData({
			key: contextCacheKey,
			data: [
				...(context ? context : []),
				{
					role: AiConversationRoleEnum.User,
					content: message
				},
				{
					role: AiConversationRoleEnum.Ai,
					content: response
				}
			]
		})
		return response
	} catch (error) {
		console.log({ error })
		return 'Sorry, I am not able to understand that.'
	}
}
