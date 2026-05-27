import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "crypto";
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
  const store = await readStore();
  const user = store.users.find((item) => item.email === normalizeEmail(email));

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return toPublicUser(user);
}

export async function createSession(userId: string) {
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

  const store = await readStore();
  store.sessions = store.sessions.filter((item) => item.token !== token);
  await writeStore(store);
}

export async function consumeUsage(userId: string, feature: UsageFeature) {
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
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
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
