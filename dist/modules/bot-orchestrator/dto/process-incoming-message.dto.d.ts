export declare class ProcessIncomingMessageDto {
    channel: string;
    senderId: string;
    senderName?: string;
    message: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
}
