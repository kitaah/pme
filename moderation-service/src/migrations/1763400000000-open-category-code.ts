import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La liste des categories vit desormais dans une table de l'API (categories) et change sans deploiement. Cette
 * file ne garde que le code recu : la contrainte CHECK qui figeait les huit valeurs est retiree, sinon une
 * categorie ajoutee ferait refuser l'element par la base.
 *
 * Il n'y a pas de cle etrangere : les deux services ont chacun leur base, et la file doit continuer a
 * recevoir un message meme si l'API retire ensuite la categorie.
 */
export class OpenCategoryCode1763400000000 implements MigrationInterface {
  name = 'OpenCategoryCode1763400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE moderation_queue DROP CONSTRAINT chk_moderation_category');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Un code ajoute depuis n'existe pas dans la liste figee : ses elements retombent sur « Autres ».
    await queryRunner.query(`
      UPDATE moderation_queue SET category = 'OTHER'
      WHERE category NOT IN ('FIGURINES', 'FILMS', 'BOOKS', 'POSTERS', 'MUSIC', 'GAMES', 'CLOTHING', 'OTHER')
    `);
    await queryRunner.query(`
      ALTER TABLE moderation_queue
        ADD CONSTRAINT chk_moderation_category
        CHECK (category IN ('FIGURINES', 'FILMS', 'BOOKS', 'POSTERS', 'MUSIC', 'GAMES', 'CLOTHING', 'OTHER'))
    `);
  }
}
