import { ListingKind } from '@pme/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Categorie par defaut d'un message qui n'en porte pas (ancienne version de l'API). Meme code que dans la base de l'API. */
export const DEFAULT_CATEGORY_CODE = 'OTHER';

/** Lieu de remise par defaut d'un message qui n'en porte pas (ancienne version de l'API). Meme code que dans la base de l'API. */
export const DEFAULT_HANDOVER_PLACE_CODE = 'TO_AGREE';

export enum ModerationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REFUSED = 'REFUSED',
}

/** Une ligne de la file de moderation. `listing_id` est unique : un meme message rejoue ne cree rien. */
@Entity({ name: 'moderation_queue' })
export class ModerationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'listing_id', type: 'uuid', unique: true })
  listingId: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ name: 'owner_username', type: 'varchar', length: 100 })
  ownerUsername: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 1000 })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  condition: string;

  /** Code de la categorie, recopie de l'evenement : la table des categories est dans la base de l'API, pas ici. */
  @Column({ type: 'varchar', length: 30, default: DEFAULT_CATEGORY_CODE })
  category: string;

  @Column({ type: 'varchar', length: 20, default: ListingKind.EXCHANGE })
  kind: string;

  /** Centimes, pour une vente seulement. */
  @Column({ name: 'price_cents', type: 'integer', nullable: true })
  priceCents: number | null;

  @Column({ name: 'wanted_in_exchange', type: 'varchar', length: 120, nullable: true })
  wantedInExchange: string | null;

  /** Code du lieu de remise, recopie de l'evenement : la table des lieux est dans la base de l'API, pas ici. */
  @Column({ name: 'handover_place', type: 'varchar', length: 30, default: DEFAULT_HANDOVER_PLACE_CODE })
  handoverPlace: string;

  /** Chemin de la photo dans le stockage objet, jamais le fichier : le moderateur la lira plus tard. */
  @Column({ name: 'photo_key', type: 'varchar', length: 200, nullable: true })
  photoKey: string | null;

  @Column({ type: 'varchar', length: 20, default: ModerationStatus.PENDING })
  status: ModerationStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}
