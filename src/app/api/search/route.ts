import { NextRequest, NextResponse } from "next/server";
import {
  buildDataJudQuery,
  DATAJUD_PUBLIC_KEY,
  mapDataJudHit,
  normalizeProcessNumber,
  ProcessoResumo,
  resolveNumberFallbackTribunals,
  resolveTribunals,
  SearchRequest,
  SearchResponse,
} from "@/lib/datajud";
import { consumeProtectedUsage } from "@/lib/auth";
import { fetchPjeBasicProcess, hasPjeProvider } from "@/lib/pje";

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const cache = new Map<string, { expiresAt: number; payload: SearchResponse }>();

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  if (!allowRequest(ip)) {
    return NextResponse.json(
      { message: "Muitas consultas em pouco tempo. Aguarde alguns segundos e tente novamente." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as Partial<SearchRequest> | null;
  const parsed = parseRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const usage = await consumeProtectedUsage(request, "searches");
  if (usage.response) {
    return usage.response;
  }

  const cacheKey = JSON.stringify(parsed);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cached: true, account: usage.user });
  }

  const searchedTribunals = resolveTribunals(parsed).slice(0, parsed.mode === "name" ? 6 : undefined);
  const warnings = [
    "Processos sigilosos ou protegidos por restrição legal não aparecem na consulta pública.",
  ];

  if (parsed.mode === "name") {
    warnings.push(
      "A busca por nome é uma prévia: a API pública documentada do DataJud prioriza metadados e pode não expor nomes de partes em todos os tribunais.",
    );
  }

  let responses = await fetchTribunals(searchedTribunals, parsed);
  let results = collectResults(responses, parsed.limit ?? 20);
  const pjeWarnings = await appendPjeFallbackResults(parsed, searchedTribunals, results);
  warnings.push(...pjeWarnings);

  if (results.length === 0 && parsed.mode === "number" && parsed.tribunal === "auto") {
    const fallbackTribunals = resolveNumberFallbackTribunals(parsed, searchedTribunals);

    if (fallbackTribunals.length > 0) {
      warnings.push(
        "Não encontrei no tribunal inferido pelo número. Fiz uma busca ampliada no mesmo ramo de Justiça.",
      );
      searchedTribunals.push(...fallbackTribunals);
      const fallbackResponses = await fetchTribunals(fallbackTribunals, parsed);
      responses = [...responses, ...fallbackResponses];
      results = collectResults(responses, parsed.limit ?? 20);
      const fallbackPjeWarnings = await appendPjeFallbackResults(parsed, searchedTribunals, results);
      warnings.push(...fallbackPjeWarnings);
    }
  }

  if (results.length === 0 && parsed.mode === "number") {
    warnings.push(
      "Se o processo existir no site do tribunal, ele pode ainda não estar disponível na API pública do DataJud ou pode estar sob restrição de sigilo.",
    );
  }

  const failed = responses.filter((response) => response.status === "rejected").length;
  if (failed) {
    warnings.push(`${failed} tribunal(is) não responderam dentro do tempo esperado.`);
  }

  const payload: SearchResponse = {
    results,
    searchedTribunals,
    warnings,
    elapsedMs: Date.now() - startedAt,
  };

  cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, payload });

  return NextResponse.json({ ...payload, account: usage.user });
}

async function appendPjeFallbackResults(
  request: SearchRequest,
  searchedTribunals: string[],
  results: ProcessoResumo[],
) {
  if (request.mode !== "number") {
    return [];
  }

  const pjeTribunals = searchedTribunals.filter((tribunal) => hasPjeProvider(tribunal));
  if (pjeTribunals.length === 0) {
    return [];
  }

  const pjeResults = (
    await Promise.all(pjeTribunals.map((tribunal) => fetchPjeBasicProcess(tribunal, request.query)))
  ).flat();

  const existingKeys = new Set(results.map((processo) => `${processo.tribunal}-${processo.numeroProcesso}`));
  for (const processo of pjeResults) {
    const key = `${processo.tribunal}-${processo.numeroProcesso}`;
    if (!existingKeys.has(key)) {
      results.push(processo);
      existingKeys.add(key);
    }
  }

  if (pjeResults.length === 0) {
    return [];
  }

  return [
    "O PJe público do tribunal retornou dados básicos. Movimentações/documentos podem exigir captcha diretamente no site do tribunal.",
  ];
}

async function fetchTribunals(tribunalsToSearch: string[], request: SearchRequest) {
  const batchSize = 8;
  const responses: PromiseSettledResult<ProcessoResumo[]>[] = [];

  for (let index = 0; index < tribunalsToSearch.length; index += batchSize) {
    const batch = tribunalsToSearch.slice(index, index + batchSize);
    const batchResponses = await Promise.allSettled(
      batch.map((tribunal) => fetchTribunal(tribunal, request)),
    );
    responses.push(...batchResponses);
  }

  return responses;
}

function collectResults(responses: PromiseSettledResult<ProcessoResumo[]>[], limit: number) {
  return responses
    .flatMap((response) => (response.status === "fulfilled" ? response.value : []))
    .filter((processo, index, all) => {
      const key = `${processo.tribunal}-${processo.numeroProcesso}-${processo.grau ?? ""}`;
      return (
        all.findIndex((item) => `${item.tribunal}-${item.numeroProcesso}-${item.grau ?? ""}` === key) ===
        index
      );
    })
    .slice(0, limit);
}

function parseRequest(body: Partial<SearchRequest> | null): SearchRequest | { error: string } {
  const mode = body?.mode;
  const query = String(body?.query ?? "").trim();
  const tribunal = String(body?.tribunal ?? "auto");
  const limit = Number(body?.limit ?? 20);

  if (mode !== "number" && mode !== "name") {
    return { error: "Tipo de busca inválido." };
  }

  if (mode === "number" && normalizeProcessNumber(query).length !== 20) {
    return { error: "Informe um número CNJ com 20 dígitos." };
  }

  if (mode === "name" && query.replace(/\s+/g, " ").length < 6) {
    return { error: "Informe um nome mais específico para reduzir falsos positivos." };
  }

  return {
    mode,
    query,
    tribunal,
    limit: Number.isFinite(limit) ? limit : 20,
  };
}

function allowRequest(ip: string) {
  const now = Date.now();
  const current = rateLimit.get(ip);

  if (!current || current.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  return true;
}

async function fetchTribunal(tribunal: string, request: SearchRequest) {
  const apiKey = process.env.DATAJUD_API_KEY ?? DATAJUD_PUBLIC_KEY;
  const response = await fetch(`${BASE_URL}/api_publica_${tribunal}/_search`, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildDataJudQuery(request)),
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`DataJud ${tribunal} retornou ${response.status}`);
  }

  const data = (await response.json()) as {
    hits?: { hits?: Array<{ _id?: string; _source?: Record<string, unknown> }> };
  };

  return (data.hits?.hits ?? []).map((hit) => mapDataJudHit(hit, tribunal));
}
