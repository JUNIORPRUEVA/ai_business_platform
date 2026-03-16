import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAvatarKey1711300000000 implements MigrationInterface {
  name = 'UserAvatarKey1711300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_key" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_key"`,
    );
  }
}