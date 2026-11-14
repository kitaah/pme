import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Check, Image as ImageIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import {
  ApiError,
  CATEGORY_LABELS,
  Category,
  CONDITION_LABELS,
  Condition,
  HANDOVER_PLACE_LABELS,
  HandoverPlace,
  KIND_LABELS,
  ListingKind,
  api,
  toCents,
} from '../api';
import { notifyListingSubmitted } from './ConfirmationToast';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 1000;
const WANTED_MAX = 120;

/** Memes limites que l'API (api/src/listings/listings.controller.ts) : le membre est prevenu avant l'envoi. */
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ADVICE = [
  "Photographiez l'objet sur un fond neutre, de face.",
  'Signalez les défauts : une annonce honnête inspire confiance.',
  'Aucune donnée personnelle dans la description.',
];

type Erreur = { text: string; details?: string[] };

/** Message a afficher pour une erreur de l'API, ou un message generique pour tout autre echec. */
function toErreur(error: unknown): Erreur {
  const apiError = error instanceof ApiError ? error : undefined;
  return { text: apiError?.message ?? 'Une erreur est survenue.', details: apiError?.errors };
}

/**
 * Cadre de la photo : apercu de l'image choisie, lu depuis le fichier local (rien n'est envoye avant
 * le depot), ou pictogramme tant qu'aucune photo n'est choisie. L'adresse temporaire est liberee
 * des que la photo change ou que le cadre disparait.
 */
