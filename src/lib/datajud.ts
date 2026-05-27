export type SearchMode = "number" | "name";

export type Tribunal = {
  id: string;
  label: string;
  group: "Superiores" | "Federal" | "Estadual" | "Trabalho" | "Eleitoral" | "Militar";
  region?: string;
};

export type SearchRequest = {
  mode: SearchMode;
  query: string;
  tribunal: string;
  limit?: number;
};

export type ProcessoResumo = {
  id: string;
  numeroProcesso: string;
  tribunal: string;
  tribunalLabel: string;
  grau?: string;
  classe?: string;
  assuntoPrincipal?: string;
  dataAjuizamento?: string;
  orgaoJulgador?: string;
  sistema?: string;
  nivelSigilo?: number;
  movimentos: ProcessoMovimento[];
  fonte: string;
  externalUrl?: string;
  detailsLocked?: boolean;
  pje?: {
    tribunal: string;
    processId: number;
    instancia: number;
  };
  raw: Record<string, unknown>;
};

export type ProcessoMovimento = {
  nome: string;
  dataHora?: string;
  complemento?: string;
};

export type SearchResponse = {
  results: ProcessoResumo[];
  searchedTribunals: string[];
  warnings: string[];
  elapsedMs: number;
};

export const DATAJUD_PUBLIC_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

export const tribunals: Tribunal[] = [
  { id: "stj", label: "STJ - Superior Tribunal de Justiça", group: "Superiores" },
  { id: "tst", label: "TST - Tribunal Superior do Trabalho", group: "Superiores" },
  { id: "tse", label: "TSE - Tribunal Superior Eleitoral", group: "Superiores" },
  { id: "stm", label: "STM - Superior Tribunal Militar", group: "Superiores" },
  { id: "trf1", label: "TRF1 - Federal 1a Região", group: "Federal" },
  { id: "trf2", label: "TRF2 - Federal 2a Região", group: "Federal" },
  { id: "trf3", label: "TRF3 - Federal 3a Região", group: "Federal" },
  { id: "trf4", label: "TRF4 - Federal 4a Região", group: "Federal" },
  { id: "trf5", label: "TRF5 - Federal 5a Região", group: "Federal" },
  { id: "trf6", label: "TRF6 - Federal 6a Região", group: "Federal" },
  { id: "tjsp", label: "TJSP - São Paulo", group: "Estadual", region: "SP" },
  { id: "tjrj", label: "TJRJ - Rio de Janeiro", group: "Estadual", region: "RJ" },
  { id: "tjmg", label: "TJMG - Minas Gerais", group: "Estadual", region: "MG" },
  { id: "tjrs", label: "TJRS - Rio Grande do Sul", group: "Estadual", region: "RS" },
  { id: "tjpr", label: "TJPR - Paraná", group: "Estadual", region: "PR" },
  { id: "tjsc", label: "TJSC - Santa Catarina", group: "Estadual", region: "SC" },
  { id: "tjba", label: "TJBA - Bahia", group: "Estadual", region: "BA" },
  { id: "tjpe", label: "TJPE - Pernambuco", group: "Estadual", region: "PE" },
  { id: "tjce", label: "TJCE - Ceará", group: "Estadual", region: "CE" },
  { id: "tjgo", label: "TJGO - Goiás", group: "Estadual", region: "GO" },
  { id: "tjdft", label: "TJDFT - Distrito Federal", group: "Estadual", region: "DF" },
  { id: "trt1", label: "TRT1 - Rio de Janeiro", group: "Trabalho" },
  { id: "trt2", label: "TRT2 - São Paulo capital", group: "Trabalho" },
  { id: "trt3", label: "TRT3 - Minas Gerais", group: "Trabalho" },
  { id: "trt4", label: "TRT4 - Rio Grande do Sul", group: "Trabalho" },
  { id: "trt5", label: "TRT5 - Bahia", group: "Trabalho" },
  { id: "trt15", label: "TRT15 - Campinas", group: "Trabalho" },
  { id: "tre-sp", label: "TRE-SP - Eleitoral São Paulo", group: "Eleitoral", region: "SP" },
  { id: "tre-rj", label: "TRE-RJ - Eleitoral Rio de Janeiro", group: "Eleitoral", region: "RJ" },
  { id: "tre-mg", label: "TRE-MG - Eleitoral Minas Gerais", group: "Eleitoral", region: "MG" },
  { id: "tjmsp", label: "TJMSP - Militar São Paulo", group: "Militar", region: "SP" },
];

