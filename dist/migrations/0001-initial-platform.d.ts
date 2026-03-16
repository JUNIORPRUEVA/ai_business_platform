import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class InitialPlatform0001 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
