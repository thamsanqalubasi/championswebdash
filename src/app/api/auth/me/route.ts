import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ authenticated: false });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await verifySessionToken(token, sessionSecret);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
    },
  });
}
