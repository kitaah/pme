import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { logout } from '../auth';
import { Header } from './Header';

vi.mock('../auth', () => ({
  ROLE_MEMBER: 'membre',
  logout: vi.fn(),
}));

describe('Header', () => {
  it('affiche le nom et le role Membre, sans les roles techniques de Keycloak', () => {
    // Given : le jeton contient le role metier et les roles techniques du realm
    render(
      <Header
        user={{
          username: 'membre',
          displayName: 'Morgane',
          roles: ['offline_access', 'membre', 'uma_authorization'],
        }}
      />,
    );

    // Then : seuls le nom et le role metier sont visibles
    expect(screen.getByLabelText('Utilisateur connecté')).toHaveTextContent('Morgane');
    expect(screen.getByText('Membre')).toBeInTheDocument();
    expect(screen.queryByText('offline_access')).not.toBeInTheDocument();
    expect(screen.queryByText('uma_authorization')).not.toBeInTheDocument();
  });

  it("deconnecte l'utilisateur au clic sur le bouton", async () => {
    render(<Header user={{ username: 'membre', displayName: 'Morgane', roles: ['membre'] }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
