import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { TermsCheckboxField } from "@/components/terms-modal";
import { sendEmailViaApi, wrapCustomerWelcomeEmailHtml } from "@/lib/notifications";
import { LogIn, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/40 transition pr-10"/>
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
    </div>
  );
}

function PasswordRules({ password }: { password: string }) {
  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Contains a number", ok: /\d/.test(password) },
    { label: "Contains a letter", ok: /[a-zA-Z]/.test(password) },
  ];
  return (
    <div className="space-y-1">
      {rules.map(r => (
        <div key={r.label} className={`flex items-center gap-2 text-xs ${r.ok ? "text-green-600" : "text-gray-400"}`}>
          <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${r.ok ? "border-green-500 bg-green-500" : "border-gray-300"}`}>{r.ok && <span className="text-white text-[8px]">✓</span>}</div>
          {r.label}
        </div>
      ))}
    </div>
  );
}

export default function PortalLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate("/portal/dashboard");
    } catch (err: any) { setError(err.message || "Login failed."); }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
    if (!/\d/.test(password)) { setError("Password must contain at least one number."); setLoading(false); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); setLoading(false); return; }
    if (!agreedToTerms) {
      setError("You must review and agree to the Platform Terms of Service to create an account.");
      setLoading(false);
      return;
    }
    try {
      const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (err) throw err;

      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://paimbabook.com";
        const emailHtml = wrapCustomerWelcomeEmailHtml({
          customerName: name || email,
          customerEmail: email,
          portalUrl: origin,
        });
        void sendEmailViaApi({
          to: email,
          subject: "Welcome to Paimbabook - Your Customer Account is Ready",
          html: emailHtml,
        });
      } catch (emailErr) {
        console.warn("Could not dispatch customer welcome email", emailErr);
      }

      setSuccess("Account created! Please check your email to confirm your account, then sign in.");
    } catch (err: any) { setError(err.message || "Signup failed."); }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8 sm:py-12 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white mb-4 shadow-xs">{mode === "login" ? <LogIn size={24}/> : <UserPlus size={24}/>}</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{mode === "login" ? "Welcome Back" : "Create Account"}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{mode === "login" ? "Sign in to view your enquiries and bookings" : "Join to book rooms and track enquiries"}</p>
          </div>

          {error && (<div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-700 dark:text-red-300"><AlertCircle size={15} className="mt-0.5 shrink-0"/>{error}</div>)}
          {success && (<div className="mb-4 flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900/50 p-3 text-sm text-green-700 dark:text-green-300"><CheckCircle size={15} className="mt-0.5 shrink-0"/>{success}</div>)}

          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (<input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/40 transition"/>)}
            <input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/40 transition"/>
            <PasswordInput value={password} onChange={setPassword} placeholder="Password"/>
            {mode === "signup" && (
              <>
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm password"/>
                <PasswordRules password={password}/>
                <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 p-3.5">
                  <TermsCheckboxField checked={agreedToTerms} onChange={setAgreedToTerms} />
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={loading || (mode === "signup" && !agreedToTerms)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition shadow-xs"
            >
              {mode === "login" ? <LogIn size={16}/> : <UserPlus size={16}/>}
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            {mode === "login" ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Don't have an account? <button onClick={() => setMode("signup")} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Create one</button></p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-slate-400">Already have an account? <button onClick={() => setMode("login")} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Sign in</button></p>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-6"><Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition font-medium">← Back to Listings</Link></p>
      </div>
    </div>
  );
}
