import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

async function check(payload: unknown) {
  const dto = plainToInstance(CreateListingDto, payload);
  const errors = await validate(dto);
  return { dto, messages: errors.flatMap((e) => Object.values(e.constraints ?? {})) };
}

describe('CreateListingDto', () => {
  const valid = { title: 'Figurine Pyramid Head', description: 'Edition 2019', condition: 'GOOD' };

  it('accepte une annonce valide', async () => {
    const { messages } = await check(valid);

    expect(messages).toEqual([]);
  });

  it('retire les espaces autour du titre et de la description', async () => {
    const { dto, messages } = await check({ ...valid, title: '  Figurine  ', description: '  Edition 2019 ' });

    expect(messages).toEqual([]);
    expect(dto.title).toBe('Figurine');
    expect(dto.description).toBe('Edition 2019');
  });

  it('refuse un titre trop court ou vide apres suppression des espaces', async () => {
    const { messages } = await check({ ...valid, title: '   ' });

    expect(messages).toContain('le titre est obligatoire');
    expect(messages).toContain('le titre doit contenir entre 3 et 100 caractères');
  });

  it('refuse un titre de plus de 100 caracteres', async () => {
    const { messages } = await check({ ...valid, title: 'a'.repeat(101) });

    expect(messages).toEqual(['le titre doit contenir entre 3 et 100 caractères']);
  });

  it('refuse une description de plus de 1000 caracteres', async () => {
    const { messages } = await check({ ...valid, description: 'a'.repeat(1001) });

    expect(messages).toEqual(['la description ne doit pas dépasser 1000 caractères']);
  });

  it('refuse des champs qui ne sont pas des chaines', async () => {
    const { messages } = await check({ ...valid, title: 42, description: true });

    expect(messages).toContain('le titre doit être une chaîne de caractères');
    expect(messages).toContain('la description doit être une chaîne de caractères');
  });

  it('refuse un etat inconnu', async () => {
    const { messages } = await check({ ...valid, condition: 'CASSE' });

    expect(messages).toEqual(["l'état doit valoir NEW, VERY_GOOD, GOOD ou FAIR"]);
  });

  it.each(['NEW', 'VERY_GOOD', 'GOOD', 'FAIR'])('accepte l etat %s', async (condition) => {
    const { messages } = await check({ ...valid, condition });

    expect(messages).toEqual([]);
  });

  describe('type d annonce', () => {
    it.each(['EXCHANGE', 'GIFT'])('accepte %s sans prix', async (kind) => {
      const { messages } = await check({ ...valid, kind });

      expect(messages).toEqual([]);
    });

    it('refuse un type inconnu', async () => {
      const { messages } = await check({ ...valid, kind: 'TROC' });

      expect(messages).toEqual(["le type d'annonce doit valoir EXCHANGE, GIFT ou SALE"]);
    });

    it('accepte une vente avec un prix en centimes envoye en texte (multipart)', async () => {
      const { dto, messages } = await check({ ...valid, kind: 'SALE', priceCents: '4500' });

      expect(messages).toEqual([]);
      expect(dto.priceCents).toBe(4500);
    });

    it.each([
      ['absent', undefined, 'le prix doit être un nombre entier de centimes'],
      ['decimal', '12.5', 'le prix doit être un nombre entier de centimes'],
      ['nul', '0', 'le prix doit être supérieur à zéro'],
      ['trop grand', '1000000', 'le prix ne doit pas dépasser 999999 centimes'],
    ])('refuse une vente dont le prix est %s', async (_label, priceCents, message) => {
      const { messages } = await check({ ...valid, kind: 'SALE', priceCents });

      expect(messages).toContain(message);
    });

    it('ignore le prix pour un echange : il n est pas valide', async () => {
      const { messages } = await check({ ...valid, kind: 'EXCHANGE', priceCents: 'abc' });

      expect(messages).toEqual([]);
    });
  });

  describe('categorie', () => {
    it.each(['FIGURINES', 'FILMS', 'BOOKS', 'POSTERS', 'MUSIC', 'GAMES', 'CLOTHING', 'OTHER'])(
      'accepte la categorie %s',
      async (category) => {
        const { messages } = await check({ ...valid, category });

        expect(messages).toEqual([]);
      },
    );

    it('accepte l absence de categorie : « autres » est appliquee par le service', async () => {
      const { dto, messages } = await check(valid);

      expect(messages).toEqual([]);
      expect(dto.category).toBeUndefined();
    });

    it('traite une categorie vide comme absente (champ multipart)', async () => {
      const { dto, messages } = await check({ ...valid, category: '  ' });

      expect(messages).toEqual([]);
      expect(dto.category).toBeUndefined();
    });

    it('accepte le code d une categorie ajoutee depuis : le format seul est controle, l existence l est par le service', async () => {
      const { messages } = await check({ ...valid, category: 'GOODIES_RARES' });

      expect(messages).toEqual([]);
    });

    it.each(['figurines', 'FIGURINES 2', 'MEUBLES!', '1FILMS', 'A'.repeat(31)])(
      'refuse le code mal forme %s',
      async (category) => {
        const { messages } = await check({ ...valid, category });

        expect(messages).toEqual(['la catégorie doit être un code en majuscules, par exemple FIGURINES']);
      },
    );
  });

  describe('contrepartie et lieu de remise', () => {
    it('retire les espaces de la contrepartie souhaitee', async () => {
      const { dto, messages } = await check({ ...valid, wantedInExchange: '  Un Blu-ray  ' });

      expect(messages).toEqual([]);
      expect(dto.wantedInExchange).toBe('Un Blu-ray');
    });

    it.each(['wantedInExchange', 'handoverPlace'])('traite %s vide comme absent (champ multipart)', async (field) => {
      const { dto, messages } = await check({ ...valid, [field]: '   ' });

      expect(messages).toEqual([]);
      expect(dto[field as 'wantedInExchange' | 'handoverPlace']).toBeUndefined();
    });

    it('refuse une contrepartie de plus de 120 caracteres', async () => {
      const { messages } = await check({ ...valid, wantedInExchange: 'a'.repeat(121) });

      expect(messages).toEqual(['la contrepartie souhaitée ne doit pas dépasser 120 caractères']);
    });

    it('refuse une contrepartie qui n est pas une chaine', async () => {
      const { messages } = await check({ ...valid, wantedInExchange: 42 });

      expect(messages).toContain('la contrepartie souhaitée doit être une chaîne de caractères');
    });

    it.each(['SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE'])(
      'accepte le lieu de remise %s',
      async (handoverPlace) => {
        const { messages } = await check({ ...valid, handoverPlace });

        expect(messages).toEqual([]);
      },
    );

    it('refuse un lieu de remise inconnu', async () => {
      const { messages } = await check({ ...valid, handoverPlace: 'PARIS' });

      expect(messages).toEqual(['le lieu de remise doit être un magasin de la liste ou TO_AGREE']);
    });
  });
});
