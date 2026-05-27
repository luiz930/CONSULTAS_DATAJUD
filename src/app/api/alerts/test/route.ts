import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createManualAlertNotification } from "@/lib/alerts";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as {
    alertId?: string;
    title?: string;
    message?: string;
  } | null;

  const alertId = String(body?.alertId ?? "");

  if (!alertId) {
    return NextResponse.json({ message: "Informe o alerta para testar." }, { status: 400 });
  }

  try {
    const result = await createManualAlertNotification({
      user: auth.user,
      alertId,
      title: String(body?.title ?? "Nova movimentação monitorada"),
      message: String(
        body?.message ??
          "O monitoramento registrou uma atualização para este processo. Confira os detalhes no painel.",
      ),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível testar o alerta." },
      { status: 400 },
    );
  }
}

