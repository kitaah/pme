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

    expect(messages).toEqual(["l'état doit valoir NEW, GOOD ou FAIR"]);
  });
});
