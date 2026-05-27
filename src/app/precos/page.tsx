import Link from "next/link";
import { CreditCard, Gavel } from "lucide-react";
import { plans } from "@/lib/plans";

const orderedPlans = [plans.free, plans.pro, plans.office];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] text-slate-950">
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
              <h1 className="text-2xl font-semibold">Planos e preços</h1>
            </div>
          </div>
          <Link
            href="/"
            className="flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            Entrar no painel
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5 max-w-3xl">
          <h2 className="text-2xl font-semibold">Monetização por acesso, volume e recursos</h2>
          <p className="mt-2 text-sm text-slate-700">
            O cadastro é obrigatório para consultar. O upgrade em produção deve ser conectado ao
            Mercado Pago ou Stripe pela rota de cobrança.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {orderedPlans.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-3xl font-semibold">{plan.price}</p>
                </div>
                <CreditCard className="text-teal-700" size={22} aria-hidden />
              </div>
              <p className="min-h-12 text-sm text-slate-600">{plan.description}</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <PlanLine label="Consultas por dia" value={String(plan.limits.searches)} />
                <PlanLine label="Detalhes PJe por dia" value={String(plan.limits.pjeDetails)} />
                <PlanLine label="Explicações IA por dia" value={String(plan.limits.aiExplanations)} />
                <PlanLine label="Monitoramento" value={plan.features.monitoring ? "Incluído" : "Não incluído"} />
                <PlanLine label="Equipe/admin" value={plan.features.team ? "Incluído" : "Não incluído"} />
              </dl>
              <Link
                href="/"
                className="mt-4 flex h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
              >
                Escolher no painel
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-950">{value}</dd>
    </div>
  );
}

