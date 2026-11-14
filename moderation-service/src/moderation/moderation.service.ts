import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HandoverPlace, ListingCategory, ListingKind } from '@pme/common';
import { Repository } from 'typeorm';
import { ListingSubmittedEvent } from './listing-submitted.event';
import { ModerationItem, ModerationStatus } from './moderation-item.entity';

const UNIQUE_VIOLATION = '23505';

const MAX_PENDING = 100;

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(@InjectRepository(ModerationItem) private readonly repository: Repository<ModerationItem>) {}

  /**
   * Place l'annonce dans la file de moderation.
   * @returns false si l'annonce y etait deja (message rejoue : traitement idempotent).
   */
  async enqueue(event: ListingSubmittedEvent): Promise<boolean> {
    try {
      await this.repository.insert({
        listingId: event.listingId,
        ownerId: event.ownerId,
        ownerUsername: event.ownerUsername,
        title: event.title,
        description: event.description,
        condition: event.condition,
        // Valeurs par defaut d'un message publie avant le depot enrichi (voir ListingSubmittedEvent).
        category: event.category ?? ListingCategory.OTHER,
        kind: event.kind ?? ListingKind.EXCHANGE,
        priceCents: event.priceCents ?? null,
        wantedInExchange: event.wantedInExchange ?? null,
        handoverPlace: event.handoverPlace ?? HandoverPlace.TO_AGREE,
        photoKey: event.photoKey ?? null,
        status: ModerationStatus.PENDING,
        submittedAt: new Date(event.submittedAt),
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        this.logger.warn(`Annonce ${event.listingId} deja presente dans la file : message ignore`);
        return false;
      }
      throw error;
    }
  }

  /**
   * File d'attente, de la plus ancienne a la plus recente, bornee comme la liste des annonces
   * cote API : le front du moderateur interroge cet endpoint toutes les 3 s, il ne doit jamais
   * recevoir la table entiere (apres un test de charge, elle compte des milliers de lignes).
   */
  pending(limit = MAX_PENDING): Promise<ModerationItem[]> {
    return this.repository.find({
      where: { status: ModerationStatus.PENDING },
      order: { receivedAt: 'ASC' },
      take: limit,
    });
  }
}
