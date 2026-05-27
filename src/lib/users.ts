import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { ensureSchema, getPool, hasDatabase } from "@/lib/db";
import { getPlan, PlanId, UsageFeature } from "@/lib/plans";

type UsageCounters = Record<UsageFeature, number>;
export type RewardFeature = "aiExplanations" | "monitoring";
type RewardCredits = Record<RewardFeature, number>;

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  plan: PlanId;
  createdAt: string;
  usage: UsageCounters & { date: string };
  rewardCredits?: RewardCredits;
};

type SessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type AuthStore = {
  users: UserRecord[];
  sessions: SessionRecord[];
};

type DbUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  plan: PlanId;
  created_at: Date | string;
  usage: UserRecord["usage"];
  reward_credits: RewardCredits;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  plan: PlanId;
  usage: UserRecord["usage"];
  rewardCredits: RewardCredits;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "auth-store.json");
const sessionDays = 30;

const emptyUsage = (date = todayKey()) => ({
  date,
  searches: 0,
  pjeDetails: 0,
  aiExplanations: 0,
});

const emptyRewardCredits = () => ({
  aiExplanations: 0,
  monitoring: 0,
});

export async function createUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  if (hasDatabase()) {
    return createUserDb({ name, email, password });
  }

  const store = await readStore();
  const normalizedEmail = normalizeEmail(email);

  if (store.users.some((user) => user.email === normalizedEmail)) {
    throw new Error("Este e-mail já está cadastrado.");
  }

  const salt = randomBytes(16).toString("hex");
  const user: UserRecord = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password, salt),
    passwordSalt: salt,
    plan: "free",
    createdAt: new Date().toISOString(),
    usage: emptyUsage(),
    rewardCredits: emptyRewardCredits(),
  };

  store.users.push(user);
  await writeStore(store);

  return toPublicUser(user);
}

export async function verifyUserCredentials(email: string, password: string) {
  if (hasDatabase()) {
    return verifyUserCredentialsDb(email, password);
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === normalizeEmail(email));

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return toPublicUser(user);
}

export async function createSession(userId: string) {
  if (hasDatabase()) {
    return createSessionDb(userId);
  }

  const store = await readStore();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 24 * 60 * 60 * 1000);
  const session: SessionRecord = {
    token: randomBytes(32).toString("hex"),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  store.sessions = store.sessions.filter((item) => new Date(item.expiresAt).getTime() > now.getTime());
  store.sessions.push(session);
  await writeStore(store);

  return session;
}

export async function getUserBySessionToken(token?: string) {
  if (!token) {
    return null;
  }

  if (hasDatabase()) {
    return getUserBySessionTokenDb(token);
  }

  const store = await readStore();
  const now = Date.now();
  const session = store.sessions.find((item) => item.token === token);

  if (!session || new Date(session.expiresAt).getTime() <= now) {
    return null;
  }

  const user = store.users.find((item) => item.id === session.userId);
  if (!user) {
    return null;
  }

  normalizeUserUsage(user);
  normalizeRewardCredits(user);
  return toPublicUser(user);
}

export async function deleteSession(token?: string) {
  if (!token) {
    return;
  }

  if (hasDatabase()) {
    await ensureSchema();
    await getPool().query("delete from app_sessions where token = $1", [token]);
    return;
  }

  const store = await readStore();
  store.sessions = store.sessions.filter((item) => item.token !== token);
  await writeStore(store);
}

export async function consumeUsage(userId: string, feature: UsageFeature) {
  if (hasDatabase()) {
    return consumeUsageDb(userId, feature);
  }

  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    return { ok: false, message: "Usuário não encontrado.", user: null };
  }

  normalizeUserUsage(user);
  const normalizedUser = normalizeRewardCredits(user);
  const rewardCredits = normalizedUser.rewardCredits;
  const plan = getPlan(user.plan);
  const limit = plan.limits[feature];

  if (user.usage[feature] >= limit) {
    if (feature === "aiExplanations" && rewardCredits.aiExplanations > 0) {
      rewardCredits.aiExplanations -= 1;
      await writeStore(store);
      return { ok: true, message: "Crédito de anúncio usado.", user: toPublicUser(user) };
    }

    return {
      ok: false,
      message: limit === 0
        ? "Seu plano atual não inclui este recurso. Faça upgrade para continuar."
        : `Limite diário do plano ${plan.name} atingido. Faça upgrade para liberar mais uso.`,
      user: toPublicUser(user),
    };
  }

  user.usage[feature] += 1;
  await writeStore(store);

  return { ok: true, message: "", user: toPublicUser(user) };
}

