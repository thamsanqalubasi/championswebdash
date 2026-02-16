import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { issueSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

type LoginBody = {
  email?: string;
  password?: string;
};

const sevenDaysInSeconds = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sessionSecret = process.env.APP_SESSION_SECRET;

  if (!supabaseUrl || !supabaseAnonKey || !sessionSecret) {
    return NextResponse.json(
      {
        message:
          "Missing auth configuration. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and APP_SESSION_SECRET.",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  const token = await issueSessionToken(
    {
      sub: data.user.id,
      email: data.user.email ?? email,
    },
    sessionSecret,
    sevenDaysInSeconds,
  );

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sevenDaysInSeconds,
  });

  return response;
}
