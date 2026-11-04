import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ListingCondition, ListingStatus } from './listing.enums';

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

  @Column({ type: 'varchar', length: 30, default: ListingStatus.PENDING_MODERATION })
  status: ListingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
