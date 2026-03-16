declare class EvolutionWebhookKeyDto {
    remoteJid: string;
}
declare class EvolutionWebhookDataDto {
    key: EvolutionWebhookKeyDto;
    pushName?: string;
    message?: Record<string, unknown>;
    text?: string;
    messageTimestamp?: string;
}
export declare class EvolutionMessageWebhookDto {
    event?: string;
    instance?: string;
    data: EvolutionWebhookDataDto;
}
export {};
