import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { LicenseService } from './license.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private readonly licenseService: LicenseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { companyId?: string } | undefined;

    if (!user?.companyId) {
      return true;
    }

    await this.licenseService.assertSubscriptionActive(user.companyId);
    return true;
  }
}
