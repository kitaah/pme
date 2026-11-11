import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard, ROLE_MODERATOR, ROLES_KEY, RolesGuard } from '@pme/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

describe('ModerationController', () => {
  it('renvoie la file d attente de moderation', async () => {
    const items = [{ id: 'm1' }, { id: 'm2' }];
    const service = { pending: jest.fn().mockResolvedValue(items) };

    const controller = new ModerationController(service as unknown as ModerationService);

    await expect(controller.queue()).resolves.toBe(items);
    expect(service.pending).toHaveBeenCalledTimes(1);
  });

  it('est reserve aux moderateurs authentifies et limite en debit', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ModerationController)).toEqual([
      ThrottlerGuard,
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, ModerationController)).toEqual([ROLE_MODERATOR]);
  });
});
