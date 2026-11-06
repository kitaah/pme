import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bouton du design system (modèle shadcn/ui). Les variantes reprennent les jetons du projet :
 * « default » reproduit la classe .btn (aplat rouge, texte blanc) et « ghost » la classe .btn-ghost.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-wait disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-blood-dark disabled:hover:bg-primary',
        ghost: 'p-1 font-normal text-muted-foreground underline hover:text-foreground',
        outline: 'border border-control bg-card text-foreground hover:bg-secondary',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Applique le style à l'élément enfant (un lien, par exemple) au lieu de créer un <button>. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: Readonly<ButtonProps>) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
