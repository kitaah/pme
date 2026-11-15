import { BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateListingDto } from './create-listing.dto';
import { HandoverPlacesService } from './handover-places.service';
import { ListingReferencesService } from './listing-references.service';

const dto = { title: 'Figurine', description: 'Édition 2019', condition: 'GOOD' } as unknown as CreateListingDto;

describe('ListingReferencesService', () => {
  let categories: { findActive: jest.Mock };
  let handoverPlaces: { findActive: jest.Mock };
  let service: ListingReferencesService;

  beforeEach(() => {
    categories = { findActive: jest.fn(async (code: string) => ({ id: 1, code })) };
    handoverPlaces = { findActive: jest.fn(async (code: string) => ({ id: 5, code })) };
    service = new ListingReferencesService(
      categories as unknown as CategoriesService,
      handoverPlaces as unknown as HandoverPlacesService,
    );
  });

  it('retrouve la categorie et le lieu de remise choisis', async () => {
    const references = await service.resolve({ ...dto, category: 'FILMS', handoverPlace: 'SHOP_LYON' });

    expect(categories.findActive).toHaveBeenCalledWith('FILMS');
    expect(handoverPlaces.findActive).toHaveBeenCalledWith('SHOP_LYON');
    expect(references).toEqual({ category: { id: 1, code: 'FILMS' }, handoverPlace: { id: 5, code: 'SHOP_LYON' } });
  });

  it('prend « Autres » et « a convenir » quand rien n est precise', async () => {
    await service.resolve(dto);

    expect(categories.findActive).toHaveBeenCalledWith('OTHER');
    expect(handoverPlaces.findActive).toHaveBeenCalledWith('TO_AGREE');
  });

  it('refuse une categorie inconnue ou retiree (400)', async () => {
    categories.findActive.mockResolvedValue(null);

    await expect(service.resolve({ ...dto, category: 'MEUBLES' })).rejects.toThrow(BadRequestException);
  });

  it('refuse un lieu de remise inconnu ou ferme (400)', async () => {
    handoverPlaces.findActive.mockResolvedValue(null);

    await expect(service.resolve({ ...dto, handoverPlace: 'SHOP_PARIS' })).rejects.toThrow(BadRequestException);
  });
});
