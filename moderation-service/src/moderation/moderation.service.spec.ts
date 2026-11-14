import { Repository } from 'typeorm';
import { ListingSubmittedEvent } from './listing-submitted.event';
import { ModerationItem } from './moderation-item.entity';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  const event = {
    listingId: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine',
    description: 'Edition 2019',
    condition: 'GOOD',
    submittedAt: '2026-11-04T10:00:00.000Z',
  } as ListingSubmittedEvent;

  let repository: { insert: jest.Mock; find: jest.Mock };
  let service: ModerationService;

  beforeEach(() => {
    repository = { insert: jest.fn().mockResolvedValue(undefined), find: jest.fn() };
    service = new ModerationService(repository as unknown as Repository<ModerationItem>);
  });

  it('renvoie true quand l annonce est ajoutee a la file', async () => {
    await expect(service.enqueue(event)).resolves.toBe(true);
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: event.listingId, status: 'PENDING' }),
    );
  });

  it('applique les valeurs par defaut a un message publie avant le depot enrichi (deploiement progressif)', async () => {
    await service.enqueue(event);

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'OTHER',
        kind: 'EXCHANGE',
        priceCents: null,
        wantedInExchange: null,
        handoverPlace: 'TO_AGREE',
        photoKey: null,
      }),
    );
  });

  it('conserve la categorie, le type, le prix, la contrepartie, le lieu et le chemin de la photo recus', async () => {
    await service.enqueue({
      ...event,
      category: 'FILMS',
      kind: 'SALE',
      priceCents: 4500,
      wantedInExchange: 'Un Blu-ray',
      handoverPlace: 'SHOP_LYON',
      photoKey: 'pending/abc.webp',
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'FILMS',
        kind: 'SALE',
        priceCents: 4500,
        wantedInExchange: 'Un Blu-ray',
        handoverPlace: 'SHOP_LYON',
        photoKey: 'pending/abc.webp',
      }),
    );
  });

  it("est idempotent : une violation d'unicite (message rejoue) renvoie false", async () => {
    repository.insert.mockRejectedValue({ code: '23505' });

    await expect(service.enqueue(event)).resolves.toBe(false);
  });

  it("propage les autres erreurs de base pour que le message parte en file d'echec", async () => {
    repository.insert.mockRejectedValue(new Error('base indisponible'));

    await expect(service.enqueue(event)).rejects.toThrow('base indisponible');
  });
});
