import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingPlansSubscriptions1770000000000 implements MigrationInterface {
  name = 'BillingPlansSubscriptions1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        price numeric(10,2) NOT NULL,
        max_users integer NOT NULL,
        max_bots integer NOT NULL,
        max_channels integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT plans_name_unique UNIQUE (name)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
        status text NOT NULL,
        paypal_subscription_id text NULL,
        start_date timestamptz NOT NULL,
        renew_date timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT subscriptions_company_unique UNIQUE (company_id)
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS subscriptions_company_id_idx ON subscriptions(company_id);',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS subscriptions_paypal_subscription_id_idx ON subscriptions(paypal_subscription_id);',
    );

    await queryRunner.query(`
      INSERT INTO plans (name, price, max_users, max_bots, max_channels)
      VALUES ('Starter', 25, 5, 1, 1)
      ON CONFLICT (name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS subscriptions;');
    await queryRunner.query('DROP TABLE IF EXISTS plans;');
  }
}
