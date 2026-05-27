import { NextRequest, NextResponse } from "next/server";
import { consumeProtectedUsage } from "@/lib/auth";
import { fetchPjeProcessDetails } from "@/lib/pje";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    tribunal?: string;
    processId?: number;
    instancia?: number;
    tokenDesafio?: string;
    resposta?: string;
  } | null;

  const tribunal = String(body?.tribunal ?? "").toLowerCase();
  const processId = Number(body?.processId);
  const instancia = Number(body?.instancia);
  const tokenDesafio = String(body?.tokenDesafio ?? "");
  const resposta = String(body?.resposta ?? "");

  if (!tribunal || !Number.isFinite(processId) || !Number.isFinite(instancia)) {
    return NextResponse.json(
      { message: "Dados insuficientes para consultar detalhes no PJe." },
      { status: 400 },
    );
  }

  const usage = await consumeProtectedUsage(request, "pjeDetails");
  if (usage.response) {
    return usage.response;
  }

  try {
    const result = await fetchPjeProcessDetails({
      tribunal,
      processId,
      instancia,
      tokenDesafio: tokenDesafio || undefined,
      resposta: resposta || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar detalhes no PJe.",
      },
      { status: 502 },
    );
  }
}
