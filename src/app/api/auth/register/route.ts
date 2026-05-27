import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth";
import { createSession, createUser, publicUserWithPlan } from "@/lib/users";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
  } | null;

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  if (name.length < 2) {
    return NextResponse.json({ message: "Informe seu nome." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Informe um e-mail válido." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }

  try {
    const user = await createUser({ name, email, password });
    const session = await createSession(user.id);
    const response = NextResponse.json({ user: publicUserWithPlan(user) });
    setAuthCookie(response, session.token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível criar sua conta." },
      { status: 400 },
    );
  }
}

