import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grille des etats ramenee a quatre : Neuf, Tres bon etat, Bon etat, Satisfaisant. C'est celle des
 * grandes places de marche, ou le dernier niveau est une usure marquee sur un objet qui fonctionne,
 * pas un objet a reparer.
 *
 * Les annonces deja enregistrees en FOR_PARTS passent en FAIR (libelle « Satisfaisant ») : c'est le
 * niveau le plus proche, et la description de l'annonce precise le defaut. La contrainte est ensuite
 * remplacee, dans cet ordre : la mettre a jour d'abord, sinon la base refuserait les lignes restantes.
 *
 * La migration precedente n'est pas modifiee (une migration deja appliquee ne se rejoue pas).
 */
export class RemoveForPartsCondition1763200000000 implements MigrationInterface {
  name = 'RemoveForPartsCondition1763200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE moderation_queue SET condition = 'FAIR' WHERE condition = 'FOR_PARTS'`);
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_condition');
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_condition
        CHECK (condition IN ('NEW', 'VERY_GOOD', 'GOOD', 'FAIR'))
    `);
  }

  // Les annonces passees de FOR_PARTS a FAIR ne sont pas rouvertes : la donnee d'origine n'est pas conservee.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_condition');
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_condition
        CHECK (condition IN ('NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'FOR_PARTS'))
    `);
  }
}
