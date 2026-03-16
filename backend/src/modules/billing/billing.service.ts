import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanEntity } from './entities/plan.entity';
import { SubscriptionEntity, type SubscriptionStatus } from './entities/subscription.entity';
import { PaypalClient } from './paypal.client';

@Injectable()
export class BillingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly paypalClient: PaypalClient,
    @InjectRepository(PlanEntity)
    private readonly plansRepository: Repository<PlanEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionsRepository: Repository<SubscriptionEntity>,
  ) {}

  async getMe(companyId: string) {
    const sub = await this.subscriptionsRepository.findOne({ where: { companyId } });
    if (!sub) throw new NotFoundException('Subscription not found.');
    return {
      subscription: {
        id: sub.id,
        status: sub.status,
        paypalSubscriptionId: sub.paypalSubscriptionId,
        startDate: sub.startDate,
        renewDate: sub.renewDate,
      },
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        price: sub.plan.price,
        maxUsers: sub.plan.maxUsers,
        maxBots: sub.plan.maxBots,
        maxChannels: sub.plan.maxChannels,
      },
    };
  }

  private appContext() {
    const returnUrl = this.configService.get<string>('BILLING_RETURN_URL') ?? 'https://tuapp.com/billing/success';
    const cancelUrl = this.configService.get<string>('BILLING_CANCEL_URL') ?? 'https://tuapp.com/billing/cancel';
    return {
      brand_name: 'AI Business Platform',
      user_action: 'SUBSCRIBE_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    };
  }

  async createPaypalSubscription(companyId: string): Promise<{ approvalUrl: string; paypalSubscriptionId: string }> {
    const sub = await this.subscriptionsRepository.findOne({ where: { companyId } });
    if (!sub) throw new NotFoundException('Subscription not found.');

    const paypalPlanId = this.configService.get<string>('PAYPAL_PLAN_ID') ?? '';
    if (!paypalPlanId) {
      throw new BadRequestException('PAYPAL_PLAN_ID is not configured');
    }

    const payload = {
      plan_id: paypalPlanId,
      application_context: this.appContext(),
    };

    const created = await this.paypalClient.postJson<{
      id: string;
      links: Array<{ href: string; rel: string; method?: string }>;
    }>('/v1/billing/subscriptions', payload);

    const approve = created.links?.find((l) => l.rel === 'approve')?.href;
    if (!approve) {
      throw new BadRequestException('PayPal approval link not found');
    }

    await this.subscriptionsRepository.update(
      { id: sub.id },
      { paypalSubscriptionId: created.id },
    );

    return { approvalUrl: approve, paypalSubscriptionId: created.id };
  }

  async cancelPaypalSubscription(companyId: string): Promise<{ cancelled: true }> {
    const sub = await this.subscriptionsRepository.findOne({ where: { companyId } });
    if (!sub) throw new NotFoundException('Subscription not found.');
    if (!sub.paypalSubscriptionId) {
      throw new BadRequestException('No PayPal subscription to cancel');
    }

    await this.paypalClient.postNoBody(`/v1/billing/subscriptions/${sub.paypalSubscriptionId}/cancel`, {
      reason: 'Cancelled by customer',
    });

    await this.subscriptionsRepository.update(
      { id: sub.id },
      { status: 'cancelled' as SubscriptionStatus },
    );

    return { cancelled: true };
  }

  async handleWebhook(event: any): Promise<{ received: true }> {
    const type = String(event?.event_type ?? '');
    const resource = event?.resource ?? {};

    const paypalId =
      (typeof resource?.id === 'string' && resource.id) ||
      (typeof resource?.billing_agreement_id === 'string' && resource.billing_agreement_id) ||
      '';

    if (!paypalId) {
      return { received: true };
    }

    const sub = await this.subscriptionsRepository.findOne({ where: { paypalSubscriptionId: paypalId } });
    if (!sub) {
      return { received: true };
    }

    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const nextTime = resource?.billing_info?.next_billing_time;
      const renewDate = nextTime ? new Date(nextTime) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.subscriptionsRepository.update(
        { id: sub.id },
        { status: 'active' as SubscriptionStatus, startDate: new Date(), renewDate },
      );
    }

    if (type === 'PAYMENT.SALE.COMPLETED') {
      const renewDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.subscriptionsRepository.update(
        { id: sub.id },
        {
          status: 'active' as SubscriptionStatus,
          renewDate,
        },
      );
    }

    if (type === 'BILLING.SUBSCRIPTION.CANCELLED') {
      await this.subscriptionsRepository.update(
        { id: sub.id },
        { status: 'cancelled' as SubscriptionStatus },
      );
    }

    return { received: true };
  }

  async ensureStarterPlanSeeded(): Promise<void> {
    const existing = await this.plansRepository.findOne({ where: { name: 'Starter' } });
    if (existing) return;
    await this.plansRepository.save(
      this.plansRepository.create({
        name: 'Starter',
        price: '25',
        maxUsers: 5,
        maxBots: 1,
        maxChannels: 1,
      }),
    );
  }
}
