import { EvolutionMessageWebhookDto } from '../dto/evolution-message-webhook.dto';
import { EvolutionWebhookService } from '../services/evolution-webhook.service';
declare class EvolutionWebhookParams {
    channelId: string;
}
export declare class EvolutionWebhookController {
    private readonly evolutionWebhookService;
    constructor(evolutionWebhookService: EvolutionWebhookService);
    processMessages(params: EvolutionWebhookParams, webhookToken: string | undefined, payload: EvolutionMessageWebhookDto): Promise<import("../types/evolution-webhook.types").EvolutionWebhookProcessResponse>;
}
export {};
