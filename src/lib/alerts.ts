import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ensureSchema, getPool, hasDatabase } from "@/lib/db";
import { EmailDelivery, sendAlertEmail } from "@/lib/email";
import type { AuthenticatedUser } from "@/lib/auth";

export type AlertSubscription = {
  id: string;
  userId: string;
  processNumber: string;
  tribunalLabel?: string;
  className?: string;
  subject?: string;
  siteEnabled: boolean;
  emailEnabled: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SiteNotification = {
  id: string;
  userId: string;
  alertId?: string;
  processNumber?: string;
  title: string;
  message: string;
  read: boolean;
  emailStatus?: string;
  createdAt: string;
};

type AlertStore = {
  alerts: AlertSubscription[];
  notifications: SiteNotification[];
};

type DbAlertRow = {
  id: string;
  user_id: string;
  process_number: string;
  tribunal_label: string | null;
  class_name: string | null;
  subject: string | null;
  site_enabled: boolean;
  email_enabled: boolean;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type DbNotificationRow = {
  id: string;
  user_id: string;
  alert_id: string | null;
  process_number: string | null;
  title: string;
  message: string;
  read: boolean;
  email_status: string | null;
  created_at: Date | string;
};

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "alerts-store.json");

export async function listUserAlerts(userId: string) {
  if (hasDatabase()) {
    await ensureSchema();
    const result = await getPool().query<DbAlertRow>(
      "select * from app_alerts where user_id = $1 order by created_at desc",
      [userId],
    );
    return result.rows.map(fromDbAlert);
  }

  const store = await readStore();
  return store.alerts
    .filter((alert) => alert.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listUserNotifications(userId: string) {
  if (hasDatabase()) {
    await ensureSchema();
    const result = await getPool().query<DbNotificationRow>(
      "select * from app_notifications where user_id = $1 order by created_at desc limit 30",
      [userId],
    );
    return result.rows.map(fromDbNotification);
  }

  const store = await readStore();
  return store.notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
}

export async function createProcessAlert({
  user,
  processNumber,
  tribunalLabel,
  className,
  subject,
  emailEnabled,
  siteEnabled,
}: {
  user: AuthenticatedUser;
  processNumber: string;
  tribunalLabel?: string;
  className?: string;
  subject?: string;
  emailEnabled: boolean;
  siteEnabled: boolean;
}) {
  if (hasDatabase()) {
    return createProcessAlertDb({
      user,
      processNumber,
      tribunalLabel,
      className,
      subject,
      emailEnabled,
      siteEnabled,
    });
  }

  const store = await readStore();
  const normalizedProcess = processNumber.trim();
  const now = new Date().toISOString();
  let alert = store.alerts.find(
    (item) => item.userId === user.id && item.processNumber === normalizedProcess,
  );

  if (alert) {
    alert.active = true;
    alert.emailEnabled = emailEnabled;
    alert.siteEnabled = siteEnabled;
    alert.tribunalLabel = tribunalLabel;
    alert.className = className;
    alert.subject = subject;
    alert.updatedAt = now;
  } else {
    alert = {
      id: randomUUID(),
      userId: user.id,
      processNumber: normalizedProcess,
      tribunalLabel,
      className,
      subject,
      siteEnabled,
      emailEnabled,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    store.alerts.push(alert);
  }

  const notification = buildNotification({
    userId: user.id,
    alertId: alert.id,
    processNumber: normalizedProcess,
    title: "Monitoramento ativado",
    message: `Você receberá alertas deste processo pelo site${emailEnabled ? " e por e-mail" : ""}.`,
  });
  store.notifications.push(notification);

  let delivery: EmailDelivery = {
    enabled: false,
    sent: false,
    message: "E-mail desativado para este alerta.",
  };

  if (emailEnabled) {
    delivery = await sendAlertEmail({
      to: user.email,
      subject: `Alerta ativado: ${normalizedProcess}`,
      title: "Monitoramento ativado",
      message: `O processo ${normalizedProcess} foi adicionado aos seus alertas.`,
      processNumber: normalizedProcess,
    });
    notification.emailStatus = delivery.message;
  }

  await writeStore(store);

  return {
    alert,
    notification,
    delivery,
    alerts: await listUserAlerts(user.id),
    notifications: await listUserNotifications(user.id),
  };
}

export async function createManualAlertNotification({
  user,
  alertId,
  title,
  message,
}: {
  user: AuthenticatedUser;
  alertId: string;
  title: string;
  message: string;
}) {
  if (hasDatabase()) {
    return createManualAlertNotificationDb({ user, alertId, title, message });
  }

  const store = await readStore();
  const alert = store.alerts.find((item) => item.id === alertId && item.userId === user.id);

  if (!alert) {
    throw new Error("Alerta não encontrado.");
  }

  const notification = buildNotification({
    userId: user.id,
    alertId: alert.id,
    processNumber: alert.processNumber,
    title,
    message,
  });
  store.notifications.push(notification);

  let delivery: EmailDelivery = {
    enabled: false,
    sent: false,
    message: "E-mail desativado para este alerta.",
  };

  if (alert.emailEnabled) {
    delivery = await sendAlertEmail({
      to: user.email,
      subject: `${title}: ${alert.processNumber}`,
      title,
      message,
      processNumber: alert.processNumber,
    });
    notification.emailStatus = delivery.message;
  }

  await writeStore(store);

  return {
    notification,
    delivery,
    notifications: await listUserNotifications(user.id),
  };
}

export async function markUserNotificationsRead(userId: string) {
  if (hasDatabase()) {
    await ensureSchema();
    await getPool().query("update app_notifications set read = true where user_id = $1", [userId]);
    return listUserNotifications(userId);
  }

  const store = await readStore();
  for (const notification of store.notifications) {
    if (notification.userId === userId) {
      notification.read = true;
    }
  }
  await writeStore(store);
  return listUserNotifications(userId);
}

function buildNotification({
  userId,
  alertId,
  processNumber,
  title,
  message,
}: {
  userId: string;
  alertId?: string;
  processNumber?: string;
  title: string;
  message: string;
}): SiteNotification {
  return {
    id: randomUUID(),
    userId,
    alertId,
    processNumber,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  } satisfies SiteNotification;
}

async function readStore(): Promise<AlertStore> {
  try {
    const raw = await readFile(storePath, "utf-8");
    const parsed = JSON.parse(raw) as AlertStore;
    return {
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return { alerts: [], notifications: [] };
  }
}

async function writeStore(store: AlertStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

async function createProcessAlertDb({
  user,
  processNumber,
  tribunalLabel,
  className,
  subject,
  emailEnabled,
  siteEnabled,
}: {
  user: AuthenticatedUser;
  processNumber: string;
  tribunalLabel?: string;
  className?: string;
  subject?: string;
  emailEnabled: boolean;
  siteEnabled: boolean;
}) {
  await ensureSchema();
  const normalizedProcess = processNumber.trim();
  const now = new Date().toISOString();
  const alertId = randomUUID();
  const result = await getPool().query<DbAlertRow>(
    `insert into app_alerts
      (id, user_id, process_number, tribunal_label, class_name, subject, site_enabled,
       email_enabled, active, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $9)
     on conflict (user_id, process_number)
     do update set
       tribunal_label = excluded.tribunal_label,
       class_name = excluded.class_name,
       subject = excluded.subject,
       site_enabled = excluded.site_enabled,
       email_enabled = excluded.email_enabled,
       active = true,
       updated_at = excluded.updated_at
     returning *`,
    [
      alertId,
      user.id,
      normalizedProcess,
      tribunalLabel ?? null,
      className ?? null,
      subject ?? null,
      siteEnabled,
      emailEnabled,
      now,
    ],
  );
  const alert = fromDbAlert(result.rows[0]);
  const notification = buildNotification({
    userId: user.id,
    alertId: alert.id,
    processNumber: normalizedProcess,
    title: "Monitoramento ativado",
    message: `Você receberá alertas deste processo pelo site${emailEnabled ? " e por e-mail" : ""}.`,
  });

  let delivery: EmailDelivery = {
    enabled: false,
    sent: false,
    message: "E-mail desativado para este alerta.",
  };

  if (emailEnabled) {
    delivery = await sendAlertEmail({
      to: user.email,
      subject: `Alerta ativado: ${normalizedProcess}`,
      title: "Monitoramento ativado",
      message: `O processo ${normalizedProcess} foi adicionado aos seus alertas.`,
      processNumber: normalizedProcess,
    });
    notification.emailStatus = delivery.message;
  }

  await insertNotification(notification);

  return {
    alert,
    notification,
    delivery,
    alerts: await listUserAlerts(user.id),
    notifications: await listUserNotifications(user.id),
  };
}

async function createManualAlertNotificationDb({
  user,
  alertId,
  title,
  message,
}: {
  user: AuthenticatedUser;
  alertId: string;
  title: string;
  message: string;
}) {
  await ensureSchema();
  const result = await getPool().query<DbAlertRow>(
    "select * from app_alerts where id = $1 and user_id = $2 limit 1",
    [alertId, user.id],
  );
  const alert = result.rows[0] ? fromDbAlert(result.rows[0]) : null;

  if (!alert) {
    throw new Error("Alerta não encontrado.");
  }

  const notification = buildNotification({
    userId: user.id,
    alertId: alert.id,
    processNumber: alert.processNumber,
    title,
    message,
  });

  let delivery: EmailDelivery = {
    enabled: false,
    sent: false,
    message: "E-mail desativado para este alerta.",
  };

  if (alert.emailEnabled) {
    delivery = await sendAlertEmail({
      to: user.email,
      subject: `${title}: ${alert.processNumber}`,
      title,
      message,
      processNumber: alert.processNumber,
    });
    notification.emailStatus = delivery.message;
  }

  await insertNotification(notification);

  return {
    notification,
    delivery,
    notifications: await listUserNotifications(user.id),
  };
}

async function insertNotification(notification: SiteNotification) {
  await getPool().query(
    `insert into app_notifications
      (id, user_id, alert_id, process_number, title, message, read, email_status, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      notification.id,
      notification.userId,
      notification.alertId ?? null,
      notification.processNumber ?? null,
      notification.title,
      notification.message,
      notification.read,
      notification.emailStatus ?? null,
      notification.createdAt,
    ],
  );
}

function fromDbAlert(row: DbAlertRow): AlertSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    processNumber: row.process_number,
    tribunalLabel: row.tribunal_label ?? undefined,
    className: row.class_name ?? undefined,
    subject: row.subject ?? undefined,
    siteEnabled: row.site_enabled,
    emailEnabled: row.email_enabled,
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function fromDbNotification(row: DbNotificationRow): SiteNotification {
  return {
    id: row.id,
    userId: row.user_id,
    alertId: row.alert_id ?? undefined,
    processNumber: row.process_number ?? undefined,
    title: row.title,
    message: row.message,
    read: row.read,
    emailStatus: row.email_status ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
