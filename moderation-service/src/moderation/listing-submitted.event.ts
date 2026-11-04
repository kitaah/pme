import { IsDateString, IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/** Motif et file : doivent rester identiques a ceux de l'API (api/src/listings/listing-events.ts). */
export const LISTING_SUBMITTED = 'listing.submitted';
export const LISTING_SUBMITTED_QUEUE = 'listing.submitted';
export const LISTING_SUBMITTED_DLQ = 'listing.submitted.dlq';

/** Arguments de declaration de la file : identiques chez le producteur et le consommateur. */
export const LISTING_SUBMITTED_QUEUE_OPTIONS = {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': '',
    'x-dead-letter-routing-key': LISTING_SUBMITTED_DLQ,
  },
};

/**
 * Contrat de l'evenement "annonce soumise". Le message vient d'un autre service : on le valide
 * a la reception, un message mal forme est rejete vers la file des messages en echec.
 */
export class ListingSubmittedEvent {
  @IsUUID() listingId: string;
  @IsUUID() ownerId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) ownerUsername: string;
  @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) description: string;
  @IsIn(['NEW', 'GOOD', 'FAIR']) condition: string;
  @IsDateString() submittedAt: string;
}
