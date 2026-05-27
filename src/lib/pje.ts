import {
  formatProcessNumber,
  getTribunalLabel,
  normalizeProcessNumber,
  ProcessoMovimento,
  ProcessoResumo,
} from "@/lib/datajud";

type PjeBasicProcess = {
  id: number;
  numeroIdentificacaoJustica?: number;
  numero: string;
  classe?: string;
  codigoOrgaoJulgador?: string;
  segredoJustica?: boolean;
  juizoDigital?: boolean;
  integracaoExterna?: {
    urlServico?: string;
  };
};

const pjeProviders: Record<string, { baseUrl: string; label: string }> = {
  trt4: {
    baseUrl: "https://pje.trt4.jus.br",
    label: "PJe Público/TRT4",
  },
};

export type PjeDetailsResult =
  | {
      status: "captcha";
      tokenDesafio: string;
      imagem: string;
      message: string;
    }
  | {
      status: "ok";
      processo: Partial<ProcessoResumo>;
      movimentos: ProcessoMovimento[];
      raw: Record<string, unknown>;
    };

export function hasPjeProvider(tribunal: string) {
  return Boolean(pjeProviders[tribunal]);
}

export async function fetchPjeBasicProcess(tribunal: string, processNumber: string) {
  const provider = pjeProviders[tribunal];
  if (!provider) {
    return [];
  }

  const digits = normalizeProcessNumber(processNumber);
  if (digits.length !== 20) {
    return [];
  }

  const results: ProcessoResumo[] = [];

  for (const instancia of [1, 2, 3]) {
    const processes = await fetchPjeBasicByInstance(provider.baseUrl, digits, instancia);

    for (const processo of processes) {
      results.push(mapPjeBasicProcess(processo, tribunal, provider.label, provider.baseUrl, instancia));
    }
  }

  return results;
}

async function fetchPjeBasicByInstance(baseUrl: string, digits: string, instancia: number) {
  const response = await fetch(`${baseUrl}/pje-consulta-api/api/processos/dadosbasicos/${digits}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Grau-Instancia": String(instancia),
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json().catch(() => [])) as unknown;
  return Array.isArray(data) ? (data.filter(Boolean) as PjeBasicProcess[]) : [];
}

function mapPjeBasicProcess(
  processo: PjeBasicProcess,
  tribunal: string,
  providerLabel: string,
  baseUrl: string,
  instancia: number,
) {
  const numero = processo.numero || formatProcessNumber(String(processo.id));

  return {
    id: `${tribunal}-pje-${instancia}-${processo.id}`,
    numeroProcesso: formatProcessNumber(numero),
    tribunal: tribunal.toUpperCase(),
    tribunalLabel: getTribunalLabel(tribunal),
    grau: instancia === 3 ? "TST" : `${instancia}º Grau`,
    classe: processo.classe,
    orgaoJulgador: processo.codigoOrgaoJulgador
      ? `Código ${processo.codigoOrgaoJulgador}`
      : undefined,
    nivelSigilo: processo.segredoJustica ? 1 : 0,
    sistema: "PJe",
    movimentos: [],
    fonte: `${providerLabel} - dados básicos`,
    externalUrl: `${baseUrl}/consultaprocessual/detalhe-processo/${normalizeProcessNumber(numero)}/${instancia}`,
    detailsLocked: true,
    pje: {
      tribunal,
      processId: processo.id,
      instancia,
    },
    raw: processo as unknown as Record<string, unknown>,
  } satisfies ProcessoResumo;
}

export async function fetchPjeProcessDetails(input: {
  tribunal: string;
  processId: number;
  instancia: number;
  tokenDesafio?: string;
  resposta?: string;
}) {
  const provider = pjeProviders[input.tribunal];
  if (!provider) {
    throw new Error("Tribunal sem provedor PJe configurado.");
  }

  const params = new URLSearchParams();
  if (input.tokenDesafio && input.resposta) {
    params.set("tokenDesafio", input.tokenDesafio);
    params.set("resposta", input.resposta);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(
    `${provider.baseUrl}/pje-consulta-api/api/processos/${input.processId}${suffix}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Grau-Instancia": String(input.instancia),
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`PJe retornou ${response.status}.`);
  }

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data) {
    throw new Error("Resposta inválida do PJe.");
  }

  if (typeof data.tokenDesafio === "string" && typeof data.imagem === "string") {
    return {
      status: "captcha",
      tokenDesafio: data.tokenDesafio,
      imagem: data.imagem,
      message: "Resolva o captcha oficial para carregar movimentações e documentos.",
    } satisfies PjeDetailsResult;
  }

  const movimentos = extractPjeMovements(data);
  const processo = {
    classe: stringValue(data.classeProcesso) ?? stringValue(data.classe),
    assuntoPrincipal: stringValue(data.assunto) ?? stringValue(data.assuntoPrincipal),
    orgaoJulgador: stringValue(data.orgaoJulgador) ?? stringValue(data.nomeOrgaoJulgador),
    sistema: "PJe",
    nivelSigilo: data.segredoJustica === true ? 1 : 0,
  } satisfies Partial<ProcessoResumo>;

  return {
    status: "ok",
    processo,
    movimentos,
    raw: data,
  } satisfies PjeDetailsResult;
}

function extractPjeMovements(data: Record<string, unknown>) {
  const candidates = [
    data.itensProcesso,
    data.movimentos,
    data.timeline,
    data.eventos,
    data.documentos,
  ].find(Array.isArray) as unknown[] | undefined;

  if (!candidates) {
    return [];
  }

  return candidates
    .flatMap(flattenPjeItem)
    .map((item) => {
      const record = asRecord(item);
      return {
        nome:
          stringValue(record.descricao) ??
          stringValue(record.titulo) ??
          stringValue(record.nome) ??
          stringValue(record.tipo) ??
          stringValue(record.tipoDocumento) ??
          "Movimento processual",
        dataHora:
          stringValue(record.dataJuntada) ??
          stringValue(record.criadoEm) ??
          stringValue(record.atualizadoEm) ??
          stringValue(record.dataHora) ??
          stringValue(record.data),
        complemento:
          stringValue(record.resumo) ??
          stringValue(record.conteudo) ??
          stringValue(record.observacao),
      };
    })
    .sort((a, b) => String(b.dataHora ?? "").localeCompare(String(a.dataHora ?? "")))
    .slice(0, 60);
}

function flattenPjeItem(item: unknown): unknown[] {
  const record = asRecord(item);
  const anexos = Array.isArray(record.anexos) ? record.anexos : [];
  return [item, ...anexos.flatMap(flattenPjeItem)];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
