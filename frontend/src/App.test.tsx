import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('./components/ListingForm', () => ({
  ListingForm: ({ onSubmitted }: { onSubmitted: () => void }) => (
    <button type="button" onClick={onSubmitted}>
      Déposer
    </button>
  ),
}));

vi.mock('./components/MyListings', () => ({
  MyListings: ({ refreshKey }: { refreshKey: number }) => <p>Rafraîchissements : {refreshKey}</p>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.mocked(currentUser).mockReturnValue({ username: 'membre', displayName: 'Morgane', roles: ['membre'] });
  });

  it('affiche un message d attente pendant la connexion', () => {
    vi.mocked(initAuth).mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByText('Connexion en cours…')).toHaveAttribute('aria-busy', 'true');
  });

  it("affiche l'application une fois l'utilisateur authentifie", async () => {
    vi.mocked(initAuth).mockResolvedValue(true);

    render(<App />);

    expect(await screen.findByText('Bonjour Morgane')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déposer' })).toBeInTheDocument();
    expect(screen.queryByText('Connexion en cours…')).not.toBeInTheDocument();
  });

  it("reste sur l'attente quand Keycloak ne confirme pas l'authentification", async () => {
    vi.mocked(initAuth).mockResolvedValue(false);

    render(<App />);

    await vi.waitFor(() => expect(initAuth).toHaveBeenCalled());
    expect(screen.getByText('Connexion en cours…')).toBeInTheDocument();
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("affiche une alerte quand le serveur d'authentification est injoignable", async () => {
    vi.mocked(initAuth).mockRejectedValue(new Error('timeout'));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent("Impossible de joindre le serveur d'authentification.");
  });

  it('rafraichit la liste des annonces apres un depot', async () => {
    vi.mocked(initAuth).mockResolvedValue(true);
    render(<App />);
    expect(await screen.findByText('Rafraîchissements : 0')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Déposer' }));

    expect(screen.getByText('Rafraîchissements : 1')).toBeInTheDocument();
  });
});
