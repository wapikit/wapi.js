import OpenAI from 'openai'

const openAiApiKey = process.env.OPEN_AI_API_KEY

if (!openAiApiKey) {
    throw new Error('OPEN_AI_API_KEY not defined!')
}

const OpenApiClient = new OpenAI({
    apiKey: openAiApiKey,
    project: 'proj_viwVq5nzCR5Mj4TnIw4FQoNO',
    organization: 'org-wwfaGhYXIA7CBUSg6x8DbKYj'
})

export async function askAi(message: string): Promise<string | null> {
    try {
        const chatCompletion = await OpenApiClient.chat.completions.create({
            messages: [{ role: 'user', content: message }],
            model: 'gpt-3.5-turbo'
        })

        console.log(JSON.stringify({ chatCompletion }))

        return chatCompletion.choices[0].message.content
    } catch (error) {
        console.log({ error })
        return null
    }
}
