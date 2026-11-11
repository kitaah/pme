import { useEffect, useState } from 'react';
import { CONDITION_LABELS, Listing, ListingStatus, STATUS_LABELS, api } from '../api';

// Une chaine complete par statut : une classe assemblee a la volee ne serait pas generee par Tailwind.
const STATUS_STYLES: Record<ListingStatus, string> = {
  PENDING_MODERATION: 'border-ember text-ember',
  PUBLISHED: 'border-moss text-moss',
  REJECTED: 'border-blood text-blood',
};

export function MyListings({ refreshKey }: Readonly<{ refreshKey: number }>) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .myListings()
      .then((data) => {
        setListings(data);
        setError(false);
      })
      .catch(() => setError(true));
  }, [refreshKey]);

  return (
    <section className="card" aria-labelledby="mine-title">
      <h2 id="mine-title" className="card-title">
        Mes annonces
      </h2>
      {error && (
        <p className="notice border-blood bg-blood/10" role="alert">
          Impossible de charger vos annonces.
        </p>
      )}
      {listings && listings.length === 0 && <p className="text-sm text-ink-muted">Aucune annonce pour le moment.</p>}
      <ul className="grid gap-3">
        {listings?.map((listing) => (
          <li key={listing.id} className="rounded-md border border-line bg-inset p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <strong>{listing.title}</strong>
              <span className={`pill ${STATUS_STYLES[listing.status]}`}>{STATUS_LABELS[listing.status]}</span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {CONDITION_LABELS[listing.condition]} · {new Date(listing.createdAt).toLocaleString('fr-FR')}
            </p>
            <p className="mt-1">{listing.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
