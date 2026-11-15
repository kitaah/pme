import { ListingCondition, ListingKind } from './listing-values';

/**
 * Ces valeurs sont des codes ECHANGES entre l'API, le service de moderation et la base : en
 * renommer une casserait les messages deja dans le flux et les lignes deja ecrites.
 */
describe('valeurs partagees d une annonce', () => {
  it('fixe les quatre etats de l objet', () => {
    expect(Object.values(ListingCondition)).toEqual(['NEW', 'VERY_GOOD', 'GOOD', 'FAIR']);
  });

  it('fixe les trois natures d annonce', () => {
    expect(Object.values(ListingKind)).toEqual(['EXCHANGE', 'GIFT', 'SALE']);
  });

  it.each([ListingCondition, ListingKind])('utilise le nom de chaque valeur comme code', (values) => {
    Object.entries(values).forEach(([name, code]) => expect(code).toBe(name));
  });
});
