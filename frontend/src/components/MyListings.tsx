import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, Clock, ImageOff, Plus } from 'lucide-react';
import { Link } from 'react-router';
import {
  CONDITION_LABELS,
  HANDOVER_PLACE_LABELS,
  KIND_LABELS,
  Listing,
  ListingStatus,
  STATUS_LABELS,
  api,
  formatPrice,
} from '../api';

/**
 * Une chaine complete par statut : une classe assemblee a la volee ne serait pas generee par
 * Tailwind. L'icone accompagne la couleur : le statut n'est jamais porte par la seule couleur
 * (RGAA 3.1), et le libelle reste lisible sans elle.
 */
const STATUS_STYLES: Record<ListingStatus, string> = {
  PENDING_MODERATION: 'border-warning text-warning',
  PUBLISHED: 'border-success text-success',
  REJECTED: 'border-blood-text text-blood-text',
};

const STATUS_ICONS: Record<ListingStatus, typeof Clock> = {
  PENDING_MODERATION: Clock,
  PUBLISHED: CircleCheck,
  REJECTED: CircleX,
};

/** « 4 annonces · 1 en attente de modération » : le compte, puis ce qui attend une decision. */
function summary(listings: Listing[]): string {
  const pending = listings.filter((listing) => listing.status === 'PENDING_MODERATION').length;
  const total = `${listings.length} ${listings.length > 1 ? 'annonces' : 'annonce'}`;
  return pending > 0 ? `${total} · ${pending} en attente de modération` : total;
}

/**
 * Annonces du membre, de la plus recente a la plus ancienne, conformes a la maquette : une photo
 * centree dans un cadre de hauteur fixe, le statut, le titre, un extrait, puis le type, l'etat et
 * le lieu de remise.
 *
 * La photo d'une annonce en attente de moderation est affichee a son auteur : il doit pouvoir
 * verifier ce qu'il a envoye sans attendre la decision. Elle est servie par une URL signee de
 * courte duree, fournie par l'API : elle n'est donc pas publique. Elle est affichee en entier
 * (object-contain), jamais recadree ni agrandie : le cadre garde sa taille quelle que soit l'image.
 */
export function MyListings() {
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
  }, []);

  return (
    <section aria-labelledby="mine-title">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-5">
        <h2 id="mine-title" tabIndex={-1} className="text-[clamp(26px,6vw,36px)] leading-tight">
          Mes annonces
        </h2>
        <Link
          to="/"
          className="inline-flex h-12 items-center gap-[9px] rounded-[10px] bg-blood px-[22px] text-[15px] font-semibold text-white no-underline hover:bg-blood-dark"
        >
          <Plus aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          Déposer une annonce
        </Link>
      </div>
      {listings && listings.length > 0 && <p className="mb-8 text-[15px] text-ink-muted">{summary(listings)}</p>}

      {error && (
        <p className="notice border-blood bg-blood/10 text-ink" role="alert">
          Impossible de charger vos annonces.
        </p>
      )}
      {listings?.length === 0 && (
        <p className="mt-6 text-ink-muted">
          Aucune annonce pour le moment. Déposez-en une pour la voir apparaître ici.
        </p>
      )}

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-6">
        {listings?.map((listing) => {
          const StatusIcon = STATUS_ICONS[listing.status];
          return (
            <li
              key={listing.id}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-panel ${
                listing.status === 'PENDING_MODERATION' ? 'border-gold' : 'border-line'
              }`}
            >
              <div className="flex h-[180px] items-center justify-center border-b border-line bg-inset">
                {listing.photoUrl ? (
                  // L'alternative decrit la photo par le titre de l'annonce : elle porte la meme
                  // information, sans repeter le mot « photo » que le lecteur d'ecran annonce deja.
                  <img src={listing.photoUrl} alt={listing.title} className="size-full object-contain" />
                ) : (
                  <ImageOff role="img" aria-label="Aucune photo" className="size-10 text-[#6b5a78]" strokeWidth={1.3} />
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <span className={`pill mb-[13px] gap-[7px] self-start ${STATUS_STYLES[listing.status]}`}>
                  <StatusIcon aria-hidden="true" className="size-[13px]" strokeWidth={2.2} />
                  {STATUS_LABELS[listing.status]}
                </span>

                <h3 className="mb-[9px] text-[19px] leading-[1.35] font-medium text-ink">{listing.title}</h3>

                <p className="mb-[18px] line-clamp-3 flex-1 text-sm leading-[1.6] text-ink-muted">
                  {listing.description}
                  {listing.wantedInExchange && (
                    <>
                      <br />
                      Recherche : <span className="text-ink">{listing.wantedInExchange}</span>
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-[9px] border-t border-line pt-[15px] text-[13px] text-ink-faint">
                  <span className="font-semibold text-gold">
                    {KIND_LABELS[listing.kind]}
                    {listing.priceCents !== null && ` · ${formatPrice(listing.priceCents)}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{CONDITION_LABELS[listing.condition]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{HANDOVER_PLACE_LABELS[listing.handoverPlace]}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
