import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer';

describe('Footer', () => {
  it('presente les quatre colonnes de rubriques', () => {
    render(<Footer />);

    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Boutique', 'Le fanzine', 'Evil Ed', "L'entreprise"]);
    expect(screen.getByRole('link', { name: 'Films, DVD et Blu-ray' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Soutenir une production' })).toBeInTheDocument();
  });

  it('rappelle la signature de l enseigne et l hebergement en Europe', () => {
    render(<Footer />);

    expect(screen.getByText('Le lieu de rêve pour frissonner')).toBeInTheDocument();
    expect(screen.getByText(/Données hébergées en Europe/)).toBeInTheDocument();
  });

  it('affiche les mentions obligatoires, dont le niveau d accessibilite', () => {
    render(<Footer />);

    const legal = screen.getByRole('navigation', { name: 'Liens réglementaires' });
    expect(
      within(legal)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      'Mentions légales',
      'Conditions générales de vente',
      'Données personnelles',
      'Cookies',
      'Accessibilité : partiellement conforme',
    ]);
  });

  it('indique l annee courante dans le copyright', () => {
    render(<Footer />);

    expect(screen.getByText(`© ${new Date().getFullYear()} La Petite Maison de l'Épouvante`)).toBeInTheDocument();
  });
});
