"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  ClipboardList,
  CreditCard,
  FileSearch,
  Filter,
  Gavel,
  History,
  ExternalLink,
  KeyRound,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundSearch,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatProcessNumber,
  ProcessoMovimento,
  ProcessoResumo,
  SearchMode,
  SearchResponse,
  tribunals,
} from "@/lib/datajud";

type HistoryItem = {
  mode: SearchMode;
  query: string;
  tribunal: string;
  createdAt: string;
};

type ViewMode = "simple" | "complete";

type PjeDetailsResponse =
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

type AiExplanation = {
  provider: "openai" | "local";
  title: string;
  plainLanguage: string;
  meaning: string;
  nextStep: string;
  caution: string;
  account?: Account;
};

type PlanId = "free" | "pro" | "office";

type PlanDetails = {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  limits: {
    searches: number;
    pjeDetails: number;
    aiExplanations: number;
  };
  features: {
    ai: boolean;
    history: boolean;
    monitoring: boolean;
    team: boolean;
    admin: boolean;
  };
};

type Account = {
  id: string;
  name: string;
  email: string;
  plan: PlanId;
  usage: {
    date: string;
    searches: number;
    pjeDetails: number;
    aiExplanations: number;
  };
  rewardCredits: {
    aiExplanations: number;
    monitoring: number;
  };
  createdAt: string;
  planDetails: PlanDetails;
};

type SearchApiResponse = SearchResponse & {
  account?: Account;
};

type AuthMode = "login" | "register";

type AlertSubscription = {
  id: string;
  processNumber: string;
  tribunalLabel?: string;
  emailEnabled: boolean;
  siteEnabled: boolean;
  active: boolean;
  createdAt: string;
};

type SiteNotification = {
  id: string;
  alertId?: string;
  processNumber?: string;
  title: string;
  message: string;
  read: boolean;
  emailStatus?: string;
  createdAt: string;
};

type AlertsPayload = {
  alerts: AlertSubscription[];
  notifications: SiteNotification[];
  account?: Account;
};

type RewardKind = "ai" | "monitoring";

const tribunalGroups = Array.from(new Set(tribunals.map((tribunal) => tribunal.group)));
const historyKey = "consultaJudicialHistorico";
const emptyHistory: HistoryItem[] = [];
const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const sidebarAdSlot = process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT;
const contentAdSlot = process.env.NEXT_PUBLIC_ADSENSE_CONTENT_SLOT;
const planCatalog: PlanDetails[] = [
  {
    id: "free",
    name: "Grátis",
    price: "R$ 0",
    description: "Para testar consultas pontuais.",
    limits: { searches: 5, pjeDetails: 5, aiExplanations: 0 },
    features: { ai: false, history: false, monitoring: false, team: false, admin: false },
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 49/mês",
    description: "Para consultar mais, explicar movimentações com IA e monitorar processos.",
    limits: { searches: 100, pjeDetails: 100, aiExplanations: 100 },
    features: { ai: true, history: true, monitoring: true, team: false, admin: false },
  },
  {
    id: "office",
    name: "Escritório",
    price: "R$ 199/mês",
    description: "Para alto volume, equipe, alertas e painel administrativo.",
    limits: { searches: 1000, pjeDetails: 1000, aiExplanations: 1000 },
    features: { ai: true, history: true, monitoring: true, team: true, admin: true },
  },
];

