import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, CONDITION_LABELS, STATUS_LABELS } from './api';

vi.mock('./auth', () => ({
  accessToken: vi.fn().mockResolvedValue('jeton-test'),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("depose une annonce en POST avec le jeton d'acces", async () => {
    const created = { id: '1', title: 'Figurine' };
    fetchMock.mockResolvedValue(jsonResponse(created, 201));
    const body = { title: 'Figurine', description: 'Edition 2019', condition: 'GOOD' as const };

    await expect(api.createListing(body)).resolves.toEqual(created);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/listings');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(body));
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton-test', 'Content-Type': 'application/json' });
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

  it("n'a aucune erreur de validation par defaut", () => {
    expect(new ApiError(500, 'oups').errors).toEqual([]);
  });

  it('fournit un libelle francais pour chaque etat et chaque statut', () => {
    expect(CONDITION_LABELS).toEqual({ NEW: 'Neuf', GOOD: 'Bon état', FAIR: 'État correct' });
    expect(Object.keys(STATUS_LABELS)).toEqual(['PENDING_MODERATION', 'PUBLISHED', 'REJECTED']);
    expect(STATUS_LABELS.PUBLISHED).toBe('Publiée');
  });
});
