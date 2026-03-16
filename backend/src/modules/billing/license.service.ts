import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { BotEntity } from '../bots/entities/bot.entity';
import { ChannelEntity } from '../channels/entities/channel.entity';
import { UserEntity } from '../users/entities/user.entity';
import { PlanEntity } from './entities/plan.entity';
import { SubscriptionEntity, type SubscriptionStatus } from './entities/subscription.entity';

const TRIAL_DAYS = 14;

@Injectable()
export class LicenseService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlanEntity)
    private readonly plansRepository: Repository<PlanEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionsRepository: Repository<SubscriptionEntity>,
  ) {}

  async getStarterPlan(): Promise<PlanEntity> {
    const existing = await this.plansRepository.findOne({ where: { name: 'Starter' } });
    if (existing) return existing;

    const created = this.plansRepository.create({
      name: 'Starter',
      price: '25',
      maxUsers: 5,
      maxBots: 1,
      maxChannels: 1,
    });
    return await this.plansRepository.save(created);
  }

  getTrialDates(now = new Date()): { startDate: Date; renewDate: Date } {
    const startDate = now;
    const renewDate = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    return { startDate, renewDate };
  }

  async getCompanySubscription(companyId: string): Promise<SubscriptionEntity> {
    const sub = await this.subscriptionsRepository.findOne({ where: { companyId } });
    if (!sub) {
      throw new NotFoundException('Subscription not found.');
    }
    return sub;
  }

  async ensureTrialSubscription(companyId: string): Promise<SubscriptionEntity> {
    const existing = await this.subscriptionsRepository.findOne({ where: { companyId } });
    if (existing) return existing;

    const plan = await this.getStarterPlan();
    const { startDate, renewDate } = this.getTrialDates();

    const sub = this.subscriptionsRepository.create({
      companyId,
      planId: plan.id,
      status: 'trial',
      paypalSubscriptionId: null,
      startDate,
      renewDate,
    });

    return await this.subscriptionsRepository.save(sub);
  }

  private isTrialValid(sub: SubscriptionEntity, now = new Date()): boolean {
    return sub.status === 'trial' && sub.renewDate.getTime() > now.getTime();
  }

  async assertSubscriptionActive(companyId: string): Promise<SubscriptionEntity> {
    const sub = await this.getCompanySubscription(companyId);
    const now = new Date();

    if (sub.status === 'active') return sub;

    if (this.isTrialValid(sub, now)) return sub;

    if (sub.status === 'trial' && sub.renewDate.getTime() <= now.getTime()) {
      await this.subscriptionsRepository.update({ id: sub.id }, { status: 'past_due' as SubscriptionStatus });
    }

    throw new ForbiddenException('Subscription required');
  }

  async assertPlanLimit(
    companyId: string,
    kind: 'users' | 'bots' | 'channels',
  ): Promise<void> {
    const sub = await this.assertSubscriptionActive(companyId);
    const plan = sub.plan;

    const usersRepo = this.dataSource.getRepository(UserEntity);
    const botsRepo = this.dataSource.getRepository(BotEntity);
    const channelsRepo = this.dataSource.getRepository(ChannelEntity);

    if (kind === 'users') {
      const count = await usersRepo.count({ where: { companyId } });
      if (count >= plan.maxUsers) throw new ForbiddenException('Plan limit reached');
      return;
    }

    if (kind === 'bots') {
      const count = await botsRepo.count({ where: { companyId } });
      if (count >= plan.maxBots) throw new ForbiddenException('Plan limit reached');
      return;
    }

    const count = await channelsRepo.count({ where: { companyId } });
    if (count >= plan.maxChannels) throw new ForbiddenException('Plan limit reached');
  }
}
