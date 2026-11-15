import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Les lieux de remise deviennent une table de reference : `listings.handover_place_id` pointe vers `handover_places`
 * par cle etrangere, a la place de la colonne `handover_place` (cinq valeurs figees par une contrainte CHECK).
 *
 * Pourquoi : ouvrir ou fermer un magasin est un sujet metier. Avec une table, un administrateur le fait par une
 * requete, sans deploiement ; avec une contrainte CHECK, chaque changement demandait une migration.
 *
 * Reprise : les cinq lieux existants sont inseres tels quels, puis chaque annonce est rattachee a celui que portait sa
 * colonne `handover_place`. Aucune annonce ne change de lieu. `TO_AGREE` est le lieu par defaut du code
 * (DEFAULT_HANDOVER_PLACE_CODE) et reste en dernier dans la liste.
 */
export class CreateHandoverPlacesTable1763500000000 implements MigrationInterface {
  name = 'CreateHandoverPlacesTable1763500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE handover_places (
        id         SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        code       VARCHAR(30) NOT NULL,
        label      VARCHAR(60) NOT NULL,
        sort_order SMALLINT    NOT NULL,
        active     BOOLEAN     NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_handover_places_code UNIQUE (code)
      )
    `);
    await queryRunner.query(`
      INSERT INTO handover_places (code, label, sort_order) VALUES
        ('SHOP_ANGOULEME', 'Magasin d’Angoulême', 1),
        ('SHOP_AIX', 'Magasin d’Aix-en-Provence', 2),
        ('SHOP_LYON', 'Magasin de Lyon', 3),
        ('SHOP_LONDON', 'Magasin de Londres', 4),
        ('TO_AGREE', 'À convenir avec le membre', 5)
    `);

    await queryRunner.query('ALTER TABLE listings ADD COLUMN handover_place_id SMALLINT');
    await queryRunner.query(
      'UPDATE listings SET handover_place_id = h.id FROM handover_places h WHERE h.code = listings.handover_place',
    );
    await queryRunner.query('ALTER TABLE listings ALTER COLUMN handover_place_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT fk_listings_handover_place FOREIGN KEY (handover_place_id) REFERENCES handover_places (id)
    `);
    await queryRunner.query('CREATE INDEX idx_listings_handover_place ON listings (handover_place_id)');

    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_handover_place');
    await queryRunner.query('ALTER TABLE listings DROP COLUMN handover_place');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listings ADD COLUMN handover_place VARCHAR(20) NOT NULL DEFAULT 'TO_AGREE'`);
    await queryRunner.query(
      'UPDATE listings SET handover_place = h.code FROM handover_places h WHERE h.id = listings.handover_place_id',
    );
    // Un lieu ajoute depuis la migration n'existe pas dans la liste figee : ses annonces retombent sur « a convenir ».
    await queryRunner.query(`
      UPDATE listings SET handover_place = 'TO_AGREE'
      WHERE handover_place NOT IN ('SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE')
    `);
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_handover_place
        CHECK (handover_place IN ('SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE'))
    `);
    await queryRunner.query('DROP INDEX idx_listings_handover_place');
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT fk_listings_handover_place');
    await queryRunner.query('ALTER TABLE listings DROP COLUMN handover_place_id');
    await queryRunner.query('DROP TABLE handover_places');
  }
}
