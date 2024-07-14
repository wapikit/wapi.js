export enum AiConversationRoleEnum {
	User = 'user',
	Ai = 'assistant'
}

export type ConversationMessageType = {
	role: AiConversationRoleEnum
	content: string
}
