import { NextRequest, NextResponse } from "next/server";
import { consumeProtectedUsage } from "@/lib/auth";

type ExplainRequest = {
  kind?: "movement" | "document" | "case";
  title?: string;
  date?: string;
  complement?: string;
  process?: {
    number?: string;
    tribunal?: string;
    className?: string;
    subject?: string;
  };
};

type Explanation = {
  provider: "openai" | "local";
  title: string;
  plainLanguage: string;
  meaning: string;
  nextStep: string;
  caution: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ExplainRequest | null;

  if (!body?.title && !body?.complement) {
    return NextResponse.json({ message: "Informe o item processual para explicar." }, { status: 400 });
  }

  const usage = await consumeProtectedUsage(request, "aiExplanations");
  if (usage.response) {
    return usage.response;
  }

  const fallback = buildLocalExplanation(body);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ...fallback, account: usage.user });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Voce explica movimentacoes processuais brasileiras em portugues claro. Nao de consultoria juridica, nao invente fatos e destaque limites quando o texto for insuficiente. Responda somente em JSON valido com as chaves title, plainLanguage, meaning, nextStep e caution.",
          },
          {
            role: "user",
            content: JSON.stringify({
              item: {
                tipo: body.kind ?? "movement",
                titulo: body.title,
                data: body.date,
                complemento: body.complement,
              },
              processo: body.process,
              formato:
                "Explique para leigo em ate 4 frases curtas. nextStep deve ser uma sugestao operacional neutra, sem orientar estrategia juridica.",
            }),
          },
        ],
        max_output_tokens: 600,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(fallback);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const text = extractOutputText(data);
    const parsed = parseExplanation(text);

    return NextResponse.json({
      provider: "openai",
      title: parsed.title || fallback.title,
      plainLanguage: parsed.plainLanguage || fallback.plainLanguage,
      meaning: parsed.meaning || fallback.meaning,
      nextStep: parsed.nextStep || fallback.nextStep,
      caution: parsed.caution || fallback.caution,
      account: usage.user,
    });
  } catch {
    return NextResponse.json({ ...fallback, account: usage.user });
  }
}

function buildLocalExplanation(body: ExplainRequest): Explanation {
  const title = normalize(body.title || body.complement || "Movimentacao processual");
  const lower = title.toLowerCase();
  const kind = body.kind ?? "movement";

  let plainLanguage = "Este registro indica uma atualizacao no andamento do processo.";
  let meaning = "A fonte publica nao trouxe detalhes suficientes para uma interpretacao mais especifica.";
  let nextStep = "Confira a linha do tempo e acompanhe novas atualizacoes pela consulta oficial.";

  if (lower.includes("distribui")) {
    plainLanguage = "O processo foi encaminhado ou registrado para um orgao julgador.";
    meaning = "Normalmente isso indica o inicio da tramitacao ou a definicao de onde o processo sera analisado.";
    nextStep = "Verifique o orgao julgador e acompanhe os proximos movimentos.";
  } else if (lower.includes("conclus")) {
    plainLanguage = "O processo foi enviado para decisao ou analise do magistrado.";
    meaning = "Geralmente significa que o juiz ou relator deve avaliar algum pedido, documento ou etapa.";
    nextStep = "Acompanhe se surgira decisao, despacho ou julgamento.";
  } else if (lower.includes("remessa")) {
    plainLanguage = "O processo foi remetido para outro setor, orgao ou instancia.";
    meaning = "Pode indicar deslocamento interno, envio para recurso, cumprimento de providencia ou encerramento de uma etapa.";
    nextStep = "Observe o complemento da remessa e o destino informado.";
  } else if (lower.includes("documento") || lower.includes("certid")) {
    plainLanguage = "Um documento foi juntado, expedido ou certificado no processo.";
    meaning = "Pode ser uma certidao, comprovante, comunicacao ou outro registro formal.";
    nextStep = "Abra os documentos publicos disponiveis ou valide no portal do tribunal quando houver captcha.";
  } else if (lower.includes("peti")) {
    plainLanguage = "Uma peticao foi protocolada por uma das partes ou representante.";
    meaning = "Peticoes costumam trazer pedidos, manifestacoes, recursos ou respostas dentro do processo.";
    nextStep = "Acompanhe se o juizo ira analisar a peticao em movimentacao posterior.";
  } else if (lower.includes("recebimento")) {
    plainLanguage = "O processo ou documento foi recebido por uma unidade.";
    meaning = "Isso confirma entrada em uma fase, setor ou gabinete, mas nao significa decisao por si so.";
    nextStep = "Aguarde a movimentacao seguinte para entender a providencia tomada.";
  } else if (kind === "document") {
    plainLanguage = "Este item representa um documento ou expediente vinculado ao processo.";
    meaning = "Documentos podem formalizar pedidos, certidoes, notificacoes, decisoes ou comprovantes.";
    nextStep = "Leia o documento no portal oficial quando ele estiver publico.";
  }

  return {
    provider: "local",
    title,
    plainLanguage,
    meaning,
    nextStep,
    caution: "Esta explicacao e informativa e nao substitui a analise de um advogado.",
  };
}

function extractOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  return output
    .flatMap((item) => {
      const record = asRecord(item);
      const content = Array.isArray(record.content) ? record.content : [];
      return content.map((part) => {
        const partRecord = asRecord(part);
        return String(partRecord.text ?? "");
      });
    })
    .join("\n");
}

function parseExplanation(text: string) {
  try {
    const json = JSON.parse(text) as Partial<Explanation>;
    return json;
  } catch {
    return {
      plainLanguage: text,
    } satisfies Partial<Explanation>;
  }
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
