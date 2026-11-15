import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La liste des lieux de remise vit desormais dans une table de l'API (handover_places) et change sans deploiement.
 * Cette file ne garde que le code recu : la contrainte CHECK qui figeait les cinq valeurs est retiree, et la colonne
 * passe a 30 caracteres comme le code de la table de l'API.
 *
 * Il n'y a pas de cle etrangere : les deux services ont chacun leur base, et la file doit continuer a recevoir une
 * annonce meme si l'API ferme ensuite un lieu.
 */
export class OpenHandoverPlaceCode1763500000000 implements MigrationInterface {
  name = 'OpenHandoverPlaceCode1763500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_handover_place');
    await queryRunner.query('ALTER TABLE moderation_queue ALTER COLUMN handover_place TYPE VARCHAR(30)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Un code ajoute depuis n'existe pas dans la liste figee : ses elements retombent sur « a convenir ».
    await queryRunner.query(`
      UPDATE moderation_queue SET handover_place = 'TO_AGREE'
      WHERE handover_place NOT IN ('SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE')
    `);
    await queryRunner.query('ALTER TABLE moderation_queue ALTER COLUMN handover_place TYPE VARCHAR(20)');
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_handover_place
        CHECK (handover_place IN ('SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE'))
    `);
  }
}
