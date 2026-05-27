import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
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

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "alerts-store.json");

export async function listUserAlerts(userId: string) {
  const store = await readStore();
  return store.alerts
    .filter((alert) => alert.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listUserNotifications(userId: string) {
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
