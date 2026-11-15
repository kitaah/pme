import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ListingCondition, ListingKind, ListingStatus } from './listing.enums';
import { HandoverPlace } from './handover-place.entity';

@Entity({ name: 'listings' })
@Index('idx_listings_owner', ['ownerId', 'createdAt'])
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `sub` Keycloak du proprietaire : l'API ne stocke aucun compte utilisateur. */
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ name: 'owner_username', type: 'varchar', length: 100 })
  ownerUsername: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 1000 })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  condition: ListingCondition;

  /** Cle etrangere vers la table de reference `categories` (colonne `category_id`). Chargee a la demande (`relations`). */
  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'varchar', length: 20, default: ListingKind.EXCHANGE })
  kind: ListingKind;

  /**
   * Prix en centimes, pour une vente seulement : un entier ne souffre pas des arrondis d'un
   * nombre decimal. Vide pour un echange ou un don (contrainte chk_listings_price).
   */
  @Column({ name: 'price_cents', type: 'integer', nullable: true })
  priceCents: number | null;

  @Column({ name: 'wanted_in_exchange', type: 'varchar', length: 120, nullable: true })
  wantedInExchange: string | null;

  @ManyToOne(() => HandoverPlace, { nullable: false })
  @JoinColumn({ name: 'handover_place_id' })
  handoverPlace: HandoverPlace;

  /**
   * Chemin de la photo dans le stockage objet (`pending/<uuid>.webp`), jamais son contenu : les
   * fichiers sont dans le conteneur « Stockage de fichiers » du C4, pas dans PostgreSQL.
   */
  @Column({ name: 'photo_key', type: 'varchar', length: 200, nullable: true })
  photoKey: string | null;

  /** Type de l'image stockee. L'API ne conserve que du WebP : elle re-encode a l'enregistrement. */
  @Column({ name: 'photo_mime', type: 'varchar', length: 40, nullable: true })
  photoMime: string | null;

  @Column({ type: 'varchar', length: 30, default: ListingStatus.PENDING_MODERATION })
  status: ListingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
