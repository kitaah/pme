import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Listing, api } from '../api';
import { MyListings } from './MyListings';

// keycloak-js n'a rien a faire dans un test de composant
vi.mock('../auth', () => ({ accessToken: vi.fn().mockResolvedValue('jeton-de-test') }));

const listing = (id: string, status: Listing['status']): Listing => ({
  id,
  title: `Annonce ${id}`,
  description: 'Description',
  condition: 'GOOD',
  status,
  createdAt: '2026-11-04T10:12:00.000Z',
});

describe('MyListings', () => {
  const myListings = vi.spyOn(api, 'myListings');

  it('affiche le libelle de chaque statut renvoye par l API', async () => {
    // Given : le membre a une annonce dans chacun des trois statuts
    myListings.mockResolvedValue([
      listing('1', 'PENDING_MODERATION'),
      listing('2', 'PUBLISHED'),
      listing('3', 'REJECTED'),
    ]);

    render(<MyListings refreshKey={0} />);

    // Then : les trois statuts sont lisibles, dans leur libelle francais
    expect(await screen.findByText('En attente de modération')).toBeInTheDocument();
    expect(screen.getByText('Publiée')).toBeInTheDocument();
    expect(screen.getByText('Refusée')).toBeInTheDocument();
  });

  it('signale une erreur quand l API est injoignable', async () => {
    // Given : l'API ne repond pas
    myListings.mockRejectedValue(new Error('injoignable'));

    render(<MyListings refreshKey={0} />);

    // Then : le membre est prevenu, sans liste vide silencieuse
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos annonces.');
  });
});
