import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListingSubmittedEvent } from './listing-submitted.event';

async function messages(payload: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(ListingSubmittedEvent, payload));
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('ListingSubmittedEvent', () => {
  const base = {
    listingId: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine',
    description: 'Edition 2019',
    condition: 'GOOD',
    submittedAt: '2026-11-04T10:00:00.000Z',
  };

  it('accepte un message publie par une ancienne version de l API, sans les champs du depot enrichi', async () => {
    await expect(messages(base)).resolves.toEqual([]);
  });

  it('accepte un message complet', async () => {
    await expect(
      messages({
        ...base,
        category: 'FILMS',
        kind: 'SALE',
        priceCents: 4500,
        wantedInExchange: 'Un Blu-ray',
        handoverPlace: 'SHOP_LYON',
        photoKey: 'pending/abc.webp',
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['category', 'meubles'],
    ['category', 'MEUBLES!'],
    ['kind', 'TROC'],
    ['priceCents', 0],
    ['priceCents', 12.5],
    ['wantedInExchange', 'a'.repeat(121)],
    ['handoverPlace', 'paris'],
    ['handoverPlace', 'SHOP LYON!'],
    ['photoKey', 'a'.repeat(201)],
  ])('refuse %s invalide (%s)', async (field, value) => {
    const result = await messages({ ...base, [field]: value });

    expect(result).toHaveLength(1);
    expect(result[0]).toContain(field);
  });
});
