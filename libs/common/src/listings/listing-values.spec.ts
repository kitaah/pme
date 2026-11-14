import { HandoverPlace, ListingCondition, ListingKind } from './listing-values';

/**
 * Ces valeurs sont des codes ECHANGES entre l'API, le service de moderation et la base : en
 * renommer une casserait les messages deja dans le flux et les lignes deja ecrites.
 */
describe('valeurs partagees d une annonce', () => {
  it('fixe les cinq etats de l objet', () => {
    expect(Object.values(ListingCondition)).toEqual(['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'FOR_PARTS']);
  });

  it('fixe les trois natures d annonce', () => {
    expect(Object.values(ListingKind)).toEqual(['EXCHANGE', 'GIFT', 'SALE']);
  });

  it('fixe les quatre magasins et le lieu a convenir', () => {
    expect(Object.values(HandoverPlace)).toEqual([
      'SHOP_ANGOULEME',
      'SHOP_AIX',
      'SHOP_LYON',
      'SHOP_LONDON',
      'TO_AGREE',
    ]);
  });

  it.each([ListingCondition, ListingKind, HandoverPlace])('utilise le nom de chaque valeur comme code', (values) => {
    Object.entries(values).forEach(([name, code]) => expect(code).toBe(name));
  });
});
