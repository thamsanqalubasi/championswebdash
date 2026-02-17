import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) {
    const nextPath = searchParams.get("next") || "/dashboard";
    return <Navigate to={nextPath} replace />;
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      const nextPath = searchParams.get("next") || "/dashboard";
      navigate(nextPath, { replace: true });
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md space-y-4 rounded-lg border border-border-color bg-surface p-6">
        <header>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted">
            Use your admin account to access the dashboard.
          </p>
        </header>

        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>

          {error && <p className="text-sm text-muted">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
