import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../../common/database/database.service';
import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { BotMemoryService } from '../../bot-memory/services/bot-memory.service';
import { CreateMemoryItemDto } from '../dto/create-memory-item.dto';
import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdateMemoryItemDto } from '../dto/update-memory-item.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import {
  BotCenterConversationRecord,
  BotCenterOverviewResponse,
  BotCenterSeedData,
  BotContactContextResponse,
  BotConversationDetailResponse,
  BotConversationSummary,
  BotLogResponse,
  BotMemoryItemResponse,
  BotMemoryResponse,
  BotMessageResponse,
  BotPromptConfigResponse,
  BotStatusCardResponse,
  BotStatusResponse,
  BotToolResponse,
  SendTestMessageResponse,
  ServiceHealthState,
} from '../types/bot-center.types';

@Injectable()
export class BotCenterService {
  constructor(
    private readonly botConfigurationService: BotConfigurationService,
    private readonly botMemoryService: BotMemoryService,
    private readonly databaseService: DatabaseService,
  ) {}

  private readonly dataStore: BotCenterSeedData = this.createSeedData();

  async getOverview(selectedConversationId?: string): Promise<BotCenterOverviewResponse> {
    const selectedConversation = selectedConversationId
      ? await this.getConversationDetail(selectedConversationId)
      : await this.buildConversationDetail(this.dataStore.conversations[0]);

    return {
      conversations: this.listConversations(),
      tools: this.listTools(),
      logs: this.listLogs(),
      status: this.getStatus(),
      prompt: this.getPromptConfig(),
      selectedConversation,
    };
  }

  listConversations(): BotConversationSummary[] {
    return this.dataStore.conversations
      .map((record) => ({ ...record.summary }))
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  getConversationMessages(conversationId: string): BotMessageResponse[] {
    return this.getConversationRecordOrThrow(conversationId).messages.map((message) => ({ ...message }));
  }

  getConversationContext(conversationId: string): BotContactContextResponse {
    return { ...this.getConversationRecordOrThrow(conversationId).context };
  }

  async getConversationMemory(conversationId: string): Promise<BotMemoryResponse> {
    const memoryContext = this.botMemoryService.buildMemoryContext(conversationId);

    if (
      memoryContext.shortTerm.length > 0 ||
      memoryContext.longTerm.length > 0 ||
      memoryContext.operational.length > 0
    ) {
      return {
        shortTerm: memoryContext.shortTerm.map((item) => this.mapMemoryItem(item)),
        longTerm: memoryContext.longTerm.map((item) => this.mapMemoryItem(item)),
        operational: memoryContext.operational.map((item) => this.mapMemoryItem(item)),
      };
    }

    const memory = this.getConversationRecordOrThrow(conversationId).memory;

    return {
      shortTerm: memory.shortTerm.map((item) => ({ ...item })),
      longTerm: memory.longTerm.map((item) => ({ ...item })),
      operational: memory.operational.map((item) => ({ ...item })),
    };
  }

  async createConversationMemory(
    conversationId: string,
    payload: CreateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    this.getConversationRecordOrThrow(conversationId);
    const item = await this.botMemoryService.createManualMemory({
      conversationId,
      scope: payload.type,
      title: payload.title,
      content: payload.content,
    });

    this.prependLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Memory created',
      summary: `A ${payload.type} memory note was added from Bot Center.`,
      severity: 'info',
      conversationId,
    });