export const allTribunalIds = [
  "tst",
  "tse",
  "stj",
  "stm",
  "trf1",
  "trf2",
  "trf3",
  "trf4",
  "trf5",
  "trf6",
  "tjac",
  "tjal",
  "tjam",
  "tjap",
  "tjba",
  "tjce",
  "tjdft",
  "tjes",
  "tjgo",
  "tjma",
  "tjmg",
  "tjms",
  "tjmt",
  "tjpa",
  "tjpb",
  "tjpe",
  "tjpi",
  "tjpr",
  "tjrj",
  "tjrn",
  "tjro",
  "tjrr",
  "tjrs",
  "tjsc",
  "tjse",
  "tjsp",
  "tjto",
  "trt1",
  "trt2",
  "trt3",
  "trt4",
  "trt5",
  "trt6",
  "trt7",
  "trt8",
  "trt9",
  "trt10",
  "trt11",
  "trt12",
  "trt13",
  "trt14",
  "trt15",
  "trt16",
  "trt17",
  "trt18",
  "trt19",
  "trt20",
  "trt21",
  "trt22",
  "trt23",
  "trt24",
  "tre-ac",
  "tre-al",
  "tre-am",
  "tre-ap",
  "tre-ba",
  "tre-ce",
  "tre-dft",
  "tre-es",
  "tre-go",
  "tre-ma",
  "tre-mg",
  "tre-ms",
  "tre-mt",
  "tre-pa",
  "tre-pb",
  "tre-pe",
  "tre-pi",
  "tre-pr",
  "tre-rj",
  "tre-rn",
  "tre-ro",
  "tre-rr",
  "tre-rs",
  "tre-sc",
  "tre-se",
  "tre-sp",
  "tre-to",
  "tjmmg",
  "tjmrs",
  "tjmsp",
];

const stateByCode: Record<string, string> = {
  "01": "tjac",
  "02": "tjal",
  "03": "tjap",
  "04": "tjam",
  "05": "tjba",
  "06": "tjce",
  "07": "tjdft",
  "08": "tjes",
  "09": "tjgo",
  "10": "tjma",
  "11": "tjmt",
  "12": "tjms",
  "13": "tjmg",
  "14": "tjpa",
  "15": "tjpb",
  "16": "tjpr",
  "17": "tjpe",
  "18": "tjpi",
  "19": "tjrj",
  "20": "tjrn",
  "21": "tjrs",
  "22": "tjro",
  "23": "tjrr",
  "24": "tjsc",
  "25": "tjse",
  "26": "tjsp",
  "27": "tjto",
};

const stateUfByCode: Record<string, string> = {
  "01": "ac",
  "02": "al",
  "03": "ap",
  "04": "am",
  "05": "ba",
  "06": "ce",
  "07": "dft",
  "08": "es",
  "09": "go",
  "10": "ma",
  "11": "mt",
  "12": "ms",
  "13": "mg",
  "14": "pa",
  "15": "pb",
  "16": "pr",
  "17": "pe",
  "18": "pi",
  "19": "rj",
  "20": "rn",
  "21": "rs",
  "22": "ro",
  "23": "rr",
  "24": "sc",
  "25": "se",
  "26": "sp",
  "27": "to",
};

const federalTribunals = ["trf1", "trf2", "trf3", "trf4", "trf5", "trf6"];
const laborTribunals = ["tst", ...Array.from({ length: 24 }, (_, index) => `trt${index + 1}`)];
const electoralTribunals = ["tse", ...Object.values(stateUfByCode).map((uf) => `tre-${uf}`)];
const stateTribunals = Object.values(stateByCode);
const militaryTribunals = ["stm"];
const stateMilitaryTribunals = ["tjmmg", "tjmrs", "tjmsp"];

const commonSearchTribunals = [
  "tjsp",
  "tjrj",
  "tjmg",
  "tjrs",
  "tjpr",
  "tjsc",
  "tjba",
  "tjpe",
  "trf3",
  "trt2",
];

export function normalizeProcessNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function formatProcessNumber(value: string) {
  const digits = normalizeProcessNumber(value);
  if (digits.length !== 20) {
    return value;
  }
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
}

export function inferTribunalFromProcessNumber(value: string) {
  const digits = normalizeProcessNumber(value);
  if (digits.length !== 20) {
    return null;
  }

  const justice = digits.slice(13, 14);
  const courtCode = digits.slice(14, 16);

  if (justice === "3") {
    return "stj";
  }

  if (justice === "4") {
    return `trf${Number(courtCode)}`;
  }

  if (justice === "5") {
    if (courtCode === "00") {
      return "tst";
    }

    return `trt${Number(courtCode)}`;
  }

  if (justice === "6") {
    if (courtCode === "00") {
      return "tse";
    }

    const uf = stateUfByCode[courtCode];
    return uf ? `tre-${uf}` : null;
  }

  if (justice === "7") {
    return "stm";
  }

  if (justice === "8") {
    return stateByCode[courtCode] ?? null;
  }

  if (justice === "9") {
    return {
      "13": "tjmmg",
      "21": "tjmrs",
      "26": "tjmsp",
    }[courtCode] ?? null;
  }

  return null;
}

