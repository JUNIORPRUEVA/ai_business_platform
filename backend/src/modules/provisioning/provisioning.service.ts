import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

import { UserRole } from '../../common/auth/auth.types';
import { ConversationMemoryEntity } from '../ai-engine/entities/conversation-memory.entity';
import { PlanEntity } from '../billing/entities/plan.entity';
import { SubscriptionEntity } from '../billing/entities/subscription.entity';
import { BotEntity } from '../bots/entities/bot.entity';
import { ChannelEntity } from '../channels/entities/channel.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { ConversationEntity } from '../conversations/entities/conversation.entity';
import { EvolutionService } from '../evolution/evolution.service';
import { PromptEntity } from '../prompts/entities/prompt.entity';
import { UserEntity } from '../users/entities/user.entity';
import { RegisterCompanyDto } from '../auth/dto/register-company.dto';

export type ProvisionedCompany = {
  company: CompanyEntity;
  adminUser: Omit<UserEntity, 'passwordHash'>;
  subscription: SubscriptionEntity;
  bot: BotEntity;
  prompt: PromptEntity;
  channel: ChannelEntity;
  demoContact: ContactEntity;
  demoConversation: ConversationEntity;
};

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly evolutionService: EvolutionService,
  ) {}

  async provisionCompany(dto: RegisterCompanyDto): Promise<ProvisionedCompany> {
    const rawEmail = dto.adminEmail ?? dto.email;
    const rawPassword = dto.adminPassword ?? dto.password;

    if (!rawEmail) {
      throw new BadRequestException('adminEmail (or email) is required.');
    }
    if (!rawPassword) {
      throw new BadRequestException('adminPassword (or password) is required.');
    }

    const email = rawEmail.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const initialPrompt = [
      'Eres un asistente virtual profesional.',
      'Trabajas para la empresa del cliente.',
      'Debes responder preguntas de clientes de forma clara, amable y profesional.',
    ].join(' ');

    return this.dataSource.transaction(async (manager) => {
      const companiesRepo = manager.getRepository(CompanyEntity);
      const usersRepo = manager.getRepository(UserEntity);
      const plansRepo = manager.getRepository(PlanEntity);
      const subsRepo = manager.getRepository(SubscriptionEntity);
      const botsRepo = manager.getRepository(BotEntity);
      const promptsRepo = manager.getRepository(PromptEntity);
      const channelsRepo = manager.getRepository(ChannelEntity);
      const contactsRepo = manager.getRepository(ContactEntity);
      const conversationsRepo = manager.getRepository(ConversationEntity);
      const conversationMemoryRepo = manager.getRepository(ConversationMemoryEntity);

      const existingUser = await usersRepo.findOne({ where: { email } });
      if (existingUser) {
        throw new ConflictException('This email is already registered.');
      }

      const company = await companiesRepo.save(
        companiesRepo.create({
          name: dto.companyName,
          plan: dto.plan ?? 'starter',
          status: 'active',
        }),
      );

      const adminUser = await usersRepo.save(
        usersRepo.create({
          companyId: company.id,
          name: dto.adminName,
          email,
          passwordHash,
          role: 'admin' as UserRole,
        }),
      );

      const starterPlan =
        (await plansRepo.findOne({ where: { name: 'Starter' } })) ??
        (await plansRepo.save(
          plansRepo.create({
            name: 'Starter',
            price: '25',
            maxUsers: 5,
            maxBots: 1,
            maxChannels: 1,
          }),
        ));

      const now = new Date();
      const renewDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const subscription = await subsRepo.save(
        subsRepo.create({
          companyId: company.id,
          planId: starterPlan.id,
          status: 'trial',
          paypalSubscriptionId: null,
          startDate: now,
          renewDate,
        }),
      );

      const bot = await botsRepo.save(
        botsRepo.create({
          companyId: company.id,
          name: 'Asistente IA',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          language: 'es',
          systemPrompt: initialPrompt,
          status: 'active',
        }),
      );

      const prompt = await promptsRepo.save(
        promptsRepo.create({
          companyId: company.id,
          name: 'Prompt inicial del sistema',
          type: 'system',
          content: initialPrompt,
          active: true,
        }),
      );

      const channel = channelsRepo.create({
        companyId: company.id,
        type: 'whatsapp',
        name: 'WhatsApp principal',
        status: 'pending_connection',
        connectionStatus: 'connecting',
        config: {
          autoProvisioned: true,
        },
      });
      channel.instanceName = `company_${company.id}_main`;
      let savedChannel = await channelsRepo.save(channel);

      try {
        await this.evolutionService.createInstance({
          instanceName: savedChannel.instanceName!,
          qrcode: true,
        });

        await this.evolutionService.setWebhook({
          instanceName: savedChannel.instanceName!,
          webhookUrl: this.evolutionService.buildWebhookUrl(savedChannel.id),
          events: this.evolutionService.getDefaultInstanceWebhookEvents(),
        });

        savedChannel.connectionStatus = 'connecting';
        savedChannel.config = {
          ...savedChannel.config,
          evolutionProvisioningStatus: 'ready',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Evolution error.';

        this.logger.warn(
          `Skipping Evolution provisioning for company ${company.id}: ${message}`,
        );

        savedChannel.connectionStatus = 'disconnected';
        savedChannel.config = {
          ...savedChannel.config,
          evolutionProvisioningStatus: 'failed',
          evolutionProvisioningError: message,
        };
      }

      savedChannel = await channelsRepo.save(savedChannel);

      const demoContact = await contactsRepo.save(
        contactsRepo.create({
          companyId: company.id,
          name: 'Cliente Demo',
          phone: '000000000',
          email: null,
          tags: ['demo'],
        }),
      );

      const demoConversation = await conversationsRepo.save(
        conversationsRepo.create({
          companyId: company.id,
          channelId: savedChannel.id,
          contactId: demoContact.id,
          status: 'open',
        }),
      );

      await conversationMemoryRepo.save(
        conversationMemoryRepo.create({
          conversationId: demoConversation.id,
          role: 'system',
          content: initialPrompt,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _passwordHash, ...safeUser } = adminUser;

      return {
        company,
        adminUser: safeUser,
        subscription,
        bot,
        prompt,
        channel: savedChannel,
        demoContact,
        demoConversation,
      };
    });
  }
}
