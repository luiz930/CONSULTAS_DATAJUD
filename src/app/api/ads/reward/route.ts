import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { grantRewardCredit, publicUserWithPlan, RewardFeature } from "@/lib/users";

const rewards: Record<string, RewardFeature> = {
  ai: "aiExplanations",
  monitoring: "monitoring",
};

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { reward?: string } | null;
  const reward = rewards[String(body?.reward ?? "")];

  if (!reward) {
    return NextResponse.json({ message: "Recompensa inválida." }, { status: 400 });
  }

  const user = await grantRewardCredit(auth.user.id, reward);

  return NextResponse.json({
    user: publicUserWithPlan(user),
    reward,
    message:
      reward === "aiExplanations"
        ? "Crédito liberado para uma explicação por IA."
        : "Crédito liberado para monitorar um processo.",
  });
}