export function getTribunalLabel(id: string) {
  return tribunals.find((tribunal) => tribunal.id === id)?.label ?? id.toUpperCase();
}

export function resolveTribunals(request: SearchRequest) {
  if (request.tribunal === "auto") {
    const inferred = request.mode === "number" ? inferTribunalFromProcessNumber(request.query) : null;
    return inferred ? [inferred] : commonSearchTribunals;
  }

  if (request.tribunal === "common") {
    return commonSearchTribunals;
  }

  if (request.tribunal === "all") {
    return allTribunalIds;
  }

  return [request.tribunal];
}

export function resolveNumberFallbackTribunals(request: SearchRequest, alreadySearched: string[]) {
  if (request.mode !== "number") {
    return [];
  }

  const digits = normalizeProcessNumber(request.query);
  if (digits.length !== 20) {
    return [];
  }

  const justice = digits.slice(13, 14);
  const group = {
    "3": ["stj"],
    "4": federalTribunals,
    "5": laborTribunals,
    "6": electoralTribunals,
    "7": militaryTribunals,
    "8": stateTribunals,
    "9": stateMilitaryTribunals,
  }[justice] ?? allTribunalIds;

  return group.filter((tribunal) => !alreadySearched.includes(tribunal));
}

export function buildDataJudQuery(request: SearchRequest) {
  const limit = Math.min(Math.max(request.limit ?? 10, 1), 25);

  if (request.mode === "number") {
    const digits = normalizeProcessNumber(request.query);
    return {
      size: limit,
      query: {
        match: {
          numeroProcesso: digits,
        },
      },
    };
  }

  return {
    size: limit,
    query: {
      bool: {
        should: [
          {
            multi_match: {
              query: request.query,
              type: "phrase",
              fields: [
                "partes.nome^5",
                "partes.pessoa.nome^5",
                "poloAtivo.nome^4",
                "poloPassivo.nome^4",
                "poloAtivo.pessoa.nome^4",
                "poloPassivo.pessoa.nome^4",
              ],
            },
          },
          {
            multi_match: {
              query: request.query,
              operator: "and",
              fields: [
                "classe.nome",
                "assuntos.nome",
                "orgaoJulgador.nome",
                "movimentos.nome",
              ],
            },
          },
        ],
        minimum_should_match: 1,
      },
    },
    sort: [{ dataAjuizamento: { order: "desc", unmapped_type: "date" } }],
  };
}

export function mapDataJudHit(hit: { _id?: string; _source?: Record<string, unknown> }, tribunal: string) {
  const source = hit._source ?? {};
  const assuntos = Array.isArray(source.assuntos) ? source.assuntos : [];
  const movimentos = Array.isArray(source.movimentos) ? source.movimentos : [];
  const classe = asRecord(source.classe);
  const orgaoJulgador = asRecord(source.orgaoJulgador);
  const sistema = asRecord(source.sistema);
  const principal = assuntos.find((item) => asRecord(item).principal === true) ?? assuntos[0];

  return {
    id: `${tribunal}-${String(source.numeroProcesso ?? hit._id ?? crypto.randomUUID())}`,
    numeroProcesso: formatProcessNumber(String(source.numeroProcesso ?? "")),
    tribunal: String(source.tribunal ?? tribunal.toUpperCase()),
    tribunalLabel: getTribunalLabel(tribunal),
    grau: stringValue(source.grau),
    classe: stringValue(classe.nome),
    assuntoPrincipal: stringValue(asRecord(principal).nome),
    dataAjuizamento: stringValue(source.dataAjuizamento),
    orgaoJulgador: stringValue(orgaoJulgador.nome),
    sistema: stringValue(sistema.nome),
    nivelSigilo: typeof source.nivelSigilo === "number" ? source.nivelSigilo : undefined,
    movimentos: movimentos
      .map((movimento) => {
        const item = asRecord(movimento);
        return {
          nome: stringValue(item.nome) ?? "Movimento processual",
          dataHora: stringValue(item.dataHora),
          complemento: extractMovementComplement(item),
        };
      })
      .filter((movimento) => movimento.nome)
      .sort((a, b) => String(b.dataHora ?? "").localeCompare(String(a.dataHora ?? "")))
      .slice(0, 12),
    fonte: `DataJud/CNJ - ${tribunal}`,
    raw: source,
  } satisfies ProcessoResumo;
}

function extractMovementComplement(item: Record<string, unknown>) {
  const complementos = item.complementosTabelados;
  if (!Array.isArray(complementos)) {
    return undefined;
  }

  return complementos
    .map((complemento) => {
      const record = asRecord(complemento);
      return stringValue(record.nome) ?? stringValue(record.descricao);
    })
    .filter(Boolean)
    .join(", ");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