export default function Home() {
  const [mode, setMode] = useState<SearchMode>("number");
  const [viewMode, setViewMode] = useState<ViewMode>("simple");
  const [query, setQuery] = useState("");
  const [tribunal, setTribunal] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<ProcessoResumo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(emptyHistory);
  const [historyReady, setHistoryReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState<PlanId | "">("");
  const [alerts, setAlerts] = useState<AlertSubscription[]>([]);
  const [notifications, setNotifications] = useState<SiteNotification[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [rewardAd, setRewardAd] = useState<RewardKind | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistory(readStoredHistory());
      setHistoryReady(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user: Account | null }) => setCurrentUser(data.user))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadAlerts();
    }
  }, [currentUser]);

  const selectedResult = selected ?? response?.results[0] ?? null;
  const hasResults = Boolean(response?.results.length);

  const placeholder = useMemo(() => {
    if (mode === "number") {
      return "0000000-00.0000.0.00.0000";
    }

    return "Nome completo da parte ou empresa";
  }, [mode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setError("Faça login para consultar processos.");
      return;
    }

    setLoading(true);
    setError("");
    setResponse(null);
    setSelected(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query, tribunal, viewMode, limit: 20 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "Não foi possível concluir a consulta.");
      }

      const searchData = data as SearchApiResponse;
      setResponse(searchData);
      if (searchData.account) {
        setCurrentUser(searchData.account);
      }
      rememberSearch({ mode, query, tribunal, createdAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado na consulta.");
    } finally {
      setLoading(false);
    }
  }

  function rememberSearch(item: HistoryItem) {
    const next = [
      item,
      ...history.filter(
        (entry) =>
          `${entry.mode}-${entry.query}-${entry.tribunal}` !==
          `${item.mode}-${item.query}-${item.tribunal}`,
      ),
    ].slice(0, 8);
    window.localStorage.setItem(historyKey, JSON.stringify(next));
    setHistory(next);
  }

  function reuseHistory(item: HistoryItem) {
    setMode(item.mode);
    setQuery(item.query);
    setTribunal(item.tribunal);
  }

  async function loadAlerts() {
    setAlertsLoading(true);

    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as AlertsPayload;
      setAlerts(data.alerts ?? []);
      setNotifications(data.notifications ?? []);
    } finally {
      setAlertsLoading(false);
    }
  }

  async function markNotificationsRead() {
    const res = await fetch("/api/notifications", { method: "PATCH" });
    if (!res.ok) {
      return;
    }

    const data = (await res.json()) as { notifications: SiteNotification[] };
    setNotifications(data.notifications ?? []);
  }

  function applyAlertsPayload(payload: Partial<AlertsPayload>) {
    if (payload.account) {
      setCurrentUser(payload.account);
    }

    if (payload.alerts) {
      setAlerts(payload.alerts);
    }

    if (payload.notifications) {
      setNotifications(payload.notifications);
    }
  }

  async function completeRewardAd(reward: RewardKind) {
    const res = await fetch("/api/ads/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reward }),
    });
    const data = (await res.json()) as { user?: Account; message?: string };

    if (!res.ok || !data.user) {
      throw new Error(data.message ?? "Não foi possível liberar a recompensa.");
    }

    setCurrentUser(data.user);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });
      const data = (await res.json()) as { user?: Account; message?: string };

      if (!res.ok || !data.user) {
        throw new Error(data.message ?? "Não foi possível autenticar.");
      }

      setCurrentUser(data.user);
      setAuthPassword("");
      setAuthName("");
      setError("");
      loadAlerts();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Erro inesperado no login.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setResponse(null);
    setSelected(null);
    setAlerts([]);
    setNotifications([]);
  }

  async function upgradePlan(plan: PlanId) {
    if (!currentUser) {
      setAuthMode("register");
      setAuthError("Crie sua conta para escolher um plano.");
      return;
    }

    setUpgradeLoading(plan);
    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { user?: Account; message?: string };

      if (!res.ok || !data.user) {
        throw new Error(data.message ?? "Não foi possível alterar o plano.");
      }

      setCurrentUser(data.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro inesperado no upgrade.");
    } finally {
      setUpgradeLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3ee] text-slate-950">
      {rewardAd ? (
        <RewardAdModal
          reward={rewardAd}
          onClose={() => setRewardAd(null)}
          onComplete={completeRewardAd}
        />
      ) : null}

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-slate-950 text-white">
              <Gavel size={22} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                Consulta Judicial
              </p>
              <h1 className="text-2xl font-semibold">Painel de processos públicos</h1>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 md:grid-cols-4">
            <StatusPill icon={<ShieldCheck size={16} />} label="DataJud/CNJ" />
            <StatusPill icon={<Lock size={16} />} label="LGPD" />
            <StatusPill icon={<Bell size={16} />} label="Alertas" />
            <a
              href="/precos"
              className="flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-2"
            >
              <CreditCard size={16} aria-hidden />
              Preços
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[420px_1fr]">
        <aside className="space-y-5">
          {!authReady ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="animate-spin" size={16} />
                Verificando sessão...
              </div>
            </section>
          ) : null}

          {authReady && !currentUser ? (
            <AuthPanel
              mode={authMode}
              name={authName}
              email={authEmail}
              password={authPassword}
              loading={authLoading}
              error={authError}
              onModeChange={(nextMode) => {
                setAuthMode(nextMode);
                setAuthError("");
              }}
              onNameChange={setAuthName}
              onEmailChange={setAuthEmail}
              onPasswordChange={setAuthPassword}
              onSubmit={submitAuth}
            />
          ) : null}

          {authReady && currentUser ? (
            <>
              <UserAccountPanel
                user={currentUser}
                upgradeLoading={upgradeLoading}
                onLogout={logout}
                onUpgrade={upgradePlan}
                onWatchAd={setRewardAd}
              />
              <DiscreetAdSlot
                title="Publicidade"
                text="Espaço reservado para anúncio discreto. Usuários pagos podem ter menos anúncios."
                slot={sidebarAdSlot}
                variant="sidebar"
              />
              <SiteAlertsPanel
                alerts={alerts}
                notifications={notifications}
                loading={alertsLoading}
                onMarkRead={markNotificationsRead}
                onRefresh={loadAlerts}
                onAlertsChange={applyAlertsPayload}
              />
          <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Search size={20} aria-hidden />
                Nova consulta
              </h2>
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                MVP
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("number")}
                className={`flex h-10 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
                  mode === "number" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
                }`}
              >
                <FileSearch size={16} aria-hidden />
                Número
              </button>
              <button
                type="button"
                onClick={() => setMode("name")}
                className={`flex h-10 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
                  mode === "name" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
                }`}
              >
                <UserRoundSearch size={16} aria-hidden />
                Nome
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tipo de consulta
            </label>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode("simple")}
                className={`flex h-10 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
                  viewMode === "simple" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
                }`}
              >
                <ListChecks size={16} aria-hidden />
                Simplificada
              </button>
              <button
                type="button"
                onClick={() => setViewMode("complete")}
                className={`flex h-10 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
                  viewMode === "complete" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
                }`}
              >
                <ClipboardList size={16} aria-hidden />
                Completa
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-700">
              {mode === "number" ? "Número CNJ do processo" : "Nome completo"}
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="mb-4 h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />

            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tribunal
            </label>
            <div className="relative mb-4">
              <Filter
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <select
                value={tribunal}
                onChange={(event) => setTribunal(event.target.value)}
                className="h-12 w-full appearance-none rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              >
                <option value="auto">Detectar automaticamente</option>
                <option value="common">Buscar nos principais tribunais</option>
                <option value="all">Buscar em todos os tribunais</option>
                {tribunalGroups.map((group) => (
                  <optgroup key={group} label={group}>
                    {tribunals
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Consultar processos
            </button>

            {error && (
              <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle size={18} aria-hidden />
                <span>{error}</span>
              </div>
            )}
          </form>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <History size={20} aria-hidden />
              Histórico local
            </h2>
            <div className="space-y-2">
              {!historyReady ? (
                <p className="text-sm text-slate-600">
                  Carregando histórico local.
                </p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-600">
                  As consultas feitas neste navegador aparecem aqui.
                </p>
              ) : (
                history.map((item) => (
                  <button
                    type="button"
                    key={`${item.mode}-${item.query}-${item.createdAt}`}
                    onClick={() => reuseHistory(item)}
                    className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-teal-700 hover:bg-teal-50"
                  >
                    <span className="block font-medium text-slate-900">
                      {item.mode === "number" ? formatProcessNumber(item.query) : item.query}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.mode === "number" ? "Número" : "Nome"} - {item.tribunal}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
            </>
          ) : null}
        </aside>

        <section className="space-y-5">
          {!currentUser ? (
            <>
              <DiscreetAdSlot
                title="Apoio"
                text="Anúncios discretos ajudam a manter consultas gratuitas para usuários eventuais."
                slot={contentAdSlot}
                variant="content"
              />
              <PricingSection currentUser={currentUser} onUpgrade={upgradePlan} upgradeLoading={upgradeLoading} />
            </>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Metric icon={<Building2 size={18} />} label="Tribunais consultados" value={String(response?.searchedTribunals.length ?? 0)} />
            <Metric icon={<CheckCircle2 size={18} />} label="Resultados" value={String(response?.results.length ?? 0)} />
            <Metric icon={<Clock3 size={18} />} label="Tempo" value={response ? `${response.elapsedMs} ms` : "--"} />
          </div>

          {response?.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {response.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Resultados</h2>
              {!response && !loading ? (
                <EmptyState />
              ) : null}
              {loading ? (
                <div className="flex min-h-80 items-center justify-center text-slate-600">
                  <Loader2 className="mr-2 animate-spin" size={20} />
                  Consultando fontes oficiais...
                </div>
              ) : null}
              {response && !hasResults ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Nenhum processo público foi encontrado para os filtros informados.
                </div>
              ) : null}
              <div className="space-y-3">
                {response?.results.map((processo) => (
                  <button
                    type="button"
                    key={processo.id}
                    onClick={() => setSelected(processo)}
                    className={`block w-full rounded-md border p-3 text-left transition ${
                      selectedResult?.id === processo.id
                        ? "border-teal-700 bg-teal-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-950">
                      {processo.numeroProcesso || "Número não informado"}
                    </span>
                    <span className="mt-1 block text-xs font-medium uppercase text-teal-700">
                      {processo.tribunalLabel}
                    </span>
                    <span className="mt-2 block text-sm text-slate-700">
                      {processo.classe ?? "Classe não informada"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <ProcessPanel
              processo={selectedResult}
              viewMode={viewMode}
              onAlertsChange={applyAlertsPayload}
              onAccountChange={setCurrentUser}
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function DiscreetAdSlot({
  title,
  text,
  slot,
  variant,
}: {
  title: string;
  text: string;
  slot?: string;
  variant: "sidebar" | "content";
}) {
  const configured = Boolean(adsenseClient && slot);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const win = window as Window & { adsbygoogle?: unknown[] };
    win.adsbygoogle = win.adsbygoogle ?? [];
    win.adsbygoogle.push({});
  }, [configured, slot]);

  return (
    <aside className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-600">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
          {configured ? "adsense" : "fallback"}
        </span>
      </div>
      {configured ? (
        <ins
          className="adsbygoogle block min-h-24 w-full"
          style={{ display: "block" }}
          data-ad-client={adsenseClient}
          data-ad-slot={slot}
          data-ad-format={variant === "content" ? "auto" : "rectangle"}
          data-full-width-responsive="true"
        />
      ) : (
        <p>{text}</p>
      )}
      {configured ? (
        <p className="mt-2 text-xs text-slate-500">
          Se o bloco ficar vazio, confira aprovação do site, bloqueador de anúncios e preenchimento da rede.
        </p>
      ) : null}
    </aside>
  );
}

function RewardAdModal({
  reward,
  onClose,
  onComplete,
}: {
  reward: RewardKind;
  onClose: () => void;
  onComplete: (reward: RewardKind) => Promise<void>;
}) {
  const [seconds, setSeconds] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rewardLabel = reward === "ai" ? "uma explicação por IA" : "um monitoramento de processo";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function finishReward() {
    setLoading(true);
    setError("");

    try {
      await onComplete(reward);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível liberar o crédito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
      <section className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              Anúncio recompensado
            </p>
            <h2 className="text-lg font-semibold">Desbloquear recurso avulso</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-slate-300 px-2 text-sm text-slate-700"
          >
            Fechar
          </button>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm font-medium text-slate-900">Publicidade</p>
          <p className="mt-2 text-sm text-slate-600">
            Espaço preparado para vídeo/anúncio real da rede escolhida.
          </p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{seconds}s</p>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Ao concluir, sua conta recebe crédito para {rewardLabel}.
        </p>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={finishReward}
          disabled={seconds > 0 || loading}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
          {seconds > 0 ? "Assistindo anúncio" : "Liberar crédito"}
        </button>
      </section>
    </div>
  );
}

function AuthPanel({
  mode,
  name,
  email,
  password,
  loading,
  error,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  loading: boolean;
  error: string;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserRound size={20} aria-hidden />
          Acesso do usuário
        </h2>
        <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-900">
          Obrigatório
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onModeChange("login")}
          className={`h-10 rounded px-3 text-sm font-medium transition ${
            mode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => onModeChange("register")}
          className={`h-10 rounded px-3 text-sm font-medium transition ${
            mode === "register" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
          }`}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Nome</label>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              placeholder="Seu nome"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            placeholder="voce@email.com"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:bg-slate-400"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
          {mode === "login" ? "Entrar e consultar" : "Criar conta grátis"}
        </button>
      </form>

      {error ? (
        <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={18} aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  );
}

function UserAccountPanel({
  user,
  upgradeLoading,
  onLogout,
  onUpgrade,
  onWatchAd,
}: {
  user: Account;
  upgradeLoading: PlanId | "";
  onLogout: () => void;
  onUpgrade: (plan: PlanId) => void;
  onWatchAd: (reward: RewardKind) => void;
}) {
  const plan = user.planDetails;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Conta ativa</p>
          <h2 className="truncate text-lg font-semibold">{user.name}</h2>
          <p className="truncate text-sm text-slate-600">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
        >
          <LogOut size={16} aria-hidden />
          Sair
        </button>
      </div>

      <div className="grid gap-2 text-sm">
        <MiniMetric label="Plano" value={plan.name} />
        <MiniMetric label="Consultas hoje" value={`${user.usage.searches}/${plan.limits.searches}`} />
        <MiniMetric label="IA hoje" value={`${user.usage.aiExplanations}/${plan.limits.aiExplanations}`} />
        <MiniMetric
          label="Créditos anúncio"
          value={`IA ${user.rewardCredits.aiExplanations} · Monitor ${user.rewardCredits.monitoring}`}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onWatchAd("ai")}
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700"
        >
          <Sparkles size={14} aria-hidden />
          Ver anúncio para IA
        </button>
        <button
          type="button"
          onClick={() => onWatchAd("monitoring")}
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700"
        >
          <Bell size={14} aria-hidden />
          Ver anúncio para alerta
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {planCatalog
          .filter((item) => item.id !== user.plan)
          .slice(0, 2)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUpgrade(item.id)}
              disabled={Boolean(upgradeLoading)}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:bg-slate-400"
            >
              {upgradeLoading === item.id ? <Loader2 className="animate-spin" size={14} /> : <CreditCard size={14} />}
              {item.id === "free" ? "Voltar grátis" : `Upgrade ${item.name}`}
            </button>
          ))}
      </div>
    </section>
  );
}

function SiteAlertsPanel({
  alerts,
  notifications,
  loading,
  onMarkRead,
  onRefresh,
  onAlertsChange,
}: {
  alerts: AlertSubscription[];
  notifications: SiteNotification[];
  loading: boolean;
  onMarkRead: () => void;
  onRefresh: () => void;
  onAlertsChange: (payload: Partial<AlertsPayload>) => void;
}) {
  const [testingAlert, setTestingAlert] = useState("");
  const unread = notifications.filter((notification) => !notification.read).length;

  async function testAlert(alertId: string) {
    setTestingAlert(alertId);

    try {
      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      const data = (await res.json()) as Partial<AlertsPayload> & { message?: string };

      if (res.ok) {
        onAlertsChange(data);
      }
    } finally {
      setTestingAlert("");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell size={20} aria-hidden />
            Alertas
          </h2>
          <p className="text-sm text-slate-600">
            {unread ? `${unread} notificação(ões) não lida(s)` : "Nenhuma notificação nova"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Carregando alertas...
        </div>
      ) : null}

      {!loading && alerts.length === 0 ? (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          Use o botão Monitorar em um processo para receber alertas no site e por e-mail.
        </p>
      ) : null}

      {alerts.length ? (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-950">{alert.processNumber}</p>
              <p className="text-xs text-slate-500">
                Site {alert.siteEnabled ? "ativo" : "inativo"} · E-mail{" "}
                {alert.emailEnabled ? "ativo" : "inativo"}
              </p>
              <button
                type="button"
                onClick={() => testAlert(alert.id)}
                disabled={Boolean(testingAlert)}
                className="mt-2 flex h-8 items-center gap-2 rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 disabled:opacity-60"
              >
                {testingAlert === alert.id ? <Loader2 className="animate-spin" size={14} /> : <Bell size={14} />}
                Testar alerta
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {notifications.length ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Notificações do site</h3>
            <button
              type="button"
              onClick={onMarkRead}
              className="text-xs font-medium text-teal-700"
            >
              Marcar lidas
            </button>
          </div>
          {notifications.slice(0, 5).map((notification) => (
            <div
              key={notification.id}
              className={`rounded-md p-3 text-sm ${
                notification.read ? "bg-slate-50 text-slate-600" : "bg-teal-50 text-teal-950"
              }`}
            >
              <p className="font-medium">{notification.title}</p>
              <p className="mt-1 text-xs">{notification.message}</p>
              {notification.emailStatus ? (
                <p className="mt-1 text-xs text-slate-500">E-mail: {notification.emailStatus}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PricingSection({
  currentUser,
  upgradeLoading,
  onUpgrade,
}: {
  currentUser: Account | null;
  upgradeLoading: PlanId | "";
  onUpgrade: (plan: PlanId) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Planos</p>
          <h2 className="text-xl font-semibold">Monetização por acesso e volume</h2>
        </div>
        <p className="max-w-xl text-sm text-slate-600">
          A consulta só é liberada após login. O upgrade abaixo está em modo MVP e já altera limites do usuário.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {planCatalog.map((plan) => (
          <div key={plan.id} className="rounded-md border border-slate-200 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-2xl font-semibold">{plan.price}</p>
              </div>
              {currentUser?.plan === plan.id ? (
                <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-900">
                  Atual
                </span>
              ) : null}
            </div>
            <p className="min-h-10 text-sm text-slate-600">{plan.description}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>{plan.limits.searches} consultas por dia</li>
              <li>{plan.features.ai ? "Explicação por IA" : "Sem IA no plano grátis"}</li>
              <li>{plan.features.monitoring ? "Monitoramento e alertas" : "Consulta manual"}</li>
              <li>{plan.features.team ? "Equipe e painel admin" : "Usuário individual"}</li>
            </ul>
            <button
              type="button"
              onClick={() => onUpgrade(plan.id)}
              disabled={currentUser?.plan === plan.id || Boolean(upgradeLoading)}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              {upgradeLoading === plan.id ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              {currentUser ? "Escolher plano" : "Criar conta"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function readStoredHistory() {
  if (typeof window === "undefined") {
    return emptyHistory;
  }

  const stored = window.localStorage.getItem(historyKey);
  if (!stored) {
    return emptyHistory;
  }

  try {
    return JSON.parse(stored) as HistoryItem[];
  } catch {
    return emptyHistory;
  }
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-2">
      {icon}
      {label}
    </span>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-600">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
      <FileSearch size={34} className="mb-3 text-slate-500" aria-hidden />
      <h3 className="text-base font-semibold">Pronto para consultar</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-600">
        Informe um número CNJ para a consulta mais precisa ou use nome completo com um tribunal definido.
      </p>
    </div>
  );
}

function ProcessPanel({
  processo,
  viewMode,
  onAlertsChange,
  onAccountChange,
}: {
  processo: ProcessoResumo | null;
  viewMode: ViewMode;
  onAlertsChange: (payload: Partial<AlertsPayload>) => void;
  onAccountChange: (account: Account) => void;
}) {
  if (!processo) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Detalhes do processo</h2>
        <p className="mt-3 text-sm text-slate-600">
          Selecione um resultado para visualizar capa processual, órgão julgador e movimentações.
        </p>
      </section>
    );
  }

  return (
    <ProcessPanelContent
      key={processo.id}
      processo={processo}
      viewMode={viewMode}
      onAlertsChange={onAlertsChange}
      onAccountChange={onAccountChange}
    />
  );
}

function ProcessPanelContent({
  processo,
  viewMode,
  onAlertsChange,
  onAccountChange,
}: {
  processo: ProcessoResumo;
  viewMode: ViewMode;
  onAlertsChange: (payload: Partial<AlertsPayload>) => void;
  onAccountChange: (account: Account) => void;
}) {
  const [enrichedProcess, setEnrichedProcess] = useState<ProcessoResumo | null>(null);
  const [captcha, setCaptcha] = useState<{ tokenDesafio: string; imagem: string; message: string } | null>(
    null,
  );
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [explanationError, setExplanationError] = useState("");
  const [explanationLoadingKey, setExplanationLoadingKey] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorMessage, setMonitorMessage] = useState("");
  const [monitorError, setMonitorError] = useState("");
  const activeProcess = enrichedProcess ?? processo;

  if (viewMode === "simple") {
    return <SimpleProcessPanel processo={activeProcess} />;
  }

  async function loadPjeDetails(answer?: string) {
    if (!activeProcess.pje) {
      return;
    }

    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await fetch("/api/pje/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tribunal: activeProcess.pje.tribunal,
          processId: activeProcess.pje.processId,
          instancia: activeProcess.pje.instancia,
          tokenDesafio: captcha?.tokenDesafio,
          resposta: answer,
        }),
      });
      const data = (await response.json()) as PjeDetailsResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in data ? data.message : "Falha ao consultar detalhes do PJe.");
      }

      if ("status" in data && data.status === "captcha") {
        setCaptcha({
          tokenDesafio: data.tokenDesafio,
          imagem: data.imagem,
          message: data.message,
        });
        return;
      }

      if ("status" in data && data.status === "ok") {
        setEnrichedProcess({
          ...activeProcess,
          ...data.processo,
          movimentos: data.movimentos.length ? data.movimentos : activeProcess.movimentos,
          raw: { ...activeProcess.raw, detalhesPje: data.raw },
          detailsLocked: false,
        });
        setCaptcha(null);
        setCaptchaAnswer("");
      }
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "Erro inesperado ao carregar detalhes.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function explainItem({
    key,
    kind,
    title,
    date,
    complement,
  }: {
    key: string;
    kind: "movement" | "document";
    title: string;
    date?: string;
    complement?: string;
  }) {
    setExplanationLoadingKey(key);
    setExplanationError("");

    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          date,
          complement,
          process: {
            number: activeProcess.numeroProcesso,
            tribunal: activeProcess.tribunalLabel,
            className: activeProcess.classe,
            subject: activeProcess.assuntoPrincipal,
          },
        }),
      });
      const data = (await response.json()) as AiExplanation | { message?: string };

      if (!response.ok) {
        throw new Error("message" in data ? data.message : "Falha ao explicar o item.");
      }

      if ("account" in data && data.account) {
        onAccountChange(data.account);
      }
      setExplanation(data as AiExplanation);
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : "Erro inesperado ao explicar o item.");
    } finally {
      setExplanationLoadingKey("");
    }
  }

  async function monitorProcess() {
    setMonitorLoading(true);
    setMonitorMessage("");
    setMonitorError("");

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processNumber: activeProcess.numeroProcesso,
          tribunalLabel: activeProcess.tribunalLabel,
          className: activeProcess.classe,
          subject: activeProcess.assuntoPrincipal,
          siteEnabled: true,
          emailEnabled: true,
        }),
      });
      const data = (await response.json()) as Partial<AlertsPayload> & {
        delivery?: { enabled: boolean; sent: boolean; message: string };
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível ativar o monitoramento.");
      }

      onAlertsChange(data);
      if (data.account) {
        setMonitorMessage(
          data.delivery?.sent
            ? "Monitoramento ativado no site e por e-mail."
            : `Monitoramento ativado no site. ${data.delivery?.message ?? ""}`.trim(),
        );
        return;
      }

      setMonitorMessage(
        data.delivery?.sent
          ? "Monitoramento ativado no site e por e-mail."
          : `Monitoramento ativado no site. ${data.delivery?.message ?? ""}`.trim(),
      );
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : "Erro inesperado ao ativar alerta.");
    } finally {
      setMonitorLoading(false);
    }
  }

  const documentItems = documentEntries(activeProcess.raw);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
          {activeProcess.fonte}
        </p>
        <h2 className="mt-1 text-xl font-semibold">{activeProcess.numeroProcesso}</h2>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MiniMetric label="Fonte" value={sourceKind(activeProcess)} />
        <MiniMetric
          label="Movimentações"
          value={activeProcess.movimentos.length ? String(activeProcess.movimentos.length) : "0"}
        />
        <MiniMetric
          label="Status"
          value={activeProcess.detailsLocked ? "Validação pendente" : "Aberto no site"}
        />
      </div>

      {activeProcess.detailsLocked && activeProcess.pje ? (
        <section className="mb-4 rounded-md border border-teal-200 bg-teal-50 p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-teal-950">Carregar movimentações pelo PJe</h3>
              <p className="mt-1 text-sm text-teal-900">
                O tribunal exige validação humana para liberar a linha do tempo completa. A validação
                aparece aqui e a consulta continua dentro do nosso site.
              </p>
            </div>
            {!captcha ? (
              <button
                type="button"
                onClick={() => loadPjeDetails()}
                disabled={detailsLoading}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {detailsLoading ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                Desbloquear detalhes
              </button>
            ) : null}
          </div>

          {captcha ? (
            <form
              className="mt-3 grid max-w-full gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                loadPjeDetails(captchaAnswer);
              }}
            >
              <Image
                src={`data:image/jpeg;base64,${captcha.imagem}`}
                alt="Captcha oficial do PJe"
                width={300}
                height={90}
                unoptimized
                className="h-[90px] w-full rounded-md border border-slate-300 bg-white object-contain"
              />
              <input
                value={captchaAnswer}
                onChange={(event) => setCaptchaAnswer(event.target.value)}
                placeholder="Digite os caracteres"
                className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              />
              <button
                type="submit"
                disabled={detailsLoading || captchaAnswer.trim().length === 0}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:bg-slate-400 sm:w-fit"
              >
                {detailsLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                Validar
              </button>
            </form>
          ) : null}

          {detailsError ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              {detailsError}
            </p>
          ) : null}
        </section>
      ) : null}

      {explanation || explanationError ? (
        <ExplanationPanel explanation={explanation} error={explanationError} />
      ) : null}

      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <Info label="Tribunal" value={activeProcess.tribunalLabel} />
        <Info label="Grau" value={activeProcess.grau} />
        <Info label="Classe" value={activeProcess.classe} />
        <Info label="Assunto" value={activeProcess.assuntoPrincipal} />
        <Info label="Órgão julgador" value={activeProcess.orgaoJulgador} />
        <Info label="Ajuizamento" value={formatDate(activeProcess.dataAjuizamento)} />
        <Info label="Sistema" value={activeProcess.sistema} />
        <Info label="Nível de sigilo" value={String(activeProcess.nivelSigilo ?? "Público")} />
      </dl>

      {activeProcess.movimentos.length === 0 && activeProcess.externalUrl ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          A fonte pública retornou a capa do processo. Para movimentações/documentos, use a validação
          do PJe acima ou o botão Tribunal.
        </div>
      ) : null}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Movimentações recentes</h3>
          <div className="flex gap-2">
            {activeProcess.externalUrl ? (
              <a
                href={activeProcess.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
              >
                <ExternalLink size={16} aria-hidden />
                Tribunal
              </a>
            ) : null}
            <button
              type="button"
              onClick={monitorProcess}
              disabled={monitorLoading}
              className="flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
              title="Ativa notificações dentro do site e por e-mail quando o SMTP estiver configurado."
            >
              {monitorLoading ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} aria-hidden />}
              Monitorar
            </button>
          </div>
        </div>

        {monitorMessage ? (
          <p className="mb-3 rounded-md border border-teal-200 bg-teal-50 p-2 text-sm text-teal-900">
            {monitorMessage}
          </p>
        ) : null}

        {monitorError ? (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            {monitorError}
          </p>
        ) : null}

        {activeProcess.movimentos.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Nenhuma movimentação retornada nesta consulta.
          </p>
        ) : (
          <ol className="space-y-3">
            {activeProcess.movimentos.map((movimento, index) => {
              const itemKey = `movement-${index}`;

              return (
                <li
                  key={`${movimento.nome}-${movimento.dataHora}-${index}`}
                  className="border-l-2 border-teal-700 pl-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-950">{movimento.nome}</p>
                      <p className="text-xs text-slate-500">{formatDate(movimento.dataHora)}</p>
                      {movimento.complemento ? (
                        <p className="mt-1 text-xs text-slate-600">{movimento.complemento}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        explainItem({
                          key: itemKey,
                          kind: "movement",
                          title: movimento.nome,
                          date: movimento.dataHora,
                          complement: movimento.complemento,
                        })
                      }
                      disabled={Boolean(explanationLoadingKey)}
                      className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 transition hover:border-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {explanationLoadingKey === itemKey ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Sparkles size={14} aria-hidden />
                      )}
                      Explicar
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-3">
        <h3 className="mb-3 text-sm font-semibold">Documentos e expedientes</h3>
        {documentItems.length ? (
          <div className="space-y-2">
            {documentItems.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex flex-col gap-2 rounded-md bg-slate-50 p-3 text-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    explainItem({
                      key: `document-${index}`,
                      kind: "document",
                      title: item.title,
                      date: item.date,
                    })
                  }
                  disabled={Boolean(explanationLoadingKey)}
                  className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 transition hover:border-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {explanationLoadingKey === `document-${index}` ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Sparkles size={14} aria-hidden />
                  )}
                  Explicar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            A fonte atual não retornou documentos públicos diretamente. Quando o tribunal exigir captcha,
            os documentos ficam condicionados à validação oficial.
          </p>
        )}
      </section>

      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 text-sm font-semibold">Dados técnicos retornados</h3>
        <dl className="grid gap-2 text-xs md:grid-cols-2">
          {rawEntries(activeProcess.raw).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-medium text-slate-500">{key}</dt>
              <dd className="truncate text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function SimpleProcessPanel({ processo }: { processo: ProcessoResumo }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
          Consulta simplificada
        </p>
        <h2 className="mt-1 text-xl font-semibold">{processo.numeroProcesso}</h2>
      </div>

      <div className="grid gap-3 text-sm">
        <Info label="Tribunal" value={processo.tribunalLabel} />
        <Info label="Classe" value={processo.classe} />
        <Info label="Grau" value={processo.grau} />
        <Info label="Sistema" value={processo.sistema} />
        <Info label="Fonte" value={processo.fonte} />
        <Info
          label="Situação da consulta"
          value={processo.movimentos.length > 0 ? "Movimentações disponíveis" : "Dados básicos encontrados"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {processo.externalUrl ? (
          <a
            href={processo.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
          >
            <ExternalLink size={16} aria-hidden />
            Abrir consulta oficial
          </a>
        ) : null}
        <span className="flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700">
          Troque para Completa para ver movimentações e dados técnicos.
        </span>
      </div>
    </section>
  );
}

function ExplanationPanel({
  explanation,
  error,
}: {
  explanation: AiExplanation | null;
  error: string;
}) {
  if (error) {
    return (
      <section className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {error}
      </section>
    );
  }

  if (!explanation) {
    return null;
  }

  return (
    <section className="mb-4 rounded-md border border-teal-200 bg-teal-50 p-3">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-teal-950">
          <Sparkles size={16} aria-hidden />
          Explicação da IA
        </h3>
        <span className="w-fit rounded-md border border-teal-300 bg-white px-2 py-1 text-xs font-medium text-teal-900">
          {explanation.provider === "openai" ? "OpenAI" : "Análise local"}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-950">{explanation.title}</p>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <Info label="Em linguagem simples" value={explanation.plainLanguage} />
        <Info label="O que pode significar" value={explanation.meaning} />
        <Info label="Próximo passo neutro" value={explanation.nextStep} />
      </div>
      <p className="mt-3 text-xs text-teal-950">{explanation.caution}</p>
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value || "Não informado"}</dd>
    </div>
  );
}

function rawEntries(raw: Record<string, unknown>) {
  return Object.entries(raw)
    .filter(([, value]) => typeof value !== "object" || value === null)
    .map(([key, value]) => [key, String(value ?? "Não informado")] as const)
    .slice(0, 12);
}

function sourceKind(processo: ProcessoResumo) {
  if (processo.fonte.toLowerCase().includes("pje")) {
    return "PJe";
  }

  if (processo.fonte.toLowerCase().includes("datajud")) {
    return "DataJud";
  }

  return "Oficial";
}

function documentEntries(raw: Record<string, unknown>) {
  const detailRaw = asRecord(raw.detalhesPje) || raw;
  const candidates = [
    detailRaw.itensProcesso,
    detailRaw.documentos,
    detailRaw.expedientes,
    raw.itensProcesso,
    raw.documentos,
    raw.expedientes,
  ].find(Array.isArray) as unknown[] | undefined;

  if (!candidates) {
    return [];
  }

  return candidates
    .flatMap((item) => {
      const record = asRecord(item);
      const anexos = Array.isArray(record.anexos) ? record.anexos : [];
      return [record, ...anexos.map(asRecord)];
    })
    .map((record) => ({
      title:
        stringValue(record.titulo) ??
        stringValue(record.descricao) ??
        stringValue(record.nome) ??
        stringValue(record.tipoDocumento) ??
        "Documento do processo",
      date:
        stringValue(record.dataJuntada) ??
        stringValue(record.criadoEm) ??
        stringValue(record.atualizadoEm) ??
        stringValue(record.dataHora),
    }))
    .slice(0, 12);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatDate(value?: string) {
  if (!value) {
    return "Não informado";
  }

  if (/^\d{14}$/.test(value)) {
    const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(normalized));
  }

  if (/^\d{8}$/.test(value)) {
    const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`;
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
    }).format(new Date(normalized));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(date);
}
