import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModerationQueue1730000000000 implements MigrationInterface {
  name = 'CreateModerationQueue1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE moderation_queue (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id     UUID          NOT NULL UNIQUE,
        owner_id       UUID          NOT NULL,
        owner_username VARCHAR(100)  NOT NULL,
        title          VARCHAR(100)  NOT NULL,
        description    VARCHAR(1000) NOT NULL,
        condition      VARCHAR(20)   NOT NULL,
        status         VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
        submitted_at   TIMESTAMPTZ   NOT NULL,
        received_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT chk_moderation_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REFUSED'))
      )
    `);
    await queryRunner.query('CREATE INDEX idx_moderation_status ON moderation_queue (status, received_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE moderation_queue');
  }
}
