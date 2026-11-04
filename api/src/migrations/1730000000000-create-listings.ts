import { MigrationInterface, QueryRunner } from 'typeorm';

/** Equivalent du V1__create_subscriptions.sql de Flyway : le schema est versionne, jamais synchronise. */
export class CreateListings1730000000000 implements MigrationInterface {
  name = 'CreateListings1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE listings (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id       UUID          NOT NULL,
        owner_username VARCHAR(100)  NOT NULL,
        title          VARCHAR(100)  NOT NULL,
        description    VARCHAR(1000) NOT NULL,
        condition      VARCHAR(20)   NOT NULL,
        status         VARCHAR(30)   NOT NULL DEFAULT 'PENDING_MODERATION',
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT chk_listings_condition CHECK (condition IN ('NEW', 'GOOD', 'FAIR')),
        CONSTRAINT chk_listings_status CHECK (status IN ('PENDING_MODERATION', 'PUBLISHED', 'REJECTED'))
      )
    `);
    await queryRunner.query('CREATE INDEX idx_listings_owner ON listings (owner_id, created_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE listings');
  }
}
