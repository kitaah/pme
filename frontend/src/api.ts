import { accessToken } from './auth';

export type Condition = 'NEW' | 'GOOD' | 'FAIR';
export type ListingStatus = 'PENDING_MODERATION' | 'PUBLISHED' | 'REJECTED';

export interface Listing {
  id: string;
  title: string;
  description: string;
  condition: Condition;
  status: ListingStatus;
  createdAt: string;
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

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await accessToken()}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(response.status, problem.detail ?? `Erreur ${response.status}`, problem.errors ?? []);
  }
  return response.json() as Promise<T>;
}

export const api = {
  createListing: (body: { title: string; description: string; condition: Condition }) =>
    call<Listing>('/api/v1/listings', { method: 'POST', body: JSON.stringify(body) }),
  myListings: () => call<Listing[]>('/api/v1/listings/mine'),
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Neuf',
  GOOD: 'Bon état',
  FAIR: 'État correct',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  PENDING_MODERATION: 'En attente de modération',
  PUBLISHED: 'Publiée',
  REJECTED: 'Refusée',
};
