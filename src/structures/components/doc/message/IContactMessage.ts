import { BaseMessage } from './IBaseMessage'
import { Contact } from '../contact'

/**
 * contact message
 * @interface
 * @extends BaseMessage
 * @export
 */
export interface ContactMessage extends BaseMessage {
    contacts: Contact[]
}
