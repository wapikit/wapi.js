import { AxiosInstance } from 'axios'
// eslint-disable-next-line import/no-cycle
import { Client } from '../whatsapp'

export class MediaManager {
    /**
     * axios instance to make http request to the whatsapp cloud API
     * @type {AxiosInstance}
     * @memberof MessageManager
     */
    private axiosClient: AxiosInstance

    private apiPath: string

    /**
     * Message Manager
     * @constructor
     */
    constructor(client: Client) {
        this.axiosClient = client.getRequestClient
    }
}
