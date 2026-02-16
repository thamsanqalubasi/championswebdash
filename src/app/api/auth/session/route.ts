import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

export async function GET(request: Request) {
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ authenticated: false });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await verifySessionToken(token, sessionSecret);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      sub: session.sub,
      email: session.email,
      exp: session.exp,
    },
  });
}
