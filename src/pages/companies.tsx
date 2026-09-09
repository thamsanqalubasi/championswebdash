import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Building,
  Plus,
  Edit2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Globe,
} from "lucide-react";
import { fetchCompanies, createCompany } from "@/lib/data";
import type { Company } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export default function CompaniesPage() {
  const { isSuperAdmin, setCurrentCompany, currentCompany } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxRate, setTaxRate] = useState(15.0);
  const [currency, setCurrency] = useState("ZAR");
  const [paymentInstructions, setPaymentInstructions] = useState("");

  const loadData = async () => {
    setLoading(true);
    const data = await fetchCompanies();
    setCompanies(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    await createCompany({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      address,
      phone,
      email,
      taxRate,
      currency,
      paymentInstructions,
    });

    setModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Multi-Company / Organization Network
          </h1>
          <p className="text-sm text-muted">
            WordPress-style multisite property management. Manage separate commercial client companies, dedicated portals, and logos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/signup"
            className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-500/20 transition"
          >
            <Sparkles size={16} className="text-amber-500" />
            <span>Public Signup Form</span>
          </Link>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setName("");
                setSlug("");
                setAddress("");
                setPhone("");
                setEmail("");
                setTaxRate(15.0);
                setCurrency("ZAR");
                setPaymentInstructions("");
                setModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Plus size={18} />
              <span>Create Organization</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => {
          const isCurrent = c.id === currentCompany.id;
          return (
            <div
              key={c.id}
              className={`rounded-2xl border bg-surface p-6 shadow-sm space-y-4 transition ${
                isCurrent ? "border-blue-600 ring-2 ring-blue-600/20" : "border-border-color"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {c.logoUrl ? (
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border-color bg-surface-elevated p-1">
                      <img src={c.logoUrl} alt={c.name} className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 font-black text-lg">
                      {c.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted font-mono">{c.slug}</p>
                  </div>
                </div>

                {isCurrent && (
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 uppercase">
                    Active Org
                  </span>
                )}
              </div>

              {/* Dedicated Portal URL preview */}
              <div className="rounded-xl border border-border-color bg-surface-elevated/60 p-2.5 text-[11px] flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-muted block text-[10px] uppercase font-bold">Portal URL</span>
                  <span className="font-mono text-blue-600 font-semibold truncate block">
                    /c/{c.slug || c.id}/login
                  </span>
                </div>
                <a
                  href={`/c/${c.slug || c.id}/login`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-border-color px-2 py-1 text-[10px] font-bold text-muted hover:text-foreground hover:bg-surface-elevated"
                >
                  <ExternalLink size={11} />
                  <span>Open</span>
                </a>
              </div>

              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-muted" />
                  <span className="truncate">{c.address || "Address unconfigured"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-muted" />
                  <span>{c.phone || "No phone listed"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-muted" />
                  <span>{c.email || "No email listed"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-color pt-3">
                <span className="text-xs font-semibold text-foreground">
                  Tax: {c.taxRate}% · {c.currency}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentCompany(c)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    isCurrent
                      ? "bg-surface-elevated text-muted cursor-default"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isCurrent ? "Current Context" : "Switch Context"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Company Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="text-base font-bold text-foreground">Create New Organization</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Company Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Royal Cape Hotels"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Slug / URL Key</label>
                  <input
                    type="text"
                    placeholder="royal-cape-hotels"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">Headquarters Address</label>
                <input
                  type="text"
                  placeholder="Street, City, Country"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+27 11 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Contact Email</label>
                  <input
                    type="email"
                    placeholder="info@company.co.za"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Default Tax Rate (%)</label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Operating Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-border-color px-3.5 py-1.5 text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Register Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

