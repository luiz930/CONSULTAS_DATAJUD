import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { listUserNotifications, markUserNotificationsRead } from "@/lib/alerts";

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth.response;
  }

  return NextResponse.json({ notifications: await listUserNotifications(auth.user.id) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);

  if (!auth.user) {
    return auth.response;
  }

  return NextResponse.json({ notifications: await markUserNotificationsRead(auth.user.id) });
}

