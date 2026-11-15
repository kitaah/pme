import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Les categories deviennent une table de reference : `listings.category_id` pointe vers `categories` par cle
 * etrangere, a la place de la colonne `category` (huit valeurs figees par une contrainte CHECK).
 *
 * Pourquoi : la liste est un sujet metier (une rubrique a ajouter, un libelle a corriger). Avec une table, un
 * administrateur la fait evoluer par une simple requete, sans deploiement ; avec une contrainte CHECK, chaque
 * changement demandait une migration et un redeploiement.
 *
 * Reprise : les huit categories existantes sont inserees telles quelles, puis chaque annonce est rattachee a
 * celle que portait sa colonne `category`. Aucune annonce ne change de categorie. L'ordre d'affichage place
 * « Autres » en dernier. `OTHER` est la categorie par defaut du code (DEFAULT_CATEGORY_CODE).
 */
export class CreateCategoriesTable1763400000000 implements MigrationInterface {
  name = 'CreateCategoriesTable1763400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE categories (
        id         SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        code       VARCHAR(30) NOT NULL,
        label      VARCHAR(60) NOT NULL,
        sort_order SMALLINT    NOT NULL,
        active     BOOLEAN     NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_categories_code UNIQUE (code)
      )
    `);
    await queryRunner.query(`
      INSERT INTO categories (code, label, sort_order) VALUES
        ('FIGURINES', 'Figurines et statues', 1),
        ('FILMS', 'Films', 2),
        ('BOOKS', 'Livres et fanzines', 3),
        ('POSTERS', 'Affiches et goodies', 4),
        ('MUSIC', 'Musique', 5),
        ('GAMES', 'Jeux', 6),
        ('CLOTHING', 'Vêtements', 7),
        ('OTHER', 'Autres', 8)
    `);

    await queryRunner.query('ALTER TABLE listings ADD COLUMN category_id SMALLINT');
    await queryRunner.query(
      'UPDATE listings SET category_id = c.id FROM categories c WHERE c.code = listings.category',
    );
    await queryRunner.query('ALTER TABLE listings ALTER COLUMN category_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT fk_listings_category FOREIGN KEY (category_id) REFERENCES categories (id)
    `);
    await queryRunner.query('CREATE INDEX idx_listings_category ON listings (category_id)');

    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_category');
    await queryRunner.query('ALTER TABLE listings DROP COLUMN category');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listings ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'OTHER'`);
    await queryRunner.query(
      'UPDATE listings SET category = c.code FROM categories c WHERE c.id = listings.category_id',
    );
    // Une categorie ajoutee depuis la migration n'existe pas dans la liste figee : ses annonces retombent sur « Autres ».
    await queryRunner.query(`
      UPDATE listings SET category = 'OTHER'
      WHERE category NOT IN ('FIGURINES', 'FILMS', 'BOOKS', 'POSTERS', 'MUSIC', 'GAMES', 'CLOTHING', 'OTHER')
    `);
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_category
        CHECK (category IN ('FIGURINES', 'FILMS', 'BOOKS', 'POSTERS', 'MUSIC', 'GAMES', 'CLOTHING', 'OTHER'))
    `);
    await queryRunner.query('DROP INDEX idx_listings_category');
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT fk_listings_category');
    await queryRunner.query('ALTER TABLE listings DROP COLUMN category_id');
    await queryRunner.query('DROP TABLE categories');
  }
}
