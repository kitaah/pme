import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// La feuille de styles est lue telle quelle : elle reste l'unique source de verite des couleurs.
const THEME = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');

/**
 * Controle automatique des contrastes de la palette.
 *
 * Les jetons sont lus dans src/styles.css : la feuille de styles reste l'unique source de
 * verite, et toute couleur abaissee y fait echouer ces tests.
 *
 * Reference : WCAG 2.1 critere 1.4.3 (texte : 4.5:1, AAA a 7:1) et critere 1.4.11
 * (composants d'interface et indicateurs d'etat : 3:1). RGAA 4 criteres 3.2 et 3.3.
 */

function token(name: string): string {
  const found = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME);
  if (!found) throw new Error(`Jeton --color-${name} introuvable dans styles.css`);
  return found[1];
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** [description, premier plan, arriere-plan] */
type Pair = [string, string, string];

// Chaque association ci-dessous existe reellement dans l'interface.
const TEXT: Pair[] = [
  ['texte courant sur la page', 'ink', 'page'],
  ['texte courant sur une carte', 'ink', 'panel'],
  ['texte saisi dans un champ', 'ink', 'inset'],
  ['texte secondaire sur une carte', 'ink-muted', 'panel'],
  ['texte secondaire sur la page', 'ink-muted', 'page'],
  ['texte secondaire sur fond creuse', 'ink-muted', 'inset'],
  ['texte indicatif des champs', 'ink-faint', 'inset'],
  ["sous-titre de l'en-tete", 'blood', 'panel'],
  ['pastille « publiee »', 'moss', 'panel'],
  ['pastille « en attente »', 'ember', 'panel'],
  ['pastille « refusee »', 'blood', 'panel'],
  ['pastille sur fond creuse', 'ember', 'inset'],
  ['message de confirmation', 'moss', 'panel'],
];

const NON_TEXT: Pair[] = [
  ['bordure de champ sur une carte', 'control', 'panel'],
  ['bordure de champ sur son propre fond', 'control', 'inset'],
  ['bordure de champ au focus', 'blood', 'panel'],
  ['aplat du bouton principal sur une carte', 'blood', 'panel'],
  ['bordure de pastille « publiee »', 'moss', 'panel'],
  ['bordure de pastille « en attente »', 'ember', 'panel'],
  ['anneau de focus sur la page', 'focus', 'page'],
  ['anneau de focus sur une carte', 'focus', 'panel'],
  ['anneau de focus sur un champ', 'focus', 'inset'],
];

describe('Palette : contraste du texte (WCAG 1.4.3, seuil AA 4.5:1)', () => {
  it.each(TEXT)('%s', (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it('le texte blanc du bouton principal reste lisible, au repos comme au survol', () => {
    expect(contrast('#ffffff', token('blood'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', token('blood-dark'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Palette : contraste des composants d'interface (WCAG 1.4.11, seuil 3:1)", () => {
  it.each(NON_TEXT)('%s', (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(3);
  });
});

describe('Palette : lisibilite renforcee du texte courant (WCAG 1.4.3, niveau AAA 7:1)', () => {
  // Le texte lu en continu vise le niveau AAA sur les trois surfaces. L'accent rouge et les
  // libelles de pastilles restent au niveau AA : les porter a 7:1 les deleaverait de leur couleur.
  it.each([
    ['texte courant sur la page', 'ink', 'page'],
    ['texte courant sur une carte', 'ink', 'panel'],
    ['texte secondaire sur une carte', 'ink-muted', 'panel'],
  ] as Pair[])('%s', (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(7);
  });
});
