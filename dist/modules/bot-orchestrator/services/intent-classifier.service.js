"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifierService = void 0;
const common_1 = require("@nestjs/common");
let IntentClassifierService = class IntentClassifierService {
    classify(payload, detectedRole) {
        const message = payload.message.toLowerCase();
        if (/(humano|human|operator|atendente|person)/.test(message)) {
            return {
                intent: 'human_handoff',
                confidence: 0.97,
                rationale: 'Sender explicitly requested a human handoff.',
            };
        }
        if (/(configur|prompt|openai|evolution|orchestrator|memoria|memory)/.test(message)) {
            return {
                intent: 'configuration_request',
                confidence: 0.91,
                rationale: 'Message references bot runtime configuration or admin controls.',
            };
        }
        if (/(preco|precio|price|valor|cost|plano|subscription)/.test(message)) {
            return {
                intent: 'pricing_inquiry',
                confidence: 0.92,
                rationale: 'Message contains pricing or plan qualification keywords.',
            };
        }
        if (/(boleto|invoice|payment|cobranca|cobrança|billing|fatura)/.test(message)) {
            return {
                intent: 'billing_question',
                confidence: 0.9,
                rationale: 'Message targets billing or payment handling.',
            };
        }
        if (/(pedido|order|tracking|status|entrega|delivery)/.test(message)) {
            return {
                intent: 'order_status',
                confidence: 0.88,
                rationale: 'Message asks for order status or delivery follow-up.',
            };
        }
        if (/(produto|product|sku|catalogo|catálogo|cardapio|cardápio|menu|estoque|inventory)/.test(message)) {
            return {
                intent: detectedRole === 'lead' ? 'catalog_search' : 'product_question',
                confidence: 0.86,
                rationale: 'Message asks about products, catalog, inventory, or item behavior.',
            };
        }
        if (/(erro|error|bug|ajuda|help|support|integracao|integração)/.test(message)) {
            return {
                intent: 'support_request',
                confidence: 0.85,
                rationale: 'Message indicates support or troubleshooting intent.',
            };
        }
        if (/^(oi|ola|olá|hello|hi|bom dia|boa tarde|boa noite)/.test(message)) {
            return {
                intent: 'greeting',
                confidence: 0.74,
                rationale: 'Message is a greeting with no stronger operational signal.',
            };
        }
        return {
            intent: 'unknown',
            confidence: 0.45,
            rationale: 'No strong rule matched. Message should be handled conservatively.',
        };
    }
};
exports.IntentClassifierService = IntentClassifierService;
exports.IntentClassifierService = IntentClassifierService = __decorate([
    (0, common_1.Injectable)()
], IntentClassifierService);
//# sourceMappingURL=intent-classifier.service.js.map