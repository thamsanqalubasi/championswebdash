import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export default async function LoginPage() {
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (sessionSecret) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const session = await verifySessionToken(token, sessionSecret);
      if (session) {
        redirect("/dashboard");
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md space-y-4 rounded-lg border border-border-color bg-surface p-6">
        <header>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted">Use your admin account to access the dashboard.</p>
        </header>

        <LoginForm />
      </section>
    </main>
  );
}
