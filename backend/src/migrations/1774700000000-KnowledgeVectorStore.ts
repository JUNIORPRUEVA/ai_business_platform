import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeVectorStore1774700000000 implements MigrationInterface {
  name = 'KnowledgeVectorStore1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        bot_id uuid NULL,
        document_id uuid NOT NULL,
        chunk_index integer NOT NULL,
        content text NOT NULL,
        token_count integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'ready',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        embedding vector(1536) NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_company_id
      ON knowledge_document_chunks(company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_bot_id
      ON knowledge_document_chunks(company_id, bot_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_document_id
      ON knowledge_document_chunks(company_id, document_id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_document_chunks_document_chunk
      ON knowledge_document_chunks(document_id, chunk_index);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_embedding
      ON knowledge_document_chunks
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS knowledge_document_chunks;');
  }
}
