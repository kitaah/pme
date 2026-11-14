import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, Listing, api } from '../api';
import { notifyListingSubmitted } from './ConfirmationToast';
import { ListingForm } from './ListingForm';

// Le module d'authentification (keycloak-js) n'a rien a faire dans un test de composant
vi.mock('../auth', () => ({ accessToken: vi.fn().mockResolvedValue('jeton-de-test') }));
vi.mock('./ConfirmationToast', () => ({ notifyListingSubmitted: vi.fn() }));

const created: Listing = {
  id: '1',
  title: 'Figurine',
  description: 'Édition 2019',
  condition: 'GOOD',
  category: 'FIGURINES',
  kind: 'EXCHANGE',
  priceCents: null,
  wantedInExchange: null,
  handoverPlace: 'TO_AGREE',
  photoUrl: null,
  status: 'PENDING_MODERATION',
  createdAt: '2026-11-14T15:00:00.000Z',
};

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ListingForm />} />
        <Route path="/mes-annonces" element={<p>Page des annonces</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const submit = () => userEvent.click(screen.getByRole('button', { name: "Déposer l'annonce" }));

describe('ListingForm', () => {
  const createListing = vi.spyOn(api, 'createListing');

  // jsdom n'implemente pas les adresses temporaires de fichier : l'apercu de la photo en a besoin.
  const createObjectURL = vi.fn(() => 'blob:apercu');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    createListing.mockReset();
    vi.mocked(notifyListingSubmitted).mockReset();
  });

  describe('page', () => {
    it('presente le fil d ariane, le titre, les conseils et le rappel de moderation', () => {
      renderForm();

      expect(screen.getByRole('navigation', { name: "Fil d'ariane" })).toHaveTextContent(
        'Mes annonces › Déposer une annonce',
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Déposer une annonce' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Avant de publier' })).toBeInTheDocument();
      expect(screen.getByText('Aucune donnée personnelle dans la description.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'mes annonces' })).toHaveAttribute('href', '/mes-annonces');
    });

    it('propose les huit categories, les quatre etats et les cinq lieux de remise, a convenir par defaut', () => {
      renderForm();

      expect(screen.getByLabelText('Catégorie')).toHaveValue('FIGURINES');
      expect(screen.getByLabelText('Catégorie').querySelectorAll('option')).toHaveLength(8);
      expect(screen.getByLabelText("État de l'objet")).toHaveValue('GOOD');
      expect(screen.getByLabelText("État de l'objet").querySelectorAll('option')).toHaveLength(4);
      expect(screen.getByLabelText('Lieu de remise')).toHaveValue('TO_AGREE');
      expect(screen.getByLabelText('Lieu de remise').querySelectorAll('option')).toHaveLength(5);
    });
  });

  describe('type d annonce', () => {
    it('propose l echange par defaut, avec la contrepartie souhaitee', () => {
      renderForm();

      expect(screen.getByRole('radio', { name: 'Échange' })).toBeChecked();
      expect(screen.getByLabelText(/Je cherche en échange/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Prix (en euros)')).not.toBeInTheDocument();
    });

    it('affiche le prix pour une vente et masque la contrepartie', async () => {
      renderForm();

      await userEvent.click(screen.getByRole('radio', { name: 'Vente' }));

      expect(screen.getByLabelText('Prix (en euros)')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Je cherche en échange/)).not.toBeInTheDocument();
    });

    it('n affiche ni prix ni contrepartie pour un don, et le dit', async () => {
      renderForm();

      await userEvent.click(screen.getByRole('radio', { name: 'Don' }));

      expect(screen.getByText('Un don est gratuit : aucun prix ni contrepartie à indiquer.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Prix (en euros)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Je cherche en échange/)).not.toBeInTheDocument();
    });
  });

  describe('depot', () => {
    it('envoie un echange, confirme par la notification et redirige vers Mes annonces', async () => {
      createListing.mockResolvedValue(created);
      renderForm();

      await userEvent.type(screen.getByLabelText("Titre de l'annonce"), 'Figurine Pyramid Head');
      await userEvent.type(screen.getByLabelText('Description'), 'Édition 2019');
      await userEvent.type(screen.getByLabelText(/Je cherche en échange/), 'Un Blu-ray');
      await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'FILMS');
      await userEvent.selectOptions(screen.getByLabelText("État de l'objet"), 'FAIR');
      await userEvent.selectOptions(screen.getByLabelText('Lieu de remise'), 'SHOP_LYON');
      await submit();

      expect(await screen.findByText('Page des annonces')).toBeInTheDocument();
      expect(createListing).toHaveBeenCalledWith({
        title: 'Figurine Pyramid Head',
        description: 'Édition 2019',
        condition: 'FAIR',
        category: 'FILMS',
        kind: 'EXCHANGE',
        priceCents: undefined,
        wantedInExchange: 'Un Blu-ray',
        handoverPlace: 'SHOP_LYON',
        photo: undefined,
      });
      expect(notifyListingSubmitted).toHaveBeenCalledTimes(1);
    });

    it('envoie une vente avec son prix en centimes, sans contrepartie meme saisie avant le changement de type', async () => {
      createListing.mockResolvedValue(created);
      renderForm();

      await userEvent.type(screen.getByLabelText(/Je cherche en échange/), 'Un Blu-ray');
      await userEvent.click(screen.getByRole('radio', { name: 'Vente' }));
      await userEvent.type(screen.getByLabelText('Prix (en euros)'), '45,50');
      await submit();

      await waitFor(() => expect(createListing).toHaveBeenCalledTimes(1));
      expect(createListing).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'SALE', priceCents: 4550, wantedInExchange: undefined }),
      );
    });

    it('envoie un don sans prix ni contrepartie', async () => {
      createListing.mockResolvedValue(created);
      renderForm();

      await userEvent.click(screen.getByRole('radio', { name: 'Don' }));
      await submit();

      await waitFor(() => expect(createListing).toHaveBeenCalledTimes(1));
      expect(createListing).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'GIFT', priceCents: undefined, wantedInExchange: undefined }),
      );
    });

    it.each(['', 'abc', '0', '10000'])('refuse une vente au prix « %s » sans interroger l API', async (price) => {
      renderForm();

      await userEvent.click(screen.getByRole('radio', { name: 'Vente' }));
      if (price) await userEvent.type(screen.getByLabelText('Prix (en euros)'), price);
      await submit();

      expect(await screen.findByRole('alert')).toHaveTextContent('Indiquez un prix valide');
      expect(createListing).not.toHaveBeenCalled();
    });

    it('desactive le bouton et annonce l envoi pendant la requete', async () => {
      let finish = vi.fn<(value: Listing) => void>();
      createListing.mockReturnValue(new Promise<Listing>((resolve) => (finish = vi.fn(resolve))));
      renderForm();

      await submit();

      const button = screen.getByRole('button', { name: 'Envoi…' });
      expect(button).toBeDisabled();
      finish(created);
      expect(await screen.findByText('Page des annonces')).toBeInTheDocument();
    });
  });

  describe('erreurs', () => {
    it("affiche les erreurs de validation renvoyees par l'API, conserve la saisie et ne redirige pas", async () => {
      createListing.mockRejectedValue(
        new ApiError(400, 'La requête ne respecte pas le format attendu', ['le titre est obligatoire']),
      );
      renderForm();

      await userEvent.type(screen.getByLabelText('Description'), 'Édition 2019');
      await submit();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('La requête ne respecte pas le format attendu');
      expect(alert).toHaveTextContent('le titre est obligatoire');
      expect(screen.getByLabelText('Description')).toHaveValue('Édition 2019');
      expect(notifyListingSubmitted).not.toHaveBeenCalled();
      expect(screen.queryByText('Page des annonces')).not.toBeInTheDocument();
    });

    it("affiche un message générique quand l'erreur ne vient pas de l'API (réseau coupé)", async () => {
      createListing.mockRejectedValue(new TypeError('Failed to fetch'));
      renderForm();

      await submit();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Une erreur est survenue.');
      expect(alert.querySelector('ul')).toBeNull();
    });

    it("n'affiche pas de liste quand l'API renvoie une erreur sans détail", async () => {
      createListing.mockRejectedValue(new ApiError(503, 'La modération est indisponible'));
      renderForm();

      await submit();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('La modération est indisponible');
      expect(alert.querySelector('ul')).toBeNull();
    });
  });

  describe('photo', () => {
    const png = new File(['contenu'], 'photo.png', { type: 'image/png' });

    it('accepte une photo JPEG, PNG ou WebP et la transmet', async () => {
      createListing.mockResolvedValue(created);
      renderForm();

      await userEvent.upload(screen.getByLabelText(/Photo/), png);
      await submit();

      await waitFor(() => expect(createListing).toHaveBeenCalledTimes(1));
      expect(createListing).toHaveBeenCalledWith(expect.objectContaining({ photo: png }));
    });

    it('affiche un apercu de la photo choisie, puis le retire avec elle', async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderForm();
      const input = screen.getByLabelText(/Photo/);
      expect(screen.queryByRole('img', { name: 'Aperçu de la photo choisie' })).not.toBeInTheDocument();

      await user.upload(input, png);

      expect(screen.getByRole('img', { name: 'Aperçu de la photo choisie' })).toHaveAttribute('src', 'blob:apercu');
      expect(createObjectURL).toHaveBeenCalledWith(png);

      await user.upload(input, new File(['x'], 'notes.pdf', { type: 'application/pdf' }));

      expect(screen.queryByRole('img', { name: 'Aperçu de la photo choisie' })).not.toBeInTheDocument();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:apercu');
    });

    it('refuse un format autre que JPEG, PNG ou WebP, sans l envoyer', async () => {
      createListing.mockResolvedValue(created);
      const user = userEvent.setup({ applyAccept: false });
      renderForm();

      await user.upload(screen.getByLabelText(/Photo/), new File(['x'], 'notes.pdf', { type: 'application/pdf' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Formats acceptés : JPEG, PNG ou WebP.');
      await submit();
      await waitFor(() => expect(createListing).toHaveBeenCalledTimes(1));
      expect(createListing).toHaveBeenCalledWith(expect.objectContaining({ photo: undefined }));
    });

    it('refuse une photo de plus de 5 Mo', async () => {
      renderForm();
      const heavy = new File(['x'], 'grosse.png', { type: 'image/png' });
      Object.defineProperty(heavy, 'size', { value: 5 * 1024 * 1024 + 1 });

      await userEvent.upload(screen.getByLabelText(/Photo/), heavy);

      expect(screen.getByRole('alert')).toHaveTextContent('La photo est trop lourde : 5 Mo au maximum.');
    });

    it('efface l erreur et la photo quand le membre retire sa selection', async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderForm();
      const input = screen.getByLabelText(/Photo/);
      await user.upload(input, new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await user.upload(input, []);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
