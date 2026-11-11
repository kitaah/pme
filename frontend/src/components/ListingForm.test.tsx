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

  it("envoie l'état choisi par le membre", async () => {
    // Given : l'API accepte l'annonce
    createListing.mockResolvedValue({
      id: '2',
      title: 'Disque',
      description: 'Rayé',
      condition: 'FAIR',
      status: 'PENDING_MODERATION',
      createdAt: new Date().toISOString(),
    });
    render(<ListingForm onSubmitted={vi.fn()} />);

    // When : le membre choisit « État correct » avant de déposer
    await userEvent.selectOptions(screen.getByLabelText('État'), 'FAIR');
    await userEvent.click(screen.getByRole('button', { name: "Déposer l'annonce" }));

    // Then : l'état sélectionné est celui envoyé à l'API
    await waitFor(() => expect(createListing).toHaveBeenCalledWith(expect.objectContaining({ condition: 'FAIR' })));
  });

  it("affiche un message générique quand l'erreur ne vient pas de l'API (réseau coupé)", async () => {
    // Given : la requête échoue avant d'atteindre l'API
    createListing.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ListingForm onSubmitted={vi.fn()} />);

    // When
    await userEvent.click(screen.getByRole('button', { name: "Déposer l'annonce" }));

    // Then : message générique, sans liste de détails
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Une erreur est survenue.');
    expect(alert.querySelector('ul')).toBeNull();
  });

  it("n'affiche pas de liste quand l'API renvoie une erreur sans détail", async () => {
    // Given : une erreur HTTP sans liste d'erreurs de validation
    createListing.mockRejectedValue(new ApiError(503, 'La modération est indisponible'));
    render(<ListingForm onSubmitted={vi.fn()} />);

    // When
    await userEvent.click(screen.getByRole('button', { name: "Déposer l'annonce" }));

    // Then
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('La modération est indisponible');
    expect(alert.querySelector('ul')).toBeNull();
  });
});
