import { PostgresConnectionSettings } from './database.types';

const defaultSettings: PostgresConnectionSettings = {
  host: 'localhost',
  port: 5432,
  database: 'fulltech_bot',
  username: 'postgres',
  password: '',
  ssl: false,
};

function normalizeBoolean(value: string | undefined): boolean | undefined {
  if (value == null) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'require'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disable'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function readSslFromUrl(url: URL): boolean | undefined {
  return normalizeBoolean(url.searchParams.get('sslmode') ?? undefined);
}

export function resolvePostgresConnectionSettings(
  read: (key: string) => string | undefined,
): PostgresConnectionSettings {
  const fallbackHost = read('POSTGRES_HOST') ?? defaultSettings.host;
  const fallbackPort = Number(read('POSTGRES_PORT') ?? defaultSettings.port);
  const fallbackDatabase =
    read('POSTGRES_DATABASE') ?? defaultSettings.database;
  const fallbackUsername = read('POSTGRES_USER') ?? defaultSettings.username;
  const fallbackPassword = read('POSTGRES_PASSWORD') ?? defaultSettings.password;
  const fallbackSsl =
    normalizeBoolean(read('POSTGRES_SSL')) ?? defaultSettings.ssl;

  const connectionString =
    read('DATABASE_URL') ??
    read('POSTGRES_URL') ??
    read('POSTGRES_CONNECTION_STRING');

  if (connectionString == null || connectionString.trim().length === 0) {
    return {
      host: fallbackHost,
      port: fallbackPort,
      database: fallbackDatabase,
      username: fallbackUsername,
      password: fallbackPassword,
      ssl: fallbackSsl,
    };
  }

  try {
    const url = new URL(connectionString);
    const parsedDatabase = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

    return {
      host: url.hostname || fallbackHost,
      port: url.port.length === 0 ? fallbackPort : Number(url.port),
      database: parsedDatabase.length === 0 ? fallbackDatabase : parsedDatabase,
      username: url.username.length === 0
          ? fallbackUsername
          : decodeURIComponent(url.username),
      password: url.password.length === 0
          ? fallbackPassword
          : decodeURIComponent(url.password),
      ssl: readSslFromUrl(url) ?? fallbackSsl,
    };
  } catch (_) {
    return {
      host: fallbackHost,
      port: fallbackPort,
      database: fallbackDatabase,
      username: fallbackUsername,
      password: fallbackPassword,
      ssl: fallbackSsl,
    };
  }
}