export interface PostgresConnectionSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface DatabaseHealthReport {
  driver: 'postgres';
  configured: boolean;
  persistenceMode: 'postgres';
  status: 'configured';
  settings: Omit<PostgresConnectionSettings, 'password'>;
}