import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  "";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function hasDatabase() {
  return Boolean(databaseUrl);
}

export function getPool() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurado.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 3,
    });
  }

  return pool;
}

export async function ensureSchema() {
  if (!hasDatabase()) {
    return;
  }

  if (!schemaReady) {
    schemaReady = createSchema();
  }

  await schemaReady;
}

async function createSchema() {
  const client = await getPool().connect();

  try {
    await client.query(`
      create table if not exists app_users (
        id text primary key,
        name text not null,
        email text not null unique,
        password_hash text not null,
        password_salt text not null,
        plan text not null,
        created_at timestamptz not null,
        usage jsonb not null,
        reward_credits jsonb not null
      );

      create table if not exists app_sessions (
        token text primary key,
        user_id text not null references app_users(id) on delete cascade,
        created_at timestamptz not null,
        expires_at timestamptz not null
      );

      create table if not exists app_alerts (
        id text primary key,
        user_id text not null references app_users(id) on delete cascade,
        process_number text not null,
        tribunal_label text,
        class_name text,
        subject text,
        site_enabled boolean not null,
        email_enabled boolean not null,
        active boolean not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        unique(user_id, process_number)
      );

      create table if not exists app_notifications (
        id text primary key,
        user_id text not null references app_users(id) on delete cascade,
        alert_id text references app_alerts(id) on delete set null,
        process_number text,
        title text not null,
        message text not null,
        read boolean not null,
        email_status text,
        created_at timestamptz not null
      );

      create index if not exists app_sessions_user_idx on app_sessions(user_id);
      create index if not exists app_alerts_user_idx on app_alerts(user_id);
      create index if not exists app_notifications_user_idx on app_notifications(user_id);
    `);
  } finally {
    client.release();
  }
}

function shouldUseSsl(url: string) {
  return !url.includes("localhost") && !url.includes("127.0.0.1");
}

