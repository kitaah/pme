import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LISTING_SUBMITTED, ListingSubmittedEvent } from './listing-submitted.event';
import { ModerationService } from './moderation.service';

/** Message dont le contenu est definitivement inexploitable : le rejouer ne changerait rien. */
export class InvalidMessageError extends Error {}

/**
 * Consommateur RabbitMQ (acquittement manuel). Trois issues, et une seule envoie en file d'echec :
 *  - succes ou doublon        -> ack : le message disparait de la file ;
 *  - message invalide         -> nack sans remise en file : il part dans `listing.submitted.dlq`,
 *                                car le rejouer donnerait exactement le meme resultat ;
 *  - panne passagere (base indisponible, reseau) -> nack AVEC remise en file : le message
 *    revient et sera traite une fois la panne terminee. C'est ce qui garantit qu'une annonce
 *    deposee n'est jamais perdue (voir README, « Fiabilite »).
 * Si ce service est arrete, les messages restent dans la file et sont traites au redemarrage.
 */
@Controller()
export class ListingSubmittedConsumer {
  private readonly logger = new Logger(ListingSubmittedConsumer.name);

  constructor(private readonly moderation: ModerationService) {}

  @EventPattern(LISTING_SUBMITTED)
  async onListingSubmitted(@Payload() payload: unknown, @Ctx() context: RmqContext): Promise<void> {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      const event = plainToInstance(ListingSubmittedEvent, payload);
      const errors = await validate(event, { whitelist: true, forbidUnknownValues: true });
      if (errors.length > 0) {
        const detail = errors.flatMap((e) => Object.values(e.constraints ?? {})).join(', ');
        throw new InvalidMessageError(`message invalide : ${detail}`);
      }

      const created = await this.moderation.enqueue(event);
      if (created) {
        this.logger.log(
          `Annonce ${event.listingId} recue de ${event.ownerUsername} -> placee dans la file de moderation`,
        );
      }
      channel.ack(message);
    } catch (error) {
      this.reject(channel, message, error);
    }
  }

  /**
   * `requeue` decide du sort du message : false l'envoie en file d'echec, true le remet dans la file.
   * Le nack lui-meme peut echouer (canal deja ferme) : on ne laisse pas cette erreur secondaire
   * remonter, elle masquerait la cause reelle et terminerait en rejet de promesse non gere.
   */
  private reject(
    channel: { nack: (m: unknown, allUpTo: boolean, requeue: boolean) => void },
    message: unknown,
    error: unknown,
  ): void {
    const permanent = error instanceof InvalidMessageError;
    this.logger.error(
      permanent
        ? `Message rejete vers la file des messages en echec : ${String(error)}`
        : `Traitement impossible pour le moment, message remis dans la file : ${String(error)}`,
    );
    try {
      channel.nack(message, false, !permanent);
    } catch (nackError) {
      this.logger.error(`Acquittement negatif impossible (canal ferme ?) : ${String(nackError)}`);
    }
  }
}
