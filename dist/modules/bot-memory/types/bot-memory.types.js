"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultBotMemoryStore = createDefaultBotMemoryStore;
function createDefaultBotMemoryStore() {
    const now = new Date().toISOString();
    return {
        messageRecords: [],
        conversationSummaries: [],
        operationalStates: [],
        longTermFacts: [
            {
                id: 'global-tone-policy',
                scope: 'longTerm',
                title: 'Enterprise tone policy',
                content: 'Responses must stay concise, accurate, and aligned with approved business policy.',
                relevanceScore: 0.74,
                createdAt: now,
            },
            {
                id: 'global-product-grounding',
                scope: 'longTerm',
                title: 'Product grounding rule',
                content: 'When answering about products or modules, use approved catalog facts and declared limitations only.',
                relevanceScore: 0.92,
                createdAt: now,
            },
        ],
    };
}
//# sourceMappingURL=bot-memory.types.js.map