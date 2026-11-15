import { getMetadataArgsStorage } from 'typeorm';
import { Category } from './category.entity';
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
});
