import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('affiche un bouton avec la variante principale par défaut', () => {
    render(<Button>Envoyer</Button>);
    const button = screen.getByRole('button', { name: 'Envoyer' });
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('applique la variante demandée et laisse la dernière classe passer en priorité', () => {
    render(
      <Button variant="ghost" className="underline-offset-4">
        Quitter
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Quitter' });
    expect(button).toHaveClass('underline', 'underline-offset-4');
    expect(button).not.toHaveClass('bg-primary');
  });

  it('se rend comme un lien avec asChild', () => {
    render(
      <Button asChild>
        <a href="/annonces">Voir les annonces</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Voir les annonces' })).toHaveClass('bg-primary');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
