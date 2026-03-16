import { BaseEntity } from '../../../common/entities/base.entity';
export type MessageSender = 'user' | 'bot' | 'client';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';
export declare class MessageEntity extends BaseEntity {
    conversationId: string;
    sender: MessageSender;
    content: string;
    type: MessageType;
}
