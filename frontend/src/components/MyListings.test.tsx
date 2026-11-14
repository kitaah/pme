import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Listing, api } from '../api';
import { MyListings } from './MyListings';

// keycloak-js n'a rien a faire dans un test de composant
vi.mock('../auth', () => ({ accessToken: vi.fn().mockResolvedValue('jeton-de-test') }));

const listing = (id: string, status: Listing['status'], extra: Partial<Listing> = {}): Listing => ({
  id,
  title: `Annonce ${id}`,
  description: 'Description',
  condition: 'GOOD',
  kind: 'EXCHANGE',
  priceCents: null,
  wantedInExchange: null,
  handoverPlace: 'TO_AGREE',
  photoUrl: null,
  status,
  createdAt: '2026-11-04T10:12:00.000Z',
  ...extra,
});

function renderList() {
  return render(
    <MemoryRouter>
      <MyListings />
    </MemoryRouter>,
  );
}

describe('MyListings', () => {
  const myListings = vi.spyOn(api, 'myListings');

  it('affiche le libelle de chaque statut renvoye par l API', async () => {
    myListings.mockResolvedValue([
      listing('1', 'PENDING_MODERATION'),
      listing('2', 'PUBLISHED'),
      listing('3', 'REJECTED'),
    ]);

    renderList();

    expect(await screen.findByText('En attente de modération', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Publiée')).toBeInTheDocument();
    expect(screen.getByText('Refusée')).toBeInTheDocument();
  });

  it('resume le nombre d annonces et celles en attente de moderation', async () => {
    myListings.mockResolvedValue([listing('1', 'PENDING_MODERATION'), listing('2', 'PUBLISHED')]);

    renderList();

    expect(await screen.findByText('2 annonces · 1 en attente de modération')).toBeInTheDocument();
  });

  it('accorde « annonce » au singulier et ne parle pas de moderation quand rien n attend', async () => {
    myListings.mockResolvedValue([listing('1', 'PUBLISHED')]);

    renderList();

    expect(await screen.findByText('1 annonce')).toBeInTheDocument();
  });

  it('met en evidence par un cadre dore les annonces en attente de moderation', async () => {
    myListings.mockResolvedValue([listing('1', 'PENDING_MODERATION'), listing('2', 'PUBLISHED')]);

    renderList();

    const [pending, published] = await screen.findAllByRole('listitem');
    expect(pending).toHaveClass('border-gold');
    expect(published).toHaveClass('border-line');
  });

  it('affiche la photo, centree et entiere, quand l annonce en a une', async () => {
    myListings.mockResolvedValue([listing('1', 'PUBLISHED', { photoUrl: 'https://garage.localhost/signed' })]);

    renderList();

    const photo = await screen.findByRole('img', { name: 'Annonce 1' });
    expect(photo).toHaveAttribute('src', 'https://garage.localhost/signed');
    expect(photo).toHaveClass('object-contain');
  });

  it('affiche un cadre sans photo quand l annonce n en a pas', async () => {
    myListings.mockResolvedValue([listing('1', 'PUBLISHED')]);

    renderList();

    expect(await screen.findByRole('img', { name: 'Aucune photo' })).toBeInTheDocument();
  });

  it('affiche le type, le prix d une vente, l etat et le lieu de remise', async () => {
    myListings.mockResolvedValue([
      listing('1', 'PUBLISHED', { kind: 'SALE', priceCents: 4500, condition: 'NEW', handoverPlace: 'SHOP_LYON' }),
      listing('2', 'PUBLISHED', { kind: 'GIFT', condition: 'FOR_PARTS', handoverPlace: 'SHOP_AIX' }),
    ]);

    renderList();

    const [sale, gift] = await screen.findAllByRole('listitem');
    expect(sale).toHaveTextContent(/Vente · 45,00\s€/);
    expect(sale).toHaveTextContent('Neuf');
    expect(sale).toHaveTextContent('Magasin de Lyon');
    expect(gift).toHaveTextContent('Don');
    expect(gift).not.toHaveTextContent('€');
    expect(gift).toHaveTextContent('Pour pièces');
    expect(gift).toHaveTextContent('Magasin d’Aix-en-Provence');
  });

  it('affiche ce que le membre cherche en echange, quand il l a precise', async () => {
    myListings.mockResolvedValue([listing('1', 'PUBLISHED', { wantedInExchange: 'Un Blu-ray' })]);

    renderList();

    const [card] = await screen.findAllByRole('listitem');
    expect(within(card).getByText('Un Blu-ray')).toBeInTheDocument();
    expect(card).toHaveTextContent('Recherche : Un Blu-ray');
  });

  it('propose de deposer une annonce depuis la liste', async () => {
    myListings.mockResolvedValue([]);

    renderList();

    expect(await screen.findByRole('link', { name: 'Déposer une annonce' })).toHaveAttribute('href', '/');
  });

  it('signale une erreur quand l API est injoignable', async () => {
    myListings.mockRejectedValue(new Error('injoignable'));

    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos annonces.');
  });

  it('invite à déposer une première annonce quand la liste est vide, sans résumé', async () => {
    myListings.mockResolvedValue([]);

    renderList();

    expect(await screen.findByText(/Aucune annonce pour le moment/)).toBeInTheDocument();
    expect(screen.queryByText(/annonce(s)? ·/)).not.toBeInTheDocument();
  });
});
