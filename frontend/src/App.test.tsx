import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { currentUser, initAuth } from './auth';

vi.mock('./auth', () => ({
  initAuth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('./components/Header', () => ({
  Header: ({ user }: { user: { displayName: string } }) => <header>Bonjour {user.displayName}</header>,
}));

vi.mock('./components/Footer', () => ({ Footer: () => <footer>Pied de page</footer> }));
vi.mock('./components/ListingForm', () => ({ ListingForm: () => <p>Page de dépôt</p> }));
vi.mock('./components/MyListings', () => ({ MyListings: () => <p>Page des annonces</p> }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(currentUser).mockReturnValue({ username: 'membre', displayName: 'Morgane', roles: ['membre'] });
  });

  it('affiche un message d attente pendant la connexion', () => {
    vi.mocked(initAuth).mockReturnValue(new Promise(() => undefined));

    renderAt('/');

    expect(screen.getByText('Connexion en cours…')).toHaveAttribute('aria-busy', 'true');
  });

  it("affiche l'en-tete, le pied de page et le depot une fois l'utilisateur authentifie", async () => {
    vi.mocked(initAuth).mockResolvedValue(true);

    renderAt('/');

    expect(await screen.findByText('Bonjour Morgane')).toBeInTheDocument();
    expect(screen.getByText('Page de dépôt')).toBeInTheDocument();
    expect(screen.getByText('Pied de page')).toBeInTheDocument();
    expect(screen.queryByText('Connexion en cours…')).not.toBeInTheDocument();
  });

  it('affiche la liste des annonces sur /mes-annonces', async () => {
    vi.mocked(initAuth).mockResolvedValue(true);

    renderAt('/mes-annonces');

    expect(await screen.findByText('Page des annonces')).toBeInTheDocument();
    expect(screen.queryByText('Page de dépôt')).not.toBeInTheDocument();
  });

  it('renvoie toute adresse inconnue vers le depot', async () => {
    vi.mocked(initAuth).mockResolvedValue(true);

    renderAt('/une-page-qui-n-existe-pas');

    expect(await screen.findByText('Page de dépôt')).toBeInTheDocument();
  });

  it("reste sur l'attente quand Keycloak ne confirme pas l'authentification", async () => {
    vi.mocked(initAuth).mockResolvedValue(false);

    renderAt('/');

    await vi.waitFor(() => expect(initAuth).toHaveBeenCalled());
    expect(screen.getByText('Connexion en cours…')).toBeInTheDocument();
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("affiche une alerte quand le serveur d'authentification est injoignable", async () => {
    vi.mocked(initAuth).mockRejectedValue(new Error('timeout'));

    renderAt('/');

    expect(await screen.findByRole('alert')).toHaveTextContent("Impossible de joindre le serveur d'authentification.");
  });
});
