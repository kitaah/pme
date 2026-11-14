import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { logout } from '../auth';
import { Header } from './Header';

vi.mock('../auth', () => ({
  ROLE_MEMBER: 'membre',
  logout: vi.fn(),
}));

const member = { username: 'membre', displayName: 'Morgane', roles: ['membre'] };

function renderHeader(user = member, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header user={user} />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it('affiche le nom d utilisateur et le role Membre, sans les roles techniques de Keycloak', () => {
    renderHeader({ ...member, roles: ['offline_access', 'membre', 'uma_authorization'] });

    expect(screen.getByText('membre', { selector: 'span.font-semibold' })).toBeInTheDocument();
    expect(screen.getByText('Membre')).toBeInTheDocument();
    expect(screen.queryByText('offline_access')).not.toBeInTheDocument();
    expect(screen.queryByText('uma_authorization')).not.toBeInTheDocument();
  });

  it("n'affiche pas la pastille Membre a un utilisateur qui n'a pas ce role", () => {
    renderHeader({ ...member, roles: ['moderateur'] });

    expect(screen.queryByText('Membre')).not.toBeInTheDocument();
  });

  it("deconnecte l'utilisateur au clic sur le bouton", async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('presente le nom de l enseigne avec son logo', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: "La Petite Maison de l'Épouvante" })).toHaveAttribute('href', '/');
  });

  it('propose la recherche de produit et le panier de facade, sans rien envoyer', () => {
    renderHeader();

    const search = screen.getByRole('search', { name: 'Recherche dans la boutique' });
    expect(screen.getByPlaceholderText('Figurine, Blu-ray, jeu…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer la recherche' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mon panier, 2 articles' })).toBeInTheDocument();
    // la soumission est neutralisee : la page ne se recharge pas
    expect(fireEvent.submit(search)).toBe(false);
  });

  it('presente les six rubriques du menu, dont l espace membre comme rubrique courante', () => {
    renderHeader();

    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(menu).toHaveTextContent('BoutiqueFanzineEvil EdFestivalActualitésEspace membre');
    expect(screen.getByRole('link', { name: 'Evil Ed' })).toHaveAttribute('href', '#evil-ed');
    const current = screen.getByRole('link', { name: 'Espace membre' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('lien-nav-actif');
  });

  it('garde l espace membre comme rubrique courante sur la page des annonces', () => {
    renderHeader(member, '/mes-annonces');

    expect(screen.getByRole('link', { name: 'Espace membre' })).toHaveAttribute('aria-current', 'page');
  });
});
