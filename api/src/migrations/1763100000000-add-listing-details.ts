import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Depot d'annonce enrichi : type d'annonce, prix, contrepartie souhaitee, lieu de remise et photo.
 *
 * La migration initiale n'est jamais modifiee (une migration deja appliquee ne se rejoue pas) :
 * les colonnes sont ajoutees ici, et la contrainte des etats est remplacee pour accepter les cinq
 * valeurs. NEW, GOOD et FAIR etaient deja acceptees : les annonces existantes restent valides.
 *
 * Les colonnes ajoutees sont toutes acceptees vides (NULL) ou portent une valeur par defaut :
 * les lignes deja en base n'ont donc rien a reprendre.
 */
export class AddListingDetails1763100000000 implements MigrationInterface {
  name = 'AddListingDetails1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listings
        ADD COLUMN kind               VARCHAR(20)  NOT NULL DEFAULT 'EXCHANGE',
        ADD COLUMN price_cents        INTEGER,
        ADD COLUMN wanted_in_exchange VARCHAR(120),
        ADD COLUMN handover_place     VARCHAR(20)  NOT NULL DEFAULT 'TO_AGREE',
        ADD COLUMN photo_key          VARCHAR(200),
        ADD COLUMN photo_mime         VARCHAR(40)
    `);

    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_condition');
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_condition
        CHECK (condition IN ('NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'FOR_PARTS'))
    `);

    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_kind CHECK (kind IN ('EXCHANGE', 'GIFT', 'SALE'))
    `);
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_handover_place
        CHECK (handover_place IN ('SHOP_ANGOULEME', 'SHOP_AIX', 'SHOP_LYON', 'SHOP_LONDON', 'TO_AGREE'))
    `);

    // Le prix n'a de sens que pour une vente, et il lui est alors obligatoire : la regle est tenue
    // par la base, pas seulement par la validation de l'API.
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_price CHECK (
          (kind = 'SALE' AND price_cents IS NOT NULL AND price_cents > 0)
          OR (kind <> 'SALE' AND price_cents IS NULL)
        )
    `);

    // Une photo enregistree porte toujours son type : les deux colonnes vont de pair.
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_photo CHECK (
          (photo_key IS NULL AND photo_mime IS NULL) OR (photo_key IS NOT NULL AND photo_mime IS NOT NULL)
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_photo');
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_price');
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_handover_place');
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_kind');
    await queryRunner.query('ALTER TABLE listings DROP CONSTRAINT chk_listings_condition');
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT chk_listings_condition CHECK (condition IN ('NEW', 'GOOD', 'FAIR'))
    `);
    await queryRunner.query(`
      ALTER TABLE listings
        DROP COLUMN photo_mime,
        DROP COLUMN photo_key,
        DROP COLUMN handover_place,
        DROP COLUMN wanted_in_exchange,
        DROP COLUMN price_cents,
        DROP COLUMN kind
    `);
  }
}