export async function grantRewardCredit(userId: string, feature: RewardFeature) {
  if (hasDatabase()) {
    return grantRewardCreditDb(userId, feature);
  }

  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  normalizeUserUsage(user);
  const normalizedUser = normalizeRewardCredits(user);
  normalizedUser.rewardCredits[feature] += 1;
  await writeStore(store);

  return toPublicUser(normalizedUser);
}

export async function consumeRewardCredit(userId: string, feature: RewardFeature) {
  if (hasDatabase()) {
    return consumeRewardCreditDb(userId, feature);
  }

  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    return { ok: false, message: "Usuário não encontrado.", user: null };
  }

  normalizeUserUsage(user);
  const normalizedUser = normalizeRewardCredits(user);

  if (normalizedUser.rewardCredits[feature] <= 0) {
    return {
      ok: false,
      message: "Assista a um anúncio para liberar este recurso avulso ou faça upgrade.",
      user: toPublicUser(normalizedUser),
    };
  }

  normalizedUser.rewardCredits[feature] -= 1;
  await writeStore(store);

  return { ok: true, message: "Crédito de anúncio usado.", user: toPublicUser(normalizedUser) };
}

export async function updateUserPlan(userId: string, plan: PlanId) {
  if (hasDatabase()) {
    return updateUserPlanDb(userId, plan);
  }

  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  user.plan = plan;
  normalizeUserUsage(user);
  normalizeRewardCredits(user);
  await writeStore(store);

  return toPublicUser(user);
}

export function publicUserWithPlan(user: PublicUser) {
  return {
    ...user,
    planDetails: getPlan(user.plan),
  };
}

function normalizeUserUsage(user: UserRecord) {
  const today = todayKey();

  if (!user.usage || user.usage.date !== today) {
    user.usage = emptyUsage(today);
  }

  return user;
}

function normalizeRewardCredits(user: UserRecord) {
  user.rewardCredits = {
    ...emptyRewardCredits(),
    ...(user.rewardCredits ?? {}),
  };

  return user as UserRecord & { rewardCredits: RewardCredits };
}

async function readStore(): Promise<AuthStore> {
  try {
    const raw = await readFile(storePath, "utf-8");
    const parsed = JSON.parse(raw) as AuthStore;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { users: [], sessions: [] };
  }
}

async function writeStore(store: AuthStore) {
  if (process.env.VERCEL) {
    throw new Error("Configure DATABASE_URL na Vercel para salvar usuários e sessões.");
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

async function createUserDb({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  await ensureSchema();
  const normalizedEmail = normalizeEmail(email);
  const existing = await getPool().query("select 1 from app_users where email = $1 limit 1", [
    normalizedEmail,
  ]);

  if (existing.rowCount) {
    throw new Error("Este e-mail já está cadastrado.");
  }

  const salt = randomBytes(16).toString("hex");
  const user: UserRecord = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password, salt),
    passwordSalt: salt,
    plan: "free",
    createdAt: new Date().toISOString(),
    usage: emptyUsage(),
    rewardCredits: emptyRewardCredits(),
  };

  await getPool().query(
    `insert into app_users
      (id, name, email, password_hash, password_salt, plan, created_at, usage, reward_credits)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`,
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.passwordSalt,
      user.plan,
      user.createdAt,
      JSON.stringify(user.usage),
      JSON.stringify(user.rewardCredits),
    ],
  );

  return toPublicUser(user);
}

async function verifyUserCredentialsDb(email: string, password: string) {
  await ensureSchema();
  const result = await getPool().query<DbUserRow>("select * from app_users where email = $1 limit 1", [
    normalizeEmail(email),
  ]);
  const user = result.rows[0] ? fromDbUser(result.rows[0]) : null;

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  normalizeUserUsage(user);
  normalizeRewardCredits(user);
  await saveDbUserState(user);

  return toPublicUser(user);
}

async function createSessionDb(userId: string) {
  await ensureSchema();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 24 * 60 * 60 * 1000);
  const session: SessionRecord = {
    token: randomBytes(32).toString("hex"),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await getPool().query("delete from app_sessions where expires_at <= now()");
  await getPool().query(
    `insert into app_sessions (token, user_id, created_at, expires_at)
     values ($1, $2, $3, $4)`,
    [session.token, session.userId, session.createdAt, session.expiresAt],
  );

  return session;
}

