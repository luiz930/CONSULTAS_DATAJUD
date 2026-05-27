export type PlanId = "free" | "pro" | "office";

export type UsageFeature = "searches" | "pjeDetails" | "aiExplanations";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  limits: Record<UsageFeature, number>;
  features: {
    ai: boolean;
    history: boolean;
    monitoring: boolean;
    team: boolean;
    admin: boolean;
  };
};

export const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Grátis",
    price: "R$ 0",
    description: "Para testar consultas pontuais com limite diário.",
    limits: {
      searches: 5,
      pjeDetails: 5,
      aiExplanations: 0,
    },
    features: {
      ai: false,
      history: false,
      monitoring: false,
      team: false,
      admin: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "R$ 49/mês",
    description: "Para usuários recorrentes que precisam de IA, histórico e monitoramento.",
    limits: {
      searches: 100,
      pjeDetails: 100,
      aiExplanations: 100,
    },
    features: {
      ai: true,
      history: true,
      monitoring: true,
      team: false,
      admin: false,
    },
  },
  office: {
    id: "office",
    name: "Escritório",
    price: "R$ 199/mês",
    description: "Para escritórios com alto volume, equipe e painel administrativo.",
    limits: {
      searches: 1000,
      pjeDetails: 1000,
      aiExplanations: 1000,
    },
    features: {
      ai: true,
      history: true,
      monitoring: true,
      team: true,
      admin: true,
    },
  },
};

export function getPlan(planId: PlanId) {
  return plans[planId] ?? plans.free;
}

