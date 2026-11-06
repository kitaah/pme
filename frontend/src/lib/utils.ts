import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Assemble des classes conditionnelles et résout les conflits Tailwind (la dernière classe l'emporte). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
