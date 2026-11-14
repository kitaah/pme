import { accessToken } from './auth';

export type Condition = 'NEW' | 'VERY_GOOD' | 'GOOD' | 'FAIR' | 'FOR_PARTS';
export type ListingKind = 'EXCHANGE' | 'GIFT' | 'SALE';
export type HandoverPlace = 'SHOP_ANGOULEME' | 'SHOP_AIX' | 'SHOP_LYON' | 'SHOP_LONDON' | 'TO_AGREE';
export type ListingStatus = 'PENDING_MODERATION' | 'PUBLISHED' | 'REJECTED';

export interface Listing {
  id: string;
  title: string;
  description: string;
  condition: Condition;
  kind: ListingKind;
  /** Centimes, pour une vente seulement. */
  priceCents: number | null;
  wantedInExchange: string | null;
  handoverPlace: HandoverPlace;
  /** URL signee de courte duree, ou null si l'annonce n'a pas de photo. */
  photoUrl: string | null;
  status: ListingStatus;
  createdAt: string;
}

/**
 * Champs du formulaire de depot. Le membre choisit echange, don ou vente ; le prix (en centimes)
 * n'est envoye que pour une vente, et « ce que je cherche » que pour un echange.
 */
export interface NewListing {
  title: string;
  description: string;
  condition: Condition;
  kind: ListingKind;
  priceCents?: number;
  wantedInExchange?: string;
  handoverPlace: HandoverPlace;
  photo?: File;
}

/** Erreur RFC 9457 renvoyee par l'API. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: string[] = [],
  ) {
    super(message);
  }
}

/**
 * Messages des erreurs que l'API renvoie sans detail exploitable par le membre, ou que l'ingress
 * renvoie lui-meme (sans corps JSON) : la reponse brute ne dirait pas quoi corriger.
 */
const FALLBACK_MESSAGES: Record<number, string> = {
  413: 'La photo est trop lourde : 5 Mo au maximum.',
  415: "Le fichier envoyé n'est pas une image exploitable. Formats acceptés : JPEG, PNG ou WebP.",
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  // Un envoi multipart (la photo) ne doit PAS porter d'en-tete Content-Type ecrit a la main :
  // le navigateur l'ajoute lui-meme, avec la frontiere qui separe les parties du corps.
  if (!(init.body instanceof FormData)) headers['Content-Type'] ??= 'application/json';

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    const message = problem.detail ?? FALLBACK_MESSAGES[response.status] ?? `Erreur ${response.status}`;
    throw new ApiError(response.status, message, problem.errors ?? []);
  }
  return response.json() as Promise<T>;
}

/** Les champs non renseignes ne sont pas envoyes : l'API les traiterait comme des chaines vides. */
function toFormData(input: NewListing): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description);
  form.append('condition', input.condition);
  form.append('kind', input.kind);
  if (input.priceCents !== undefined) form.append('priceCents', String(input.priceCents));
  form.append('handoverPlace', input.handoverPlace);
  if (input.wantedInExchange) form.append('wantedInExchange', input.wantedInExchange);
  if (input.photo) form.append('photo', input.photo);
  return form;
}

export const api = {
  createListing: (input: NewListing) => call<Listing>('/api/v1/listings', { method: 'POST', body: toFormData(input) }),
  myListings: () => call<Listing[]>('/api/v1/listings/mine'),
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Neuf',
  VERY_GOOD: 'Très bon état',
  GOOD: 'Bon état',
  FAIR: 'État correct',
  FOR_PARTS: 'Pour pièces',
};

export const KIND_LABELS: Record<ListingKind, string> = {
  EXCHANGE: 'Échange',
  GIFT: 'Don',
  SALE: 'Vente',
};

export const HANDOVER_PLACE_LABELS: Record<HandoverPlace, string> = {
  SHOP_ANGOULEME: 'Magasin d’Angoulême',
  SHOP_AIX: 'Magasin d’Aix-en-Provence',
  SHOP_LYON: 'Magasin de Lyon',
  SHOP_LONDON: 'Magasin de Londres',
  TO_AGREE: 'À convenir avec le membre',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  PENDING_MODERATION: 'En attente de modération',
  PUBLISHED: 'Publiée',
  REJECTED: 'Refusée',
};

/** Prix affiche : les centimes evitent les arrondis, la mise en forme revient a l'interface. */
export function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/** Prix maximal accepte par l'API : 9 999,99 EUR. */
const PRICE_MAX_CENTS = 999_999;

/** Convertit « 45 », « 45,5 » ou « 45.50 » en centimes ; undefined si la saisie n'est pas un prix valide. */
export function toCents(input: string): number | undefined {
  const value = Number(input.trim().replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const cents = Math.round(value * 100);
  return cents <= PRICE_MAX_CENTS ? cents : undefined;
}
