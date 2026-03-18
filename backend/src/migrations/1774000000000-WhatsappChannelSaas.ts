import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChannelSaas1774000000000 implements MigrationInterface {
  name = 'WhatsappChannelSaas1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_channel_configs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'evolution',
        evolution_server_url text NOT NULL,
        evolution_api_key_encrypted text NOT NULL,
        instance_name text NOT NULL,
        instance_phone text NULL,
        instance_status text NOT NULL DEFAULT 'disconnected',
        webhook_enabled boolean NOT NULL DEFAULT true,
        webhook_url text NULL,
        webhook_by_events boolean NOT NULL DEFAULT false,
        webhook_base64 boolean NOT NULL DEFAULT false,
        webhook_events_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_sync_at timestamptz NULL,
        CONSTRAINT uq_whatsapp_channel_company_provider UNIQUE (company_id, provider)
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_configs_company ON whatsapp_channel_configs(company_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_configs_company_instance ON whatsapp_channel_configs(company_id, instance_name);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_chats (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        channel_config_id uuid NOT NULL REFERENCES whatsapp_channel_configs(id) ON DELETE CASCADE,
        remote_jid text NOT NULL,
        push_name text NULL,
        profile_name text NULL,
        profile_picture_url text NULL,
        last_message_at timestamptz NULL,
        unread_count integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_whatsapp_chats_company_remote UNIQUE (company_id, remote_jid)
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_company ON whatsapp_chats(company_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_channel ON whatsapp_chats(channel_config_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        channel_config_id uuid NOT NULL REFERENCES whatsapp_channel_configs(id) ON DELETE CASCADE,
        chat_id uuid NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
        evolution_message_id text NULL,
        remote_jid text NOT NULL,
        from_me boolean NOT NULL DEFAULT false,
        direction text NOT NULL,
        message_type text NOT NULL DEFAULT 'text',
        text_body text NULL,
        caption text NULL,
        mime_type text NULL,
        media_url text NULL,
        media_storage_path text NULL,
        media_original_name text NULL,
        media_size_bytes bigint NULL,
        thumbnail_url text NULL,
        raw_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'received',
        sent_at timestamptz NULL,
        delivered_at timestamptz NULL,
        read_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company ON whatsapp_messages(company_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_channel ON whatsapp_messages(channel_config_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat ON whatsapp_messages(chat_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_remote ON whatsapp_messages(company_id, remote_jid);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(company_id, created_at DESC);`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_company_evolution_message ON whatsapp_messages(company_id, evolution_message_id) WHERE evolution_message_id IS NOT NULL;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_attachments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        message_id uuid NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
        file_type text NOT NULL,
        mime_type text NULL,
        original_name text NULL,
        storage_path text NOT NULL,
        public_url text NULL,
        size_bytes bigint NULL,
        metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_attachments_company ON whatsapp_attachments(company_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_attachments_message ON whatsapp_attachments(message_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_channel_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        instance_name text NULL,
        direction text NOT NULL,
        event_name text NOT NULL,
        endpoint_called text NULL,
        request_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        response_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        http_status integer NULL,
        success boolean NOT NULL DEFAULT true,
        error_message text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_logs_company ON whatsapp_channel_logs(company_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_logs_company_created ON whatsapp_channel_logs(company_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_logs_instance ON whatsapp_channel_logs(company_id, instance_name);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS whatsapp_channel_logs;');
    await queryRunner.query('DROP TABLE IF EXISTS whatsapp_attachments;');
    await queryRunner.query('DROP TABLE IF EXISTS whatsapp_messages;');
    await queryRunner.query('DROP TABLE IF EXISTS whatsapp_chats;');
    await queryRunner.query('DROP TABLE IF EXISTS whatsapp_channel_configs;');
  }
}