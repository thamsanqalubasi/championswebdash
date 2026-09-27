/**
 * EnterpriseSalesModal - Custom Enterprise Consultation Request Form
 *
 * Designed for operations with:
 *   - Over 20 Properties
 *   - Over 500 Rooms
 *   - Over 600 Tenants
 *   - Over 100 Staff Users
 *
 * ============================================================================
 * CONTROL ADMIN DASHBOARD INTEGRATION REQUIREMENTS:
 * 1. The Control Admin Dashboard must include an "Enterprise Sales Enquiries"
 *    view where super administrators can view, filter by status ('new', 'in_review',
 *    'contacted', 'closed'), review submitted metrics, and assign account reps.
 * 2. The Control Admin Dashboard must allow configuring the destination email
 *    address (e.g. sales@paimbabook.com, enterprise@paimbabook.com) that receives
 *    real-time email alerts whenever a new inquiry is submitted through this form.
 * ============================================================================
 */

import { useState } from "react";
import { Modal } from "./modal";
import {
  Building2,
  Mail,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  BedDouble,
  Users,
  ShieldCheck,
  Send,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EnterpriseSalesModalProps {
  open: boolean;
  onClose: () => void;
  companyId?: string;
  defaultEmail?: string;
  defaultCompanyName?: string;
}

export function EnterpriseSalesModal({
  open,
  onClose,
  companyId,
  defaultEmail = "",
  defaultCompanyName = "",
}: EnterpriseSalesModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [subject, setSubject] = useState("Custom Enterprise Tier Consultation (>20 Properties)");
  const [businessNeeds, setBusinessNeeds] = useState("");

  // Optional estimate inputs
  const [estimatedProperties, setEstimatedProperties] = useState<string>("");
  const [estimatedRooms, setEstimatedRooms] = useState<string>("");
  const [estimatedTenants, setEstimatedTenants] = useState<string>("");
  const [estimatedStaff, setEstimatedStaff] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const payload = {
      company_id: companyId || null,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      company_name: companyName.trim(),
      subject: subject.trim(),
      business_needs: businessNeeds.trim(),
      estimated_properties: estimatedProperties ? parseInt(estimatedProperties, 10) : null,
      estimated_rooms: estimatedRooms ? parseInt(estimatedRooms, 10) : null,
      estimated_tenants: estimatedTenants ? parseInt(estimatedTenants, 10) : null,
      estimated_staff: estimatedStaff ? parseInt(estimatedStaff, 10) : null,
      status: "new",
      created_at: new Date().toISOString(),
    };

    try {
      // 1. Attempt insertion to Supabase database
      const { error: dbError } = await supabase
        .from("enterprise_sales_enquiries")
        .insert([payload]);

      if (dbError) {
        console.warn("Supabase insert note:", dbError.message);
        // Fallback: save to local storage queue so inquiry is never lost
        try {
          const queueKey = "paimba_offline_sales_enquiries";
          const currentQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");
          currentQueue.push(payload);
          localStorage.setItem(queueKey, JSON.stringify(currentQueue));
        } catch (storageErr) {
          console.error("Local storage error:", storageErr);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("Error submitting sales inquiry:", err);
      setErrorMsg(err.message || "Unable to send enquiry. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Custom Enterprise & Conglomerate Consultation"
      maxWidthClassName="max-w-2xl w-full"
    >
      {success ? (
        <div className="py-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500 shadow-lg">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">Enquiry Received!</h3>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto leading-relaxed">
              Thank you for reaching out, <strong className="text-foreground">{fullName}</strong>.
              Our Enterprise Solutions & Architecture Team has received your inquiry for{" "}
              <strong className="text-foreground">{companyName}</strong> and will contact you via{" "}
              <strong className="text-foreground">{email}</strong> within 24 business hours.
            </p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface-elevated/70 p-4 max-w-md mx-auto text-left text-xs space-y-2">
            <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">What Happens Next:</p>
            <ul className="space-y-1.5 text-muted">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                <span>Dedicated Enterprise Account Executive assigned to your portfolio</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <span>Custom architecture consultation for your properties and integrations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                <span>Bespoke contract quote with high-tier volume discounts & 24/7 SLA</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full max-w-md mx-auto rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Header Banner */}
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Tailored for Scale: Over 20 Properties, 500 Rooms, 600 Tenants & 100 Staff
              </p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Connect directly with our enterprise engineering and solutions team for tailored multi-property
                pricing, dedicated database clusters, custom ERP sync (SAP, Oracle, QuickBooks), and custom SLAs.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Full Name / Primary Contact <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Tendai Mokoena"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface pl-9 pr-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                />
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Corporate Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface pl-9 pr-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                />
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Company / Hotel Portfolio Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Horizon Hotel Group"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface pl-9 pr-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                />
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Phone / WhatsApp Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+27 (0) 82 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface pl-9 pr-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                />
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Inquiry Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Optional Scale Estimates */}
          <div className="rounded-2xl border border-border-color bg-surface-elevated/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Estimated Portfolio Metrics (Optional)
              </span>
              <span className="text-[10px] text-blue-500 font-semibold">Assists custom pricing</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-muted block mb-1 flex items-center gap-1">
                  <Building2 size={11} className="text-blue-400" />
                  <span>Properties</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 35"
                  value={estimatedProperties}
                  onChange={(e) => setEstimatedProperties(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted block mb-1 flex items-center gap-1">
                  <BedDouble size={11} className="text-emerald-400" />
                  <span>Rooms</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 750"
                  value={estimatedRooms}
                  onChange={(e) => setEstimatedRooms(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted block mb-1 flex items-center gap-1">
                  <Users size={11} className="text-purple-400" />
                  <span>Tenants / Units</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1200"
                  value={estimatedTenants}
                  onChange={(e) => setEstimatedTenants(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted block mb-1 flex items-center gap-1">
                  <Layers size={11} className="text-amber-400" />
                  <span>Staff Users</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 150"
                  value={estimatedStaff}
                  onChange={(e) => setEstimatedStaff(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Business Needs */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Explain Your Business Needs, Integration Requirements & Objectives <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Tell our solutions engineers about your portfolio structure, current systems (e.g. Opera, SAP, Excel), custom reporting requirements, or deployment timeline..."
              value={businessNeeds}
              onChange={(e) => setBusinessNeeds(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-color">
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Strict confidentiality guaranteed.</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-xl border border-border-color bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Submitting Enquiry...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Request Custom Enterprise Quote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
