"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionWebhookService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const channels_service_1 = require("../../channels/channels.service");
const contacts_service_1 = require("../../contacts/contacts.service");
const conversations_service_1 = require("../../conversations/conversations.service");
const messages_service_1 = require("../../messages/messages.service");
let EvolutionWebhookService = class EvolutionWebhookService {
    channelsService;
    contactsService;
    conversationsService;
    messagesService;
    messageProcessingQueue;
    constructor(channelsService, contactsService, conversationsService, messagesService, messageProcessingQueue) {
        this.channelsService = channelsService;
        this.contactsService = contactsService;
        this.conversationsService = conversationsService;
        this.messagesService = messagesService;
        this.messageProcessingQueue = messageProcessingQueue;
    }
    async processIncomingMessage(params) {
        const normalized = this.normalizePayload(params.payload);
        const channel = await this.channelsService.getByIdUnsafe(params.channelId);
        if (channel.type !== 'whatsapp') {
            throw new common_1.BadRequestException('Channel is not a WhatsApp channel.');
        }
        const configuredToken = typeof channel.config['webhookToken'] === 'string'
            ? channel.config['webhookToken']
            : '';
        if (configuredToken && params.webhookToken !== configuredToken) {
            throw new common_1.ForbiddenException('Invalid webhook token.');
        }
        const companyId = channel.companyId;
        const contactPhone = normalized.senderId;
        const contact = await this.contactsService.findOrCreateByPhone(companyId, contactPhone, normalized.senderName ?? null);
        const conversation = await this.conversationsService.findOrCreateOpen(companyId, channel.id, contact.id);
        const message = await this.messagesService.create(companyId, conversation.id, {
            sender: 'client',
            content: normalized.message,
            type: 'text',
        });
        await this.messageProcessingQueue.add('process-inbound-message', {
            companyId,
            channelId: channel.id,
            contactPhone,
            conversationId: conversation.id,
            messageId: message.id,
        }, {
            removeOnComplete: 1000,
            removeOnFail: 1000,
        });
        return {
            normalizedMessage: normalized,
            orchestration: {
                queued: true,
                conversationId: conversation.id,
                messageId: message.id,
            },
        };
    }
    normalizePayload(payload) {
        const senderId = payload.data.key.remoteJid?.trim();
        const message = this.extractMessageText(payload);
        if (!senderId || !message) {
            throw new common_1.BadRequestException('Evolution webhook payload did not contain a valid sender or message.');
        }
        return {
            channel: 'whatsapp',
            senderId,
            senderName: payload.data.pushName,
            message,
            timestamp: payload.data.messageTimestamp,
            metadata: {
                event: payload.event,
                instance: payload.instance,
                rawMessage: payload.data.message,
            },
        };
    }
    extractMessageText(payload) {
        const directText = payload.data.text?.trim();
        if (directText) {
            return directText;
        }
        const message = payload.data.message;
        if (!message) {
            return '';
        }
        const conversation = message['conversation'];
        if (typeof conversation === 'string' && conversation.trim()) {
            return conversation.trim();
        }
        const extendedText = message['extendedTextMessage'];
        if (typeof extendedText === 'object' &&
            extendedText !== null &&
            typeof extendedText.text === 'string') {
            return (extendedText.text).trim();
        }
        const imageCaption = message['imageMessage'];
        if (typeof imageCaption === 'object' &&
            imageCaption !== null &&
            typeof imageCaption.caption === 'string') {
            return (imageCaption.caption).trim();
        }
        return '';
    }
};
exports.EvolutionWebhookService = EvolutionWebhookService;
exports.EvolutionWebhookService = EvolutionWebhookService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)('message-processing')),
    __metadata("design:paramtypes", [channels_service_1.ChannelsService,
        contacts_service_1.ContactsService,
        conversations_service_1.ConversationsService,
        messages_service_1.MessagesService,
        bullmq_2.Queue])
], EvolutionWebhookService);
//# sourceMappingURL=evolution-webhook.service.js.map