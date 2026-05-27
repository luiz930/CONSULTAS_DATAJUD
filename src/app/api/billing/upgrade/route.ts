import { NextRequest, NextResponse } from "next/server";
import { isKnownPlan, requireAuthenticatedUser } from "@/lib/auth";
import { publicUserWithPlan, updateUserPlan } from "@/lib/users";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { plan?: string } | null;
  const plan = String(body?.plan ?? "");

  if (!isKnownPlan(plan)) {
    return NextResponse.json({ message: "Plano inválido." }, { status: 400 });
  }

  const user = await updateUserPlan(auth.user.id, plan);

  return NextResponse.json({
    user: publicUserWithPlan(user),
    checkout: {
      status: "mock",
      message: "Upgrade aplicado em modo MVP. Conecte Mercado Pago ou Stripe para cobrança real.",
    },
  });
}

