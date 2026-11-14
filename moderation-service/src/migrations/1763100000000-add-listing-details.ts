import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * File de moderation : memes informations que l'annonce enrichie (type, prix, contrepartie
 * souhaitee, lieu de remise, chemin de la photo), pour que le moderateur decide sur piece.
 *
 * La migration initiale n'est jamais modifiee. La contrainte des etats est posee ici : la table
 * d'origine n'en avait pas sur `condition`, et le service accepte desormais cinq valeurs.
 *
 * Le prix n'a pas de contrainte liee au type, contrairement a la table des annonces : cette file
 * recoit ce que l'evenement porte, y compris un message publie par une version precedente de
 * l'API, sans lui imposer les regles metier du coeur.
 */
export class AddListingDetails1763100000000 implements MigrationInterface {
  name = 'AddListingDetails1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD COLUMN kind               VARCHAR(20)  NOT NULL DEFAULT 'EXCHANGE',
        ADD COLUMN price_cents        INTEGER,
        ADD COLUMN wanted_in_exchange VARCHAR(120),
        ADD COLUMN handover_place     VARCHAR(20)  NOT NULL DEFAULT 'TO_AGREE',
        ADD COLUMN photo_key          VARCHAR(200)
    `);
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_condition
        CHECK (condition IN ('NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'FOR_PARTS'))
    `);
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_kind CHECK (kind IN ('EXCHANGE', 'GIFT', 'SALE'))
    `);
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_handover_place
        CHECK (handover_place IN ('SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_handover_place');
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_kind');
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_condition');
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        DROP COLUMN photo_key,
        DROP COLUMN handover_place,
        DROP COLUMN wanted_in_exchange,
        DROP COLUMN price_cents,
        DROP COLUMN kind
    `);
  }
}
