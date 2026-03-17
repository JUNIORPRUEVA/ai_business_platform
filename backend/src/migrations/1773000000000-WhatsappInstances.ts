import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappInstances1773000000000 implements MigrationInterface {
  name = 'WhatsappInstances1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_instances (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        instance_name text NOT NULL,
        evolution_url text NULL,
        evolution_api_key text NULL,
        status text NOT NULL DEFAULT 'created',
        qr_code text NULL,
        phone_number text NULL,
        session_data jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_id
      ON whatsapp_instances(tenant_id);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name
      ON whatsapp_instances(instance_name);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_instance
      ON whatsapp_instances(tenant_id, instance_name);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS whatsapp_instances;');
  }
}