async function getUserBySessionTokenDb(token: string) {
  await ensureSchema();
  const result = await getPool().query<DbUserRow>(
    `select u.*
       from app_sessions s
       join app_users u on u.id = s.user_id
      where s.token = $1 and s.expires_at > now()
      limit 1`,
    [token],
  );
  const user = result.rows[0] ? fromDbUser(result.rows[0]) : null;

  if (!user) {
    return null;
  }

  normalizeUserUsage(user);
  normalizeRewardCredits(user);
  await saveDbUserState(user);

  return toPublicUser(user);
}

async function consumeUsageDb(userId: string, feature: UsageFeature) {
  await ensureSchema();
  const user = await getDbUserById(userId);

  if (!user) {
    return { ok: false, message: "Usuário não encontrado.", user: null };
  }

  normalizeUserUsage(user);
  const normalizedUser = normalizeRewardCredits(user);
  const plan = getPlan(user.plan);
  const limit = plan.limits[feature];

  if (user.usage[feature] >= limit) {
    if (feature === "aiExplanations" && normalizedUser.rewardCredits.aiExplanations > 0) {
      normalizedUser.rewardCredits.aiExplanations -= 1;
      await saveDbUserState(normalizedUser);
      return { ok: true, message: "Crédito de anúncio usado.", user: toPublicUser(normalizedUser) };
    }

    return {
      ok: false,
      message:
        limit === 0
          ? "Seu plano atual não inclui este recurso. Faça upgrade para continuar."
          : `Limite diário do plano ${plan.name} atingido. Faça upgrade para liberar mais uso.`,
      user: toPublicUser(normalizedUser),
    };
  }

  user.usage[feature] += 1;
  await saveDbUserState(user);

  return { ok: true, message: "", user: toPublicUser(user) };
}

async function grantRewardCreditDb(userId: string, feature: RewardFeature) {
  await ensureSchema();
  const user = await getDbUserById(userId);

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  normalizeUserUsage(user);
  const normalizedUser = normalizeRewardCredits(user);
  normalizedUser.rewardCredits[feature] += 1;
  await saveDbUserState(normalizedUser);

  return toPublicUser(normalizedUser);
}

async function consumeRewardCreditDb(userId: string, feature: RewardFeature) {
  await ensureSchema();
  const user = await getDbUserById(userId);

  if (!user) {
    return { ok: false, message: "Usuário não encontrado.", user: null };
  }

  normalizeUserUsage(user);
  const normalizedUser = normalizeRewardCredits(user);

  if (normalizedUser.rewardCredits[feature] <= 0) {
    return {
      ok: false,
      message: "Assista a um anúncio para liberar este recurso avulso ou faça upgrade.",
      user: toPublicUser(normalizedUser),
    };
  }

  normalizedUser.rewardCredits[feature] -= 1;
  await saveDbUserState(normalizedUser);

  return { ok: true, message: "Crédito de anúncio usado.", user: toPublicUser(normalizedUser) };
}

async function updateUserPlanDb(userId: string, plan: PlanId) {
  await ensureSchema();
  const user = await getDbUserById(userId);

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  user.plan = plan;
  normalizeUserUsage(user);
  normalizeRewardCredits(user);
  await saveDbUserState(user);

  return toPublicUser(user);
}

async function getDbUserById(userId: string) {
  const result = await getPool().query<DbUserRow>("select * from app_users where id = $1 limit 1", [
    userId,
  ]);
  return result.rows[0] ? fromDbUser(result.rows[0]) : null;
}

async function saveDbUserState(user: UserRecord) {
  await getPool().query(
    `update app_users
        set plan = $2,
            usage = $3::jsonb,
            reward_credits = $4::jsonb
      where id = $1`,
    [
      user.id,
      user.plan,
      JSON.stringify(user.usage),
      JSON.stringify(user.rewardCredits ?? emptyRewardCredits()),
    ],
  );
}

function fromDbUser(row: DbUserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    plan: row.plan,
    createdAt: new Date(row.created_at).toISOString(),
    usage: row.usage ?? emptyUsage(),
    rewardCredits: row.reward_credits ?? emptyRewardCredits(),
  };
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    usage: user.usage,
    rewardCredits: user.rewardCredits ?? emptyRewardCredits(),
    createdAt: user.createdAt,
  };
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
}

function verifyPassword(password: string, salt: string, hash: string) {
  const current = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(hash, "hex");
  return current.length === expected.length && timingSafeEqual(current, expected);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
