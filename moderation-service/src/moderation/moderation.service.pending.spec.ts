import { Repository } from 'typeorm';
import { ModerationItem, ModerationStatus } from './moderation-item.entity';
import { ModerationService } from './moderation.service';

describe('ModerationService.pending', () => {
  let repository: { find: jest.Mock };
  let service: ModerationService;

  beforeEach(() => {
    repository = { find: jest.fn().mockResolvedValue([]) };
    service = new ModerationService(repository as unknown as Repository<ModerationItem>);
  });

  it('liste les annonces en attente, de la plus ancienne a la plus recente, bornees a 100', async () => {
    await service.pending();

    expect(repository.find).toHaveBeenCalledWith({
      where: { status: ModerationStatus.PENDING },
      order: { receivedAt: 'ASC' },
      take: 100,
    });
  });

  it('accepte une limite personnalisee', async () => {
    await service.pending(10);

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});
