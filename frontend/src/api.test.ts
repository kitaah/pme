import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, CONDITION_LABELS, KIND_LABELS, NewListing, STATUS_LABELS, formatPrice, toCents } from './api';

vi.mock('./auth', () => ({
  accessToken: vi.fn().mockResolvedValue('jeton-test'),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('api', () => {
  const fetchMock = vi.fn();
  const base: NewListing = {
    title: 'Figurine',
    description: 'Edition 2019',
    condition: 'GOOD',
    category: 'FIGURINES',
    kind: 'EXCHANGE',
    handoverPlace: 'TO_AGREE',
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("depose une annonce en POST multipart avec le jeton d'acces, sans en-tete Content-Type ecrit a la main", async () => {
    const created = { id: '1', title: 'Figurine' };
    fetchMock.mockResolvedValue(jsonResponse(created, 201));

    await expect(api.createListing(base)).resolves.toEqual(created);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/listings');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toEqual({ Authorization: 'Bearer jeton-test' });
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(['title', 'description', 'condition', 'category', 'kind', 'handoverPlace']);
    expect(form.get('category')).toBe('FIGURINES');
    expect(form.get('kind')).toBe('EXCHANGE');
    expect(form.get('handoverPlace')).toBe('TO_AGREE');
  });

  it('n envoie le prix, la contrepartie et la photo que lorsqu ils sont renseignes', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }, 201));
    const photo = new File(['contenu'], 'photo.png', { type: 'image/png' });

    await api.createListing({ ...base, kind: 'SALE', priceCents: 4500, wantedInExchange: 'Un Blu-ray', photo });

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(form.get('priceCents')).toBe('4500');
    expect(form.get('wantedInExchange')).toBe('Un Blu-ray');
    expect(form.get('photo')).toBeInstanceOf(File);
  });

  it('ne reecrit pas un en-tete Content-Type fourni par l appelant pour une requete JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await api.myListings();

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton-test', 'Content-Type': 'application/json' });
  });

  it('liste les categories proposees en GET', async () => {
    const categories = [{ code: 'FILMS', label: 'Films' }];
    fetchMock.mockResolvedValue(jsonResponse(categories));

    await expect(api.listCategories()).resolves.toEqual(categories);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/categories');
    expect(init.method).toBeUndefined();
  });

  it('n envoie pas de categorie quand aucune n est choisie : l API applique « Autres »', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }, 201));

    await api.createListing({ ...base, category: undefined });

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(form.has('category')).toBe(false);
  });

  it('liste les lieux de remise proposes en GET', async () => {
    const places = [{ code: 'SHOP_LYON', label: 'Magasin de Lyon' }];
    fetchMock.mockResolvedValue(jsonResponse(places));

    await expect(api.listHandoverPlaces()).resolves.toEqual(places);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/handover-places');
    expect(init.method).toBeUndefined();
  });

  it('n envoie pas de lieu de remise quand aucun n est choisi : l API applique « a convenir »', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }, 201));

    await api.createListing({ ...base, handoverPlace: undefined });

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(form.has('handoverPlace')).toBe(false);
  });

  it('liste mes annonces en GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: '1' }]));

    await expect(api.myListings()).resolves.toEqual([{ id: '1' }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/listings/mine');
    expect(init.method).toBeUndefined();
  });

  it("transforme une erreur RFC 9457 en ApiError (statut, detail et liste d'erreurs)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Format invalide', errors: ['le titre est obligatoire'] }, 400));

    const error = await api.myListings().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Format invalide', errors: ['le titre est obligatoire'] });
  });

  it("utilise un message par defaut quand la reponse d'erreur n'est pas du JSON", async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await api.myListings().catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, message: 'Erreur 502', errors: [] });
  });

  it.each([
    [413, 'La photo est trop lourde : 5 Mo au maximum.'],
    [415, "Le fichier envoyé n'est pas une image exploitable. Formats acceptés : JPEG, PNG ou WebP."],
  ])('explique l erreur %i renvoyee sans corps JSON (ingress ou limite de taille)', async (status, message) => {
    fetchMock.mockResolvedValue(new Response('', { status }));

    const error = await api.createListing(base).catch((e: unknown) => e);

    expect(error).toMatchObject({ status, message });
  });

  it("n'a aucune erreur de validation par defaut", () => {
    expect(new ApiError(500, 'oups').errors).toEqual([]);
  });
});

describe('libelles', () => {
  it('fournit un libelle francais pour chacun des quatre etats', () => {
    expect(CONDITION_LABELS).toEqual({
      NEW: 'Neuf',
      VERY_GOOD: 'Très bon état',
      GOOD: 'Bon état',
      FAIR: 'Satisfaisant',
    });
  });

  it('fournit un libelle pour chaque type d annonce et statut', () => {
    expect(KIND_LABELS).toEqual({ EXCHANGE: 'Échange', GIFT: 'Don', SALE: 'Vente' });
    expect(Object.keys(STATUS_LABELS)).toEqual(['PENDING_MODERATION', 'PUBLISHED', 'REJECTED']);
    expect(STATUS_LABELS.PUBLISHED).toBe('Publiée');
  });
});

describe('prix', () => {
  it('affiche un prix en euros a partir des centimes', () => {
    expect(formatPrice(4500).replace(/\s/g, ' ')).toBe('45,00 €');
  });

  it.each([
    ['45', 4500],
    ['45,5', 4550],
    ['45.50', 4550],
    ['  12,34 ', 1234],
    ['0,01', 1],
    ['9999,99', 999999],
  ])('convertit « %s » en %i centimes', (input, cents) => {
    expect(toCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '0', '-5', '10000', '1e9'])('refuse « %s » comme prix', (input) => {
    expect(toCents(input)).toBeUndefined();
  });
});
