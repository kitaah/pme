import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../api';
import { ListingForm } from './ListingForm';

// Le module d'authentification (keycloak-js) n'a rien a faire dans un test de composant
vi.mock('../auth', () => ({ accessToken: vi.fn().mockResolvedValue('jeton-de-test') }));

describe('ListingForm', () => {
  const createListing = vi.spyOn(api, 'createListing');

  beforeEach(() => {
    createListing.mockReset();
  });

  it("affiche les erreurs de validation renvoyees par l'API et conserve la saisie", async () => {
    // Given : l'API rejette l'annonce (titre vide)
    createListing.mockRejectedValue(
      new ApiError(400, 'La requête ne respecte pas le format attendu', ['le titre est obligatoire']),
    );
    const onSubmitted = vi.fn();
    render(<ListingForm onSubmitted={onSubmitted} />);

    // When : le membre soumet le formulaire
    await userEvent.type(screen.getByLabelText('Description'), 'Édition 2019');
    await userEvent.click(screen.getByRole('button', { name: "Déposer l'annonce" }));

    // Then : le detail de l'erreur est annonce, la saisie est conservee, le parent n'est pas notifie
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('La requête ne respecte pas le format attendu');
    expect(alert).toHaveTextContent('le titre est obligatoire');
    expect(screen.getByLabelText('Description')).toHaveValue('Édition 2019');
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('confirme le depot, vide le formulaire et previent la page parente', async () => {
    // Given : l'API accepte l'annonce
    createListing.mockResolvedValue({
      id: '1',
      title: 'Figurine',
      description: 'Édition 2019',
      condition: 'GOOD',
      status: 'PENDING_MODERATION',
      createdAt: new Date().toISOString(),
    });
    const onSubmitted = vi.fn();
    render(<ListingForm onSubmitted={onSubmitted} />);

    // When
    await userEvent.type(screen.getByLabelText('Titre'), 'Figurine Pyramid Head');
    await userEvent.type(screen.getByLabelText('Description'), 'Édition 2019');
    await userEvent.click(screen.getByRole('button', { name: "Déposer l'annonce" }));

    // Then : l'etat envoye est celui du formulaire, et l'utilisateur voit le statut "en attente"
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(createListing).toHaveBeenCalledWith({
      title: 'Figurine Pyramid Head',
      description: 'Édition 2019',
      condition: 'GOOD',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('en attente de modération');
    expect(screen.getByLabelText('Titre')).toHaveValue('');
  });
});
