import { NextRequest, NextResponse } from "next/server";
import { getPlan, PlanId, UsageFeature } from "@/lib/plans";
import {
  consumeUsage,
  deleteSession,
  getUserBySessionToken,
  PublicUser,
  publicUserWithPlan,
} from "@/lib/users";

export const authCookieName = "consulta_session";

export type AuthenticatedUser = PublicUser & {
  planDetails: ReturnType<typeof getPlan>;
};

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(authCookieName)?.value;
  const user = await getUserBySessionToken(token);
  return user ? publicUserWithPlan(user) : null;
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "Faça login para consultar processos." },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}

export async function consumeProtectedUsage(request: NextRequest, feature: UsageFeature) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth;
  }

  const result = await consumeUsage(auth.user.id, feature);
  if (!result.ok) {
    return {
      user: result.user ? publicUserWithPlan(result.user) : auth.user,
      response: NextResponse.json({ message: result.message }, { status: 402 }),
    };
  }

  return {
    user: result.user ? publicUserWithPlan(result.user) : auth.user,
    response: null,
  };
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthCookie(request: NextRequest, response: NextResponse) {
  await deleteSession(request.cookies.get(authCookieName)?.value);
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function isKnownPlan(plan: string): plan is PlanId {
  return plan === "free" || plan === "pro" || plan === "office";
}

