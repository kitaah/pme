import { HandoverPlace, ListingCategory, ListingCondition, ListingKind } from '@pme/common';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/** Sujets : doivent rester identiques a ceux de l'API (api/src/listings/listing-events.ts). */
export const LISTING_SUBMITTED_SUBJECT = 'listing.submitted';
export const LISTING_SUBMITTED_DLQ_SUBJECT = 'listing.submitted.dlq';

/**
 * Flux JetStream (l'equivalent durable d'une file RabbitMQ) et consommateur durable.
 * `LISTINGS` conserve les annonces soumises jusqu'a leur traitement ; `LISTINGS_DLQ` garde les
 * messages definitivement inexploitables, pour inspection. Declares par nats-topology.ts.
 */
export const LISTINGS_STREAM = 'LISTINGS';
export const LISTINGS_DLQ_STREAM = 'LISTINGS_DLQ';
export const MODERATION_CONSUMER = 'moderation';

/** En-tete ajoute au message depose dans le flux des messages en echec. */
export const DEAD_LETTER_REASON_HEADER = 'x-dead-letter-reason';

/**
 * Contrat de l'evenement "annonce soumise". Le message vient d'un autre service : on le valide
 * a la reception, un message mal forme est rejete vers le flux des messages en echec.
 */
export class ListingSubmittedEvent {
  @IsUUID() listingId: string;
  @IsUUID() ownerId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) ownerUsername: string;
  @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) description: string;
  @IsEnum(ListingCondition) condition: string;

  /**
   * Champs ajoutes avec le depot enrichi, tous facultatifs : pendant un deploiement progressif,
   * un pod de l'API encore a l'ancienne version publie un message sans eux. Les refuser
   * enverrait ces messages vers le flux des messages en echec alors qu'ils sont exploitables ;
   * les valeurs par defaut sont appliquees a la mise en file.
   */
  @IsOptional() @IsEnum(ListingCategory) category?: string;
  @IsOptional() @IsEnum(ListingKind) kind?: string;
  @IsOptional() @IsInt() @Min(1) priceCents?: number;
  @IsOptional() @IsString() @MaxLength(120) wantedInExchange?: string;
  @IsOptional() @IsEnum(HandoverPlace) handoverPlace?: string;
  /** Chemin de la photo dans le stockage objet : le service de moderation ne la lit pas dans le POC. */
  @IsOptional() @IsString() @MaxLength(200) photoKey?: string;

  @IsDateString() submittedAt: string;
}
