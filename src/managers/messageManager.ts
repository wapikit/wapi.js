import { AxiosInstance, AxiosResponse } from 'axios'
import {
    AudioMessageComponent,
    DocumentMessageComponent,
    InteractiveMessageComponent, LocationMessageComponent, MessageComponent, MessageType, ReactionMessageComponent, TemplateMessageComponent, TextMessageComponent, VideoMessageComponent,
} from '@structures/index'
import { WhatsappError } from '@utils/error'
// eslint-disable-next-line import/no-cycle
import { Client } from '../whatsapp'

export class MessageManager {
    /**
     * axios instance to make http request to the whatsapp cloud API
     * @type {AxiosInstance}
     * @memberof MessageManager
     */
    private axiosClient: AxiosInstance

    /**
     * path of the messages api requests
     */
    private apiPath: string

    /**
     * Message Manager
     * @constructor
     * @memberof MessageManager
     */
    constructor(client: Client) {
        this.axiosClient = client.getRequestClient
        this.apiPath = `/${client.getVersion}/${client.getPhoneNumberId}/messages`
    }

    /**
     * sends text message to a recipent
     * @param {TextMessageComponent} textComponent
     * @param {string} recipent
     * @returns {Promise<AxiosResponse | WhatsappError>}
     * @memberof MessageManager
     */
    async sendText(textComponent: TextMessageComponent, recipent: string): Promise<AxiosResponse | WhatsappError> {
        try {
            if (recipent) {
                textComponent.setRecipent(recipent)
            } else if (textComponent.getRecipent === '' || textComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            textComponent.setRecipent(recipent)

            const response = await this.axiosClient.post(this.apiPath, textComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     * sends audio message to a recipent
     * @param {AudioMessageComponent} audioComponent
     * @param  {string} recipent
     * @returns
     * @memberof MessageManager
     */
    async audio(audioComponent: AudioMessageComponent, recipent: string) {
        try {
            if (recipent) {
                audioComponent.setRecipent(recipent)
            } else if (audioComponent.getRecipent === '' || audioComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            audioComponent.setRecipent(recipent)
            const response = await this.axiosClient.post(this.apiPath, audioComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     * sends the video message to a recipent
     * @param {VideoMessageComponent} videoComponent
     * @param recipent
     * @returns
     * @memberof MessageManager
     */
    async video(videoComponent: VideoMessageComponent, recipent: string) {
        try {
            if (recipent) {
                videoComponent.setRecipent(recipent)
            } else if (videoComponent.getRecipent === '' || videoComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            videoComponent.setRecipent(recipent)
            const response = await this.axiosClient.post(this.apiPath, videoComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     *  sends the document message to a recipent
     * @param  {DocumentMessageComponent} documentComponent
     * @param recipent
     * @returns
     * @memberof MessageManager
     */
    async document(documentComponent: DocumentMessageComponent, recipent: string) {
        try {
            if (recipent) {
                documentComponent.setRecipent(recipent)
            } else if (documentComponent.getRecipent === '' || documentComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            documentComponent.setRecipent(recipent)
            const response = await this.axiosClient.post(this.apiPath, documentComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     * sends the template message to a recipent
     * @param {TemplateMessageComponent} templateComponent
     * @param recipent
     * @returns
     * @memberof MessageManager
     */
    async template(templateComponent: TemplateMessageComponent, recipent: string) {
        try {
            if (recipent) {
                templateComponent.setRecipent(recipent)
            } else if (templateComponent.getRecipent === '' || templateComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            templateComponent.setRecipent(recipent)
            const response = await this.axiosClient.post(this.apiPath, templateComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     * sends the interactive message to a recipent
     * @param {InteractiveMessageComponent} interactiveComponent
     * @param recipent
     * @returns
     * @memberof MessageManager
     */
    async interaction(interactiveComponent: InteractiveMessageComponent, recipent: string) {
        try {
            if (recipent) {
                interactiveComponent.setRecipent(recipent)
            } else if (interactiveComponent.getRecipent === '' || interactiveComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            interactiveComponent.setRecipent(recipent)
            const response = await this.axiosClient.post(this.apiPath, interactiveComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     * sends the location message to a recipent
     * @param {LocationMessageComponent} locationComponent
     * @param recipent
     * @returns
     * @memberof MessageManager
     */
    async location(locationComponent: LocationMessageComponent, recipent?: string) {
        try {
            if (recipent) {
                locationComponent.setRecipent(recipent)
            } else if (locationComponent.getRecipent === '' || locationComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            const response = await this.axiosClient.post(this.apiPath, locationComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     *  sends the reaction message to a recipent
     * @param {ReactionMessageComponent} reactionComponent
     * @param recipent
     * @returns
     */
    async reaction(reactionComponent: ReactionMessageComponent, recipent: string) {
        try {
            if (recipent) {
                reactionComponent.setRecipent(recipent)
            } else if (reactionComponent.getRecipent === '' || reactionComponent.getRecipent === null) {
                throw new WhatsappError('Component must include a recipent id before sending')
            }
            reactionComponent.setRecipent(recipent)
            const response = await this.axiosClient.post(this.apiPath, reactionComponent)

            return response.data
        } catch (error) {
            return new WhatsappError(error)
        }
    }

    /**
     * mark a message as read
     * @param {string} messageId
     * @memberof MessageManager
     */
    async markRead(messageId: string) {
        try {
            const message = new MessageComponent({ status: 'read' })
            message.setMessageContext(messageId)
            const response = await this.axiosClient.post(this.apiPath)

            return response
        } catch (error) {
            throw new WhatsappError(error)
        }
    }
}
