import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS, Toaster } from './sonner';

vi.mock('sonner', () => ({
  Toaster: (props: { position: string; offset: number; duration: number }) => (
    <div
      data-testid="sonner"
      data-position={props.position}
      data-offset={props.offset}
      data-duration={props.duration}
    />
  ),
}));

describe('Toaster', () => {
  it('place les notifications en haut a droite, decalees de l en-tete', () => {
    render(<Toaster />);

    expect(screen.getByTestId('sonner')).toHaveAttribute('data-position', 'top-right');
    expect(screen.getByTestId('sonner')).toHaveAttribute('data-offset', '24');
  });

  it('les garde huit secondes : assez pour lire, assez court pour ne pas encombrer', () => {
    render(<Toaster />);

    expect(TOAST_DURATION_MS).toBe(8000);
    expect(screen.getByTestId('sonner')).toHaveAttribute('data-duration', '8000');
  });
});
