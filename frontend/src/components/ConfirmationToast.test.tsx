import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyListingSubmitted } from './ConfirmationToast';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn() } }));

/** Rend la notification telle que sonner la dessinerait, en recuperant le rendu passe a toast.custom. */
function showToast(id: string | number = 'toast-1') {
  notifyListingSubmitted();
  const [renderToast, options] = vi.mocked(toast.custom).mock.calls[0];
  render((renderToast as (id: string | number) => ReactElement)(id));
  return options;
}

describe('notifyListingSubmitted', () => {
  beforeEach(() => {
    vi.mocked(toast.custom).mockReset();
    vi.mocked(toast.dismiss).mockReset();
  });

  it('affiche le message de confirmation et son explication', () => {
    showToast();

    expect(screen.getByText('Annonce soumise pour validation !')).toBeInTheDocument();
    expect(screen.getByText('Un modérateur la relit avant publication.')).toBeInTheDocument();
  });

  it('reste affichee huit secondes', () => {
    expect(showToast()).toEqual({ duration: 8000 });
  });

  it('se ferme au clic sur le bouton de fermeture, qui a un nom accessible', async () => {
    showToast('toast-42');

    await userEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));

    expect(toast.dismiss).toHaveBeenCalledWith('toast-42');
  });

  it('montre le temps restant par une barre', () => {
    const { container } = render(<div />);
    showToast();

    expect(document.querySelector('.toast-progress')).not.toBeNull();
    expect(container).toBeDefined();
  });
});
