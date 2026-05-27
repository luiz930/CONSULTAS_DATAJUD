import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth";
import { createSession, publicUserWithPlan, verifyUserCredentials } from "@/lib/users";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const user = await verifyUserCredentials(email, password);

  if (!user) {
    return NextResponse.json({ message: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ user: publicUserWithPlan(user) });
  setAuthCookie(response, session.token);
  return response;
}