    return {
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.scope,
      updatedAt: item.updatedAt,
      isEditable: true,
    };
  }

  async updateConversationMemory(
    conversationId: string,
    memoryId: string,
    payload: UpdateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    this.getConversationRecordOrThrow(conversationId);
    const item = await this.botMemoryService.updateManualMemory(memoryId, {
      scope: payload.type,
      title: payload.title,
      content: payload.content,
    });

    if (item.conversationId !== conversationId) {
      throw new NotFoundException(`Memory item ${memoryId} was not found.`);
    }

    this.prependLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Memory updated',
      summary: 'A memory note was updated from Bot Center.',
      severity: 'info',
      conversationId,
    });

    return {
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.scope,
      updatedAt: item.updatedAt,
      isEditable: true,
    };
  }

  async deleteConversationMemory(
    conversationId: string,
    memoryId: string,
  ): Promise<{ deleted: true }> {
    this.getConversationRecordOrThrow(conversationId);
    await this.botMemoryService.deleteManualMemory(memoryId);

    this.prependLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Memory deleted',
      summary: 'A memory note was removed from Bot Center.',
      severity: 'warning',
      conversationId,
    });

    return { deleted: true };
  }

  listTools(): BotToolResponse[] {
    return this.dataStore.tools.map((tool) => ({ ...tool }));
  }

  listLogs(): BotLogResponse[] {
    return this.dataStore.logs
      .map((log) => ({ ...log }))
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  getStatus(): BotStatusResponse {
    const configuration = this.botConfigurationService.getConfiguration();
    const databaseHealth = this.databaseService.getHealth();
    const memoryStats = this.botMemoryService.getStats();
    const openAiConfigured =
      Boolean(configuration.openai.apiKey) && !configuration.openai.apiKey.includes('*');

    return {
      connectedChannel: this.buildStatusCard(
        'Connected Channel',
        configuration.evolution.isEnabled ? 'Evolution Ready' : 'Channel Disabled',
        configuration.evolution.isEnabled
          ? 'Evolution webhook entrypoint is enabled and ready to receive events.'
          : 'Inbound channel integration is currently disabled in configuration.',
        configuration.evolution.isEnabled ? 'healthy' : 'degraded',
      ),
      aiStatus: this.buildStatusCard(
        'AI Status',
        openAiConfigured ? 'Credentials Loaded' : 'Mock Fallback',
        openAiConfigured
          ? 'OpenAI service can generate real drafts when orchestration selects AI.'
          : 'OpenAI credentials are missing or masked, so mock drafting is active.',
        openAiConfigured ? 'healthy' : 'degraded',
      ),
      backendStatus: this.buildStatusCard(
        'Backend Status',
        'NestJS Runnable',
        'Main application, validation, CORS, health, webhook, and orchestration routes are registered.',
        'healthy',
      ),
      databaseStatus: this.buildStatusCard(
        'Database Status',
        databaseHealth.persistenceMode === 'postgres'
          ? 'PostgreSQL Mode'
          : 'File Persistence Mode',
        `Persistence mode is ${databaseHealth.persistenceMode}; PostgreSQL contract remains prepared through environment-based configuration.`,
        databaseHealth.configured ? 'healthy' : 'degraded',
      ),
      memoryStatus: this.buildStatusCard(
        'Memory Status',
        `${memoryStats.messageRecords} records`,
        `Memory store currently has ${memoryStats.messageRecords} message records and ${memoryStats.summaries} summaries persisted.`,
        configuration.memory.enableShortTermMemory ? 'healthy' : 'degraded',
      ),
    };
  }

  getPromptConfig(): BotPromptConfigResponse {
    const prompt = this.botConfigurationService.getActivePrompt();
    return {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      updatedAt: prompt.updatedAt,
    };
  }

  async updatePromptConfig(payload: UpdatePromptDto): Promise<BotPromptConfigResponse> {
    const currentPrompt = this.botConfigurationService.getActivePrompt();
    const updated = await this.botConfigurationService.updatePrompt(currentPrompt.id, {
      title: payload.title,
      description: payload.description,
      content: payload.content,
    });

    this.prependLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Prompt updated',
      summary: 'Bot prompt configuration was updated through the admin console.',
      severity: 'info',
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      content: updated.content,
      updatedAt: updated.updatedAt,
    };
  }

  async sendTestMessage(payload: SendTestMessageDto): Promise<SendTestMessageResponse> {
    const conversation = this.getConversationRecordOrThrow(payload.conversationId);
    const dispatchedAt = new Date().toISOString();
    const preview = payload.message.slice(0, 90);

    conversation.messages.push({
      id: `msg-${Date.now()}`,
      conversationId: payload.conversationId,
      author: 'operator',
      body: payload.message,
      timestamp: dispatchedAt,
      state: 'queued',
    });

    conversation.summary = {
      ...conversation.summary,
      lastMessagePreview: preview,
      timestamp: dispatchedAt,
    };

    this.prependLog({
      id: `log-${Date.now() + 1}`,
      timestamp: dispatchedAt,
      eventType: 'Test message accepted',
      summary: `Placeholder dispatch accepted for conversation ${payload.conversationId}.`,
      severity: 'warning',
      conversationId: payload.conversationId,
    });

    await this.botMemoryService.saveOutgoingMessageMemory({
      conversationId: payload.conversationId,
      senderId: payload.conversationId,
      channel: 'internal-test',
      content: payload.message,
      metadata: { source: 'bot-center-test-message' },
    });

    return {
      success: true,
      conversationId: payload.conversationId,
      message: 'Test message accepted for placeholder dispatch. No external channel was invoked.',
      dispatchedAt,
      status: 'accepted',
    };
  }

  async getConversationDetail(conversationId: string): Promise<BotConversationDetailResponse> {
    return this.buildConversationDetail(this.getConversationRecordOrThrow(conversationId));
  }

  private getConversationRecordOrThrow(conversationId: string): BotCenterConversationRecord {
    const record = this.dataStore.conversations.find((item) => item.summary.id === conversationId);

    if (!record) {
      throw new NotFoundException(`Conversation ${conversationId} was not found.`);
    }

    return record;
  }

  private async buildConversationDetail(record: BotCenterConversationRecord): Promise<BotConversationDetailResponse> {
    return {
      conversation: { ...record.summary },
      messages: record.messages.map((message) => ({ ...message })),
      context: { ...record.context },
      memory: await this.getConversationMemory(record.summary.id),
    };
  }

  private mapMemoryItem(item: {
    id: string;
    title: string;
    content: string;
    scope: 'shortTerm' | 'longTerm' | 'operational';
    createdAt: string;
    isEditable?: boolean;
  }): BotMemoryItemResponse {
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.scope,
      updatedAt: item.createdAt,
      isEditable: item.isEditable ?? false,
    };
  }

  private prependLog(log: BotLogResponse): void {
    this.dataStore.logs.unshift(log);
  }

  private createSeedData(): BotCenterSeedData {
    const now = new Date();

    const conversations: BotCenterConversationRecord[] = [
      this.buildConversationRecord({
        id: 'conv-001',
        contactName: 'Marina Costa',
        phone: '+55 11 99871-2010',
        lastMessagePreview: 'Can the bot send payment reminders after business hours?',
        unreadCount: 3,
        stage: 'negotiation',
        timestamp: this.isoMinutesAgo(now, 6),
        context: {
          customerName: 'Marina Costa',
          phone: '+55 11 99871-2010',
          role: 'Finance Coordinator',
          businessType: 'Retail Chain',
          city: 'Sao Paulo',
          tags: ['VIP account', 'Finance lead', 'Needs after-hours policy'],
          productKnowledge: [
            {
              name: 'FULLPOS Collections Assistant',
              summary: 'Automates payment reminder flows with tone controls, due-date awareness, and safe escalation thresholds.',
              keyCapabilities: ['Schedule reminder sequences by due date', 'Adjust tone by account segment', 'Hand off disputes above approved thresholds'],
              qualificationSignals: ['Needs billing reminders after hours', 'Wants less robotic collection tone', 'Requires finance-safe escalation rules'],
              cautionPoints: ['Do not promise discounts without policy approval', 'Disputed balances must escalate to finance'],
            },
          ],
        },
        messages: [
          this.buildMessage('m-001', 'conv-001', 'contact', 'We want FULLPOS Bot to handle late payment reminders without sounding robotic.', this.isoMinutesAgo(now, 29), 'read'),
          this.buildMessage('m-002', 'conv-001', 'bot', 'Understood. I can use account status, payment due date, and approved tone guidelines before sending.', this.isoMinutesAgo(now, 24), 'read'),
          this.buildMessage('m-003', 'conv-001', 'contact', 'Can the bot send payment reminders after business hours?', this.isoMinutesAgo(now, 6), 'read'),
        ],
        memory: {
          shortTerm: [
            this.buildMemoryItem('mem-001', 'Immediate objective', 'Validate compliant late payment reminder flows for WhatsApp.', 'shortTerm', this.isoMinutesAgo(now, 8)),
          ],
          longTerm: [
            this.buildMemoryItem('mem-002', 'Client policy', 'Tone must stay consultative and avoid aggressive collections language.', 'longTerm', this.isoHoursAgo(now, 5)),
          ],
          operational: [
            this.buildMemoryItem('mem-003', 'Operational rule', 'Escalate any billing dispute above R$10,000 to finance operations.', 'operational', this.isoHoursAgo(now, 1)),
          ],
        },
      }),
      this.buildConversationRecord({
        id: 'conv-002',
        contactName: 'Felipe Andrade',
        phone: '+55 21 99415-8802',
        lastMessagePreview: 'We need the memory rules aligned with franchise operations.',
        unreadCount: 0,
        stage: 'qualified',
        timestamp: this.isoMinutesAgo(now, 18),
        context: {
          customerName: 'Felipe Andrade',
          phone: '+55 21 99415-8802',
          role: 'Operations Director',
          businessType: 'Franchise Network',
          city: 'Rio de Janeiro',
          tags: ['Franchise', 'Memory review', 'Regional operations'],
          productKnowledge: [
            {
              name: 'FULLPOS Franchise Memory Layer',
              summary: 'Persists operational context by store group, owner profile, and regional workflow constraints.',
              keyCapabilities: ['Store regional operating model per franchise', 'Keep owner profile in long-term memory', 'Support segmented qualification policies'],
              qualificationSignals: ['Multi-store franchise operation', 'Needs memory behavior by region', 'Requires operations-led prompt review'],
              cautionPoints: ['Do not collapse all stores into one generic profile', 'Prompt changes affecting qualification need approval'],
            },
          ],
        },
        messages: [
          this.buildMessage('m-004', 'conv-002', 'operator', 'We can segment franchise operators by region and store operating model.', this.isoMinutesAgo(now, 42), 'delivered'),
          this.buildMessage('m-005', 'conv-002', 'contact', 'We need the memory rules aligned with franchise operations.', this.isoMinutesAgo(now, 18), 'read'),
        ],
        memory: {
          shortTerm: [
            this.buildMemoryItem('mem-004', 'Regional segmentation', 'Franchise stores must be grouped by city cluster before outreach.', 'shortTerm', this.isoMinutesAgo(now, 22)),
          ],
          longTerm: [
            this.buildMemoryItem('mem-005', 'Franchise context', 'Operations team wants memory to preserve store model and franchise owner profile.', 'longTerm', this.isoDaysAgo(now, 3)),
          ],
          operational: [
            this.buildMemoryItem('mem-006', 'Review checkpoint', 'Any prompt change that affects qualification must be reviewed by operations leadership.', 'operational', this.isoHoursAgo(now, 9)),
          ],
        },
      }),
      this.buildConversationRecord({
        id: 'conv-003',
        contactName: 'Bianca Sales',
        phone: '+55 31 98654-1107',
        lastMessagePreview: 'Please escalate this lead to a human operator this afternoon.',
        unreadCount: 1,
        stage: 'escalated',
        timestamp: this.isoHoursAgo(now, 2),
        context: {
          customerName: 'Bianca Sales',
          phone: '+55 31 98654-1107',
          role: 'Commercial Manager',
          businessType: 'B2B Services',
          city: 'Belo Horizonte',
          tags: ['Escalation', 'High intent', 'Human handoff'],
          productKnowledge: [
            {
              name: 'FULLPOS Enterprise Bot Orchestrator',
              summary: 'Central decision layer that classifies intent, loads memory, decides tool usage, and escalates when confidence is low.',
              keyCapabilities: ['Role and intent classification', 'Memory-aware response planning', 'Human handoff routing for sensitive cases'],
              qualificationSignals: ['Needs same-day human escalation', 'Requires safe handling for strategic pricing', 'Wants context preserved during transfer'],
              cautionPoints: ['Strategic pricing should not auto-close without human review'],
            },
          ],
        },
        messages: [
          this.buildMessage('m-006', 'conv-003', 'contact', 'Please escalate this lead to a human operator this afternoon.', this.isoHoursAgo(now, 2, 5), 'read'),
          this.buildMessage('m-007', 'conv-003', 'bot', 'Escalation rule acknowledged. I am routing the conversation and preserving the current context.', this.isoHoursAgo(now, 2), 'read'),
        ],
        memory: {
          shortTerm: [
            this.buildMemoryItem('mem-007', 'Escalation summary', 'Strategic pricing review should be handed to a commercial specialist today.', 'shortTerm', this.isoHoursAgo(now, 2)),
          ],
          longTerm: [],
          operational: [
            this.buildMemoryItem('mem-008', 'Escalation note', 'Bianca requested a same-day human follow-up for strategic pricing review.', 'operational', this.isoHoursAgo(now, 2)),
          ],
        },
      }),
      this.buildConversationRecord({
        id: 'conv-004',
        contactName: 'Rafael Moura',
        phone: '+55 41 99740-1243',
        lastMessagePreview: 'The customer onboarding flow is approved by the operations team.',
        unreadCount: 0,
        stage: 'onboarding',
        timestamp: this.isoHoursAgo(now, 7),
        context: {
          customerName: 'Rafael Moura',
          phone: '+55 41 99740-1243',
          role: 'Implementation Lead',
          businessType: 'Enterprise SaaS',
          city: 'Curitiba',
          tags: ['Onboarding', 'Ops approved'],
          productKnowledge: [
            {
              name: 'FULLPOS Guided Onboarding Flows',
              summary: 'Supports phased rollout, checklist-based activation, and operator training milestones for enterprise deployments.',
              keyCapabilities: ['Phased onboarding by store group', 'Track pilot approval milestones', 'Attach rollout checklist per phase'],
              qualificationSignals: ['Implementation team already approved pilot', 'Needs explicit deployment checklist'],
              cautionPoints: ['Do not mark rollout complete before operator training is confirmed'],
            },
          ],
        },
        messages: [
          this.buildMessage('m-008', 'conv-004', 'contact', 'The customer onboarding flow is approved by the operations team.', this.isoHoursAgo(now, 7, 12), 'read'),
        ],
        memory: {
          shortTerm: [
            this.buildMemoryItem('mem-009', 'Onboarding milestone', 'Customer approved pilot flow and requested deployment checklist.', 'shortTerm', this.isoHoursAgo(now, 7)),
          ],
          longTerm: [
            this.buildMemoryItem('mem-010', 'Implementation profile', 'Requires phased rollout by store group with explicit operator training.', 'longTerm', this.isoDaysAgo(now, 5)),
          ],
          operational: [],
        },
      }),
      this.buildConversationRecord({
        id: 'conv-005',
        contactName: 'Camila Nunes',
        phone: '+55 62 99811-3321',
        lastMessagePreview: 'Can we test a fallback prompt for invalid CPF formatting?',
        unreadCount: 2,
        stage: 'follow_up',
        timestamp: this.isoDaysAgo(now, 1, 1),
        context: {
          customerName: 'Camila Nunes',
          phone: '+55 62 99811-3321',
          role: 'Support Supervisor',
          businessType: 'Healthcare Network',
          city: 'Goiania',
          tags: ['Prompt tuning', 'Validation flow'],
          productKnowledge: [
            {
              name: 'FULLPOS Validation Guardrails',
              summary: 'Controls CPF and identity validation fallback flows with audit-safe retry behavior.',
              keyCapabilities: ['Retry validation without restarting the entire flow', 'Keep auditability for sensitive branches', 'Use conservative fallback prompts in regulated segments'],
              qualificationSignals: ['Needs CPF-specific fallback handling', 'Works in a regulated healthcare environment'],
              cautionPoints: ['Do not request unnecessary sensitive data', 'Validation retries must remain explicit and traceable'],
            },
          ],
        },
        messages: [
          this.buildMessage('m-009', 'conv-005', 'contact', 'Can we test a fallback prompt for invalid CPF formatting?', this.isoDaysAgo(now, 1, 1), 'read'),
          this.buildMessage('m-010', 'conv-005', 'bot', 'Yes. We can isolate the validation branch and request only the missing digits.', this.isoDaysAgo(now, 1), 'delivered'),
        ],
        memory: {
          shortTerm: [],
          longTerm: [
            this.buildMemoryItem('mem-011', 'Validation issue', 'CPF fallback prompt should request only the missing digits, not restart the full flow.', 'longTerm', this.isoDaysAgo(now, 1)),
          ],
          operational: [
            this.buildMemoryItem('mem-012', 'Compliance note', 'Healthcare clients require conservative validation retries and explicit auditability.', 'operational', this.isoDaysAgo(now, 2)),
          ],
        },
      }),
    ];

    return {
      conversations,
      tools: [
        {
          id: 'tool-001',
          name: 'CRM Lookup',
          description: 'Queries customer ownership, account tier, and account manager.',
          category: 'Customer Data',
          active: true,
        },
        {
          id: 'tool-002',
          name: 'Billing Status',
          description: 'Checks invoice state, overdue ranges, and collection policy flags.',
          category: 'Finance',
          active: true,
        },
        {
          id: 'tool-003',
          name: 'Knowledge Base Search',
          description: 'Retrieves procedural answers from approved enterprise documentation.',
          category: 'Knowledge',
          active: true,
        },
        {
          id: 'tool-004',
          name: 'Human Handoff',
          description: 'Opens a support escalation route with preserved context and summary.',
          category: 'Operations',
          active: false,
        },
        {
          id: 'tool-005',
          name: 'Memory Sync',
          description: 'Coordinates short-term and long-term memory refresh across the orchestration layer.',
          category: 'Memory',
          active: true,
        },
      ],
      logs: [
        {
          id: 'log-001',
          timestamp: this.isoMinutesAgo(now, 5),
          eventType: 'Message classified',
          summary: 'Intent classified as billing_reminder_policy with high confidence.',
          severity: 'info',
          conversationId: 'conv-001',
        },
        {
          id: 'log-002',
          timestamp: this.isoMinutesAgo(now, 10),
          eventType: 'Memory updated',
          summary: 'Short-term memory refreshed with after-hours reminder constraint.',
          severity: 'info',
          conversationId: 'conv-001',
        },
        {
          id: 'log-003',
          timestamp: this.isoMinutesAgo(now, 21),
          eventType: 'Prompt review',
          summary: 'Operator inspected prompt branch used for franchise qualification.',
          severity: 'warning',
          conversationId: 'conv-002',
        },
        {
          id: 'log-004',
          timestamp: this.isoHoursAgo(now, 2),
          eventType: 'Escalation created',
          summary: 'A human handoff was requested and routed to commercial operations.',
          severity: 'critical',
          conversationId: 'conv-003',
        },
        {
          id: 'log-005',
          timestamp: this.isoMinutesAgo(now, 2),
          eventType: 'Health check',
          summary: 'WhatsApp, AI runtime, and persistence services returned healthy responses.',
          severity: 'info',
        },
      ],
      status: {
        connectedChannel: this.buildStatusCard('Connected Channel', 'WhatsApp Business', 'Primary inbound and outbound channel is live.', 'healthy'),
        aiStatus: this.buildStatusCard('AI Status', 'Inference Ready', 'Primary LLM gateway is responsive within SLA.', 'healthy'),
        backendStatus: this.buildStatusCard('Backend Status', 'Degraded Retry', 'Two retry spikes were detected in the workflow orchestrator.', 'degraded'),
        databaseStatus: this.buildStatusCard('Database Status', 'PostgreSQL Ready', 'Persistence layer contract is stable and ready for repository wiring.', 'healthy'),
        memoryStatus: this.buildStatusCard('Memory Status', 'Redis Pending', 'In-memory mock storage is active while Redis integration is staged.', 'degraded'),
      },
      prompt: {
        id: 'prompt-001',
        title: 'Sales Qualification Prompt',
        description: 'Controls enterprise qualification, memory loading, escalation rules, and tool selection.',
        content:
          'You are FULLPOS Bot, an enterprise assistant for WhatsApp operations. Always inspect the current contact context, short-term memory, long-term memory, and operational rules before responding. Prioritize accuracy over speed, never invent billing or contract information, escalate when thresholds are exceeded, and keep the tone concise, professional, and aligned with the client-approved communication style.',
        updatedAt: this.isoMinutesAgo(now, 12),
      },
    };
  }

  private buildConversationRecord(input: {
    id: string;
    contactName: string;
    phone: string;
    lastMessagePreview: string;
    unreadCount: number;
    stage: BotConversationSummary['stage'];
    timestamp: string;
    context: BotContactContextResponse;
    messages: BotMessageResponse[];
    memory: BotMemoryResponse;
  }): BotCenterConversationRecord {
    return {
      summary: {
        id: input.id,
        contactName: input.contactName,
        phone: input.phone,
        lastMessagePreview: input.lastMessagePreview,
        unreadCount: input.unreadCount,
        stage: input.stage,
        timestamp: input.timestamp,
      },
      context: input.context,
      messages: input.messages,
      memory: input.memory,
    };
  }

  private buildMessage(
    id: string,
    conversationId: string,
    author: BotMessageResponse['author'],
    body: string,
    timestamp: string,
    state: BotMessageResponse['state'],
  ): BotMessageResponse {
    return {
      id,
      conversationId,
      author,
      body,
      timestamp,
      state,
    };
  }

  private buildMemoryItem(
    id: string,
    title: string,
    content: string,
    type: BotMemoryItemResponse['type'],
    updatedAt: string,
  ): BotMemoryItemResponse {
    return {
      id,
      title,
      content,
      type,
      updatedAt,
    };
  }

  private buildStatusCard(
    label: string,
    value: string,
    description: string,
    state: ServiceHealthState,
  ): BotStatusCardResponse {
    return {
      label,
      value,
      description,
      state,
    };
  }

  private isoMinutesAgo(reference: Date, minutes: number): string {
    return new Date(reference.getTime() - minutes * 60_000).toISOString();
  }

  private isoHoursAgo(reference: Date, hours: number, extraMinutes = 0): string {
    return new Date(reference.getTime() - hours * 3_600_000 - extraMinutes * 60_000).toISOString();
  }

  private isoDaysAgo(reference: Date, days: number, extraHours = 0): string {
    return new Date(reference.getTime() - days * 86_400_000 - extraHours * 3_600_000).toISOString();
  }
}