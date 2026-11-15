import { getMetadataArgsStorage } from 'typeorm';
import { Category } from './category.entity';
import { HandoverPlace } from './handover-place.entity';
import { Listing } from './listing.entity';

describe('Listing', () => {
  it('rattache chaque annonce a une categorie de la table de reference, par la colonne category_id', () => {
    const storage = getMetadataArgsStorage();
    const relation = storage.relations.find((r) => r.target === Listing && r.propertyName === 'category');
    const join = storage.joinColumns.find((j) => j.target === Listing && j.propertyName === 'category');

    expect((relation?.type as () => unknown)()).toBe(Category);
    expect(relation?.options.nullable).toBe(false);
    expect(join?.name).toBe('category_id');
  });

  it('rattache chaque annonce a un lieu de remise de la table de reference, par la colonne handover_place_id', () => {
    const storage = getMetadataArgsStorage();
    const relation = storage.relations.find((r) => r.target === Listing && r.propertyName === 'handoverPlace');
    const join = storage.joinColumns.find((j) => j.target === Listing && j.propertyName === 'handoverPlace');

    expect((relation?.type as () => unknown)()).toBe(HandoverPlace);
    expect(relation?.options.nullable).toBe(false);
    expect(join?.name).toBe('handover_place_id');
  });
});