function ApercuPhoto({ photo }: Readonly<{ photo?: File }>) {
  const url = useMemo(() => (photo ? URL.createObjectURL(photo) : undefined), [photo]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return (
    <div className="flex size-[72px] flex-none items-center justify-center overflow-hidden rounded-[10px] border border-line bg-panel text-gold">
      {url ? (
        <img src={url} alt="Aperçu de la photo choisie" className="size-full object-cover" />
      ) : (
        <ImageIcon aria-hidden="true" className="size-[26px]" strokeWidth={1.5} />
      )}
    </div>
  );
}

function Help({ id, children }: Readonly<{ id: string; children: ReactNode }>) {
  return (
    <p className="hint" id={id}>
      {children}
    </p>
  );
}

/**
 * Depot d'une annonce, conforme a la maquette : fil d'ariane, titre, formulaire a gauche, conseils
 * a droite.
 *
 * Le membre choisit le type d'annonce : echange, don ou vente. Seul le champ utile au type choisi
 * est affiche (ce que je cherche pour un echange, le prix pour une vente) et envoye a l'API, qui
 * valide la coherence (prix obligatoire pour une vente, interdit sinon).
 *
 * Il n'y a pas de bouton « Annuler » : le RGAA n'en exige aucun, et un bouton qui perd la saisie
 * sans confirmation est un piege. Le membre quitte la page par le menu ou le fil d'ariane.
 */
export function ListingForm() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<ListingKind>('EXCHANGE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('FIGURINES');
  const [condition, setCondition] = useState<Condition>('GOOD');
  const [wantedInExchange, setWantedInExchange] = useState('');
  const [price, setPrice] = useState('');
  const [handoverPlace, setHandoverPlace] = useState<HandoverPlace>('TO_AGREE');
  const [photo, setPhoto] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<Erreur | null>(null);

  function choisirPhoto(event: ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];
    setErreur(null);
    if (!fichier) {
      setPhoto(undefined);
      return;
    }
    // Deux controles immediats, pour ne pas faire attendre un envoi voue a l'echec. L'API les
    // refait, et c'est elle qui decide : le type annonce par le navigateur n'est pas une preuve.
    if (!PHOTO_TYPES.includes(fichier.type)) {
      setPhoto(undefined);
      setErreur({ text: 'Formats acceptés : JPEG, PNG ou WebP.' });
      return;
    }
    if (fichier.size > PHOTO_MAX_BYTES) {
      setPhoto(undefined);
      setErreur({ text: 'La photo est trop lourde : 5 Mo au maximum.' });
      return;
    }
    setPhoto(fichier);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    const priceCents = kind === 'SALE' ? toCents(price) : undefined;
    if (kind === 'SALE' && priceCents === undefined) {
      setErreur({ text: 'Indiquez un prix valide, supérieur à 0 et inférieur à 10 000 €.' });
      return;
    }
    setBusy(true);
    try {
      await api.createListing({
        title,
        description,
        condition,
        category,
        kind,
        priceCents,
        wantedInExchange: kind === 'EXCHANGE' ? wantedInExchange : undefined,
        handoverPlace,
        photo,
      });
      // La notification survit au changement de page : la zone des notifications est montee a la
      // racine de l'application (main.tsx).
      notifyListingSubmitted();
      void navigate('/mes-annonces');
    } catch (error) {
      setErreur(toErreur(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <nav aria-label="Fil d'ariane" className="mb-[18px] text-[13px] text-ink-faint">
        <Link to="/mes-annonces" className="text-blood-text">
          Mes annonces
        </Link>{' '}
        <span aria-hidden="true">›</span> Déposer une annonce
      </nav>

      <h2 id="form-title" tabIndex={-1} className="mb-2.5 text-[clamp(26px,6vw,36px)] leading-tight">
        Déposer une annonce
      </h2>
      <p className="mb-9 max-w-[620px] text-[15px] leading-[1.7] text-ink-muted">
        Décrivez votre objet et ajoutez une photo. Votre annonce est relue par un modérateur avant d'être visible par
        les autres membres.
      </p>

      <div className="flex flex-wrap items-start gap-8">
        <form
          onSubmit={submit}
          noValidate
          aria-labelledby="form-title"
          className="min-w-0 flex-[999_1_560px] rounded-2xl border border-line bg-panel p-[clamp(20px,4vw,32px)]"
        >
          <fieldset className="mb-[26px]">
            <legend className="mb-[7px] text-sm font-medium text-ink">Type d'annonce</legend>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(KIND_LABELS) as ListingKind[]).map((key) => (
                <label
                  key={key}
                  className={`inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border px-[18px] text-[15px] font-medium ${
                    kind === key ? 'border-gold bg-inset text-gold' : 'border-control bg-inset text-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={key}
                    checked={kind === key}
                    onChange={() => setKind(key)}
                    className="size-[18px] accent-blood"
                  />
                  {KIND_LABELS[key]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mb-[26px] flex flex-wrap gap-x-6 gap-y-5">
            <div className="min-w-0 flex-[1_1_220px]">
              <label className="label mt-0" htmlFor="category">
                Catégorie
              </label>
              <select
                id="category"
                className="field h-12 rounded-[10px] px-3 py-0 text-[15px]"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-[1_1_220px]">
              <label className="label mt-0" htmlFor="condition">
                État de l'objet
              </label>
              <select
                id="condition"
                className="field h-12 rounded-[10px] px-3 py-0 text-[15px]"
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
              >
                {(Object.keys(CONDITION_LABELS) as Condition[]).map((key) => (
                  <option key={key} value={key}>
                    {CONDITION_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="label mt-0" htmlFor="title">
            Titre de l'annonce
          </label>
          <input
            id="title"
            className="field h-12 rounded-[10px] px-3.5 py-0 text-[15px]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            aria-describedby="title-hint"
            placeholder="Figurine Pyramid Head — édition limitée"
          />
          <Help id="title-hint">Entre 3 et {TITLE_MAX} caractères.</Help>

          <label className="label mt-[22px]" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="field resize-y rounded-[10px] px-3.5 py-3 text-[15px] leading-[1.6]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={DESCRIPTION_MAX}
            aria-describedby="description-hint"
            placeholder="Édition, année, défauts éventuels, ce qui est fourni…"
          />
          <Help id="description-hint">{DESCRIPTION_MAX} caractères maximum.</Help>

          {kind === 'EXCHANGE' && (
            <>
              <label className="label mt-[22px]" htmlFor="wanted">
                Je cherche en échange <span className="font-normal text-ink-faint">(facultatif)</span>
              </label>
              <input
                id="wanted"
                className="field h-12 rounded-[10px] px-3.5 py-0 text-[15px]"
                value={wantedInExchange}
                onChange={(e) => setWantedInExchange(e.target.value)}
                maxLength={WANTED_MAX}
                aria-describedby="wanted-hint"
                placeholder="Un Blu-ray de film d'horreur italien"
              />
              <Help id="wanted-hint">
                Décrivez ce que vous aimeriez recevoir en échange. {WANTED_MAX} caractères maximum.
              </Help>
            </>
          )}

          {kind === 'SALE' && (
            <>
              <label className="label mt-[22px]" htmlFor="price">
                Prix (en euros)
              </label>
              <input
                id="price"
                className="field h-12 rounded-[10px] px-3.5 py-0 text-[15px]"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-describedby="price-hint"
                placeholder="45,00"
              />
              <Help id="price-hint">Prix de vente demandé, de 0,01 € à 9 999,99 €.</Help>
            </>
          )}

          {kind === 'GIFT' && (
            <p className="mt-[22px] rounded-[10px] border-l-[3px] border-gold bg-inset p-4 text-[13px] leading-[1.7] text-ink-muted">
              Un don est gratuit : aucun prix ni contrepartie à indiquer.
            </p>
          )}

          <label className="label mt-[26px]" htmlFor="handover">
            Lieu de remise
          </label>
          <select
            id="handover"
            className="field h-12 rounded-[10px] px-3 py-0 text-[15px]"
            value={handoverPlace}
            onChange={(e) => setHandoverPlace(e.target.value as HandoverPlace)}
            aria-describedby="handover-hint"
          >
            {(Object.keys(HANDOVER_PLACE_LABELS) as HandoverPlace[]).map((key) => (
              <option key={key} value={key}>
                {HANDOVER_PLACE_LABELS[key]}
              </option>
            ))}
          </select>
          <Help id="handover-hint">
            Remise dans l'un de nos magasins, ou lieu convenu entre vous. Aucune adresse n'est enregistrée.
          </Help>

          <label className="label mt-[26px]" htmlFor="photo">
            Photo <span className="font-normal text-ink-faint">(facultative)</span>
          </label>
          <div className="mb-[30px] flex flex-wrap items-center gap-[18px] rounded-xl border border-dashed border-control bg-inset p-5">
            <ApercuPhoto photo={photo} />
            <div className="min-w-0 flex-[1_1_260px]">
              <input
                id="photo"
                type="file"
                className="mb-2 block max-w-full text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-1.5 file:text-ink"
                accept={PHOTO_TYPES.join(',')}
                onChange={choisirPhoto}
                aria-describedby="photo-hint"
              />
              <p className="text-[13px] leading-[1.6] text-ink-faint" id="photo-hint">
                JPEG, PNG ou WebP · 5 Mo maximum · une seule photo
              </p>
            </div>
          </div>

          {/* Une erreur interrompt le parcours : role="alert" l'annonce immediatement. */}
          {erreur && (
            <div className="notice mb-6 border-blood bg-blood/10 text-ink" role="alert">
              {erreur.text}
              {(erreur.details?.length ?? 0) > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {erreur.details?.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-[26px]">
            <button type="submit" className="btn mt-0 h-[50px] rounded-[10px] px-[26px] text-base" disabled={busy}>
              {busy ? 'Envoi…' : "Déposer l'annonce"}
            </button>
          </div>
        </form>

        <aside className="min-w-0 flex-[1_1_300px] rounded-2xl border border-line bg-panel p-7">
          <h3 className="mb-[18px] text-xl font-medium text-ink">Avant de publier</h3>
          <ul className="mb-[22px]">
            {ADVICE.map((conseil) => (
              <li key={conseil} className="mb-[15px] flex gap-[11px] text-sm leading-[1.6] text-ink-muted last:mb-0">
                <Check aria-hidden="true" className="mt-0.5 size-[18px] flex-none text-success" strokeWidth={2} />
                <span>{conseil}</span>
              </li>
            ))}
          </ul>
          <div className="border-l-[3px] border-gold bg-inset p-4">
            <p className="text-[13px] leading-[1.7] text-ink-muted">
              Votre annonce est relue par un modérateur avant publication. Vous la retrouvez d'ici là dans{' '}
              <Link to="/mes-annonces" className="text-blood-text">
                mes annonces
              </Link>
              , au statut « En attente de modération ».
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
