import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorie de l'objet : huit valeurs fermees, validees par la base comme par l'API.
 *
 * Les annonces deja en base recoivent OTHER (« Autres ») : la colonne est NOT NULL avec cette valeur
 * par defaut, donc aucune ligne n'est a reprendre et une ancienne version de l'API, qui n'envoie pas
 * de categorie, continue de pouvoir enregistrer pendant un deploiement progressif.
 */
export class AddListingCategory1763300000000 implements MigrationInterface {
  name = 'AddListingCategory1763300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listings ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'OTHER'`);
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_category
        CHECK (category IN ('FIGURINES', 'FILMS', 'BOOKS', 'POSTERS', 'MUSIC', 'GAMES', 'CLOTHING', 'OTHER'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_category');
    await queryRunner.query('ALTER TABLE listings DROP COLUMN category');
  }
}
