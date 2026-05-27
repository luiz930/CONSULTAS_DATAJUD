import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireAuthenticatedUser } from "@/lib/auth";
import { createProcessAlert, listUserAlerts, listUserNotifications } from "@/lib/alerts";
import { consumeRewardCredit, publicUserWithPlan } from "@/lib/users";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ alerts: [], notifications: [] });
  }

  const [alerts, notifications] = await Promise.all([
    listUserAlerts(user.id),
    listUserNotifications(user.id),
  ]);

  return NextResponse.json({ alerts, notifications });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth.response;
  }

  let account = auth.user;

  if (!auth.user.planDetails.features.monitoring) {
    const credit = await consumeRewardCredit(auth.user.id, "monitoring");

    if (!credit.ok) {
      return NextResponse.json(
        { message: "Monitoramento está disponível nos planos Pro e Escritório, ou com crédito de anúncio." },
        { status: 402 },
      );
    }

    if (credit.user) {
      account = publicUserWithPlan(credit.user);
    }
  }

  const body = (await request.json().catch(() => null)) as {
    processNumber?: string;
    tribunalLabel?: string;
    className?: string;
    subject?: string;
    emailEnabled?: boolean;
    siteEnabled?: boolean;
  } | null;

  const processNumber = String(body?.processNumber ?? "").trim();

  if (!processNumber) {
    return NextResponse.json({ message: "Informe o processo para monitorar." }, { status: 400 });
  }

  const result = await createProcessAlert({
    user: account,
    processNumber,
    tribunalLabel: body?.tribunalLabel,
    className: body?.className,
    subject: body?.subject,
    emailEnabled: body?.emailEnabled !== false,
    siteEnabled: body?.siteEnabled !== false,
  });

  return NextResponse.json({ ...result, account });
}
