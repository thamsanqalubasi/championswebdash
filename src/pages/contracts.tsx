import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchContractsData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchCompanyInfo, fetchAdminInfo, downloadHtmlDocument } from "@/lib/storage";
import { buildProfessionalContractHtml } from "@/lib/document-templates";
import type { ContractSection } from "@/lib/document-templates";
import { sendEmail, sendWhatsApp } from "@/lib/notifications";
import type { ContractRow } from "@/lib/types";

/* ── local types ── */

type TenantContact = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
};

type TemplateRow = {
  id: string;
  title: string;
  description: string;
  monthlyRent: number;
  depositAmount: number;
  isDefault: boolean;
  sections: ContractSection[];
};

/* ── helpers ── */

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

const emptySection: ContractSection = { title: "", content: "" };

const emptyContractForm = {
  tenant_id: "",
  property_id: "",
  template_id: "",
  title: "Lease Agreement",
  start_date: "",
  end_date: "",
  monthly_rent: 0,
  deposit_amount: 0,
  notes: "",
  status: "pending",
  sections: [{ ...emptySection }] as ContractSection[],
};

const emptyTemplateForm = {
  title: "",
  description: "",
  monthly_rent: 0,
  deposit_amount: 0,
  sections: [{ ...emptySection }] as ContractSection[],
};

/* ── component ── */

export default function ContractsPage() {
  const { user } = useAuth();

  /* ── tab state ── */
  const [activeTab, setActiveTab] = useState<"contracts" | "templates">("contracts");

  /* ── contracts state ── */
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyContractForm);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; full_name: string }>>([]);
  const [tenantContacts, setTenantContacts] = useState<TenantContact[]>([]);
  const [contractDocumentUrlById, setContractDocumentUrlById] = useState<Record<string, string>>({});
  const [contractSectionsById, setContractSectionsById] = useState<Record<string, ContractSection[]>>({});

  /* ── templates state ── */
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<TemplateRow | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  /* ── load contracts + lookups ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchContractsData();
        if (!cancelled) setContracts(result);
        const [{ data: props }, { data: tens }, { data: contractDocs }, { data: allSections }] = await Promise.all([
          supabase.from("properties").select("id, name").order("name"),
          supabase.from("tenants").select("id, full_name, email, phone, whatsapp_number").order("full_name"),
          supabase.from("contracts").select("id, document_url, title"),
          supabase.from("contract_sections").select("contract_id, sort_order, title, content").order("sort_order"),
        ]);
        if (!cancelled) {
          if (props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
          if (tens) {
            setTenants(tens.map((t) => ({ id: String(t.id), full_name: String(t.full_name) })));
            setTenantContacts(tens.map((t) => ({
              id: String(t.id),
              full_name: String(t.full_name),
              email: String((t as Record<string, unknown>).email ?? ""),
              phone: String((t as Record<string, unknown>).phone ?? ""),
              whatsapp_number: String((t as Record<string, unknown>).whatsapp_number ?? ""),
            })));
          }
          if (contractDocs) {
            const map: Record<string, string> = {};
            contractDocs.forEach((row) => { map[String(row.id)] = String(row.document_url ?? ""); });
            setContractDocumentUrlById(map);
          }
          if (allSections) {
            const sMap: Record<string, ContractSection[]> = {};
            allSections.forEach((s) => {
              const cid = String((s as Record<string, unknown>).contract_id ?? "");
              if (!sMap[cid]) sMap[cid] = [];
              sMap[cid].push({ title: String(s.title), content: String(s.content) });
            });
            setContractSectionsById(sMap);
          }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load contracts."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  /* ── load templates ── */
  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      setTemplatesLoading(true);
      try {
        const [{ data: tpls }, { data: tplSections }] = await Promise.all([
          supabase.from("contract_templates").select("id, title, description, monthly_rent, deposit_amount, is_default").order("created_at", { ascending: false }),
          supabase.from("contract_template_sections").select("template_id, sort_order, title, content").order("sort_order"),
        ]);
        if (!cancelled && tpls) {
          const sectionMap: Record<string, ContractSection[]> = {};
          (tplSections ?? []).forEach((s) => {
            const tid = String((s as Record<string, unknown>).template_id ?? "");
            if (!sectionMap[tid]) sectionMap[tid] = [];
            sectionMap[tid].push({ title: String(s.title), content: String(s.content) });
          });
          setTemplates(tpls.map((t) => ({
            id: String(t.id),
            title: String(t.title),
            description: String(t.description ?? ""),
            monthlyRent: Number(t.monthly_rent ?? 0),
            depositAmount: Number(t.deposit_amount ?? 0),
            isDefault: Boolean(t.is_default),
            sections: sectionMap[String(t.id)] ?? [],
          })));
        }
      } catch { /* silently fail */ }
      finally { if (!cancelled) setTemplatesLoading(false); }
    }
    void loadTemplates();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  /* ── contracts filters ── */
  const counts = useMemo(() => ({
    all: contracts.length,
    pending: contracts.filter((c) => c.status === "pending").length,
    active: contracts.filter((c) => c.status === "active").length,
    expired: contracts.filter((c) => c.status === "expired").length,
    terminated: contracts.filter((c) => c.status === "terminated").length,
  }), [contracts]);

  const filtered = useMemo(() => activeFilter === "all" ? contracts : contracts.filter((c) => c.status === activeFilter), [contracts, activeFilter]);

  /* ── contract form actions ── */
  const openAdd = () => {
    setEditingId(null);
    const defaultTpl = templates.find((t) => t.isDefault) ?? templates[0];
    if (defaultTpl) {
      setForm({
        ...emptyContractForm,
        template_id: defaultTpl.id,
        title: defaultTpl.title,
        monthly_rent: defaultTpl.monthlyRent,
        deposit_amount: defaultTpl.depositAmount,
        sections: defaultTpl.sections.length > 0 ? defaultTpl.sections.map((s) => ({ ...s })) : [{ ...emptySection }],
      });
    } else {
      setForm({ ...emptyContractForm, sections: [{ ...emptySection }] });
    }
    setModalOpen(true);
  };

  const openEdit = (row: ContractRow) => {
    setEditingId(row.id);
    const sections = contractSectionsById[row.id] ?? [];
    setForm({
      tenant_id: "", property_id: "", template_id: "",
      title: "Lease Agreement",
      start_date: row.startDate, end_date: row.endDate,
      monthly_rent: row.monthlyRent, deposit_amount: row.depositAmount,
      notes: row.notes, status: row.status,
      sections: sections.length > 0 ? sections.map((s) => ({ ...s })) : [{ ...emptySection }],
    });
    setModalOpen(true);
  };

  const onTemplateSelect = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setForm((prev) => ({
      ...prev,
      template_id: templateId,
      title: tpl.title,
      monthly_rent: tpl.monthlyRent || prev.monthly_rent,
      deposit_amount: tpl.depositAmount || prev.deposit_amount,
      sections: tpl.sections.length > 0 ? tpl.sections.map((s) => ({ ...s })) : prev.sections,
    }));
  };

  const addSection = () => setForm((prev) => ({ ...prev, sections: [...prev.sections, { ...emptySection }] }));
  const removeSection = (idx: number) => setForm((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }));
  const updateSection = (idx: number, field: "title" | "content", value: string) =>
    setForm((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));

  const onSave = async () => {
    if (!form.start_date || !form.end_date) { alert("Please select start and end dates."); return; }
    if (!editingId && (!form.tenant_id || !form.property_id)) { alert("Please select tenant and property."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        monthly_rent: form.monthly_rent,
        deposit_amount: form.deposit_amount,
        notes: form.notes,
        status: form.status,
        title: form.title || "Lease Agreement",
        template_id: form.template_id || null,
      };
      if (form.tenant_id) payload.tenant_id = form.tenant_id;
      if (form.property_id) payload.property_id = form.property_id;

      let contractId = editingId;
      if (editingId) {
        const { error: err } = await supabase.from("contracts").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { data: created, error: err } = await supabase.from("contracts").insert(payload).select("id").single();
        if (err) throw err;
        contractId = created.id;
      }

      // Save sections
      if (contractId) {
        await supabase.from("contract_sections").delete().eq("contract_id", contractId);
        const validSections = form.sections.filter((s) => s.title.trim());
        if (validSections.length > 0) {
          const { error: secErr } = await supabase.from("contract_sections").insert(
            validSections.map((s, i) => ({
              contract_id: contractId,
              sort_order: i,
              title: s.title,
              content: s.content,
            })),
          );
          if (secErr) throw secErr;
        }
      }

      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onStatusChange = async (id: string, status: string) => {
    const { error: err } = await supabase.from("contracts").update({ status }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("contracts").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  /* ── document generation ── */
  const sanitizePhone = (value: string) => value.replace(/\D/g, "");
  const getTenantContact = (row: ContractRow) => tenantContacts.find((t) => t.full_name === row.tenantName);

  const generateContractHtml = async (row: ContractRow) => {
    const sections = contractSectionsById[row.id] ?? [];
    const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
    return buildProfessionalContractHtml(
      { contractTitle: "Lease Agreement", tenantName: row.tenantName, propertyName: row.propertyName, startDate: row.startDate, endDate: row.endDate, monthlyRent: row.monthlyRent, depositAmount: row.depositAmount, status: row.status, notes: row.notes, sections },
      company, admin,
    );
  };

  const ensureGeneratedDocument = async (row: ContractRow) => {
    const existing = contractDocumentUrlById[row.id] ?? "";
    if (existing && !existing.startsWith("data:")) return existing;
    const html = await generateContractHtml(row);
    const { error: updateError } = await supabase.from("contracts").update({ document_url: html }).eq("id", row.id);
    if (updateError) throw updateError;
    setContractDocumentUrlById((prev) => ({ ...prev, [row.id]: html }));
    return html;
  };

  const onGenerate = async (row: ContractRow) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to view contract."); return; }
    setPrintingId(row.id);
    try {
      const html = await generateContractHtml(row);
      await supabase.from("contracts").update({ document_url: html }).eq("id", row.id);
      setContractDocumentUrlById((prev) => ({ ...prev, [row.id]: html }));
      previewWindow.document.open(); previewWindow.document.write(html); previewWindow.document.close();
    } catch (e) { alert(e instanceof Error ? e.message : "Could not generate contract."); previewWindow.close(); }
    finally { setPrintingId(null); }
  };

  const onView = async (row: ContractRow) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to view contract."); return; }
    setPrintingId(row.id);
    try {
      const html = await ensureGeneratedDocument(row);
      previewWindow.document.open(); previewWindow.document.write(html); previewWindow.document.close();
    } catch (e) { alert(e instanceof Error ? e.message : "Could not view contract."); previewWindow.close(); }
    finally { setPrintingId(null); }
  };

  const onDownload = async (row: ContractRow) => {
    setPrintingId(row.id);
    try {
      const html = await ensureGeneratedDocument(row);
      downloadHtmlDocument(html, `contract-${row.tenantName.replace(/\s+/g, "-").toLowerCase()}.html`);
    } catch (e) { alert(e instanceof Error ? e.message : "Could not download contract."); }
    finally { setPrintingId(null); }
  };

  const onSendEmail = async (row: ContractRow) => {
    try {
      const tenant = getTenantContact(row);
      if (!tenant?.email) { alert("Tenant email is missing."); return; }
      const documentHtml = await ensureGeneratedDocument(row);
      const company = await fetchCompanyInfo();
      const subject = `Lease Contract - ${row.propertyName}`;
      const result = await sendEmail({
        to: tenant.email,
        recipientName: row.tenantName,
        subject,
        bodyText: `Please find your lease contract for <strong>${row.propertyName}</strong> attached below. The contract period is ${row.startDate} to ${row.endDate} with a monthly rent of <strong>R${Number(row.monthlyRent).toLocaleString()}</strong>.`,
        documentHtml,
        companyName: company?.companyName,
      });
      if (result.sent) { alert("Contract sent via email successfully!"); }
    } catch (e) { alert(e instanceof Error ? e.message : "Could not send email."); }
  };

  const onSendWhatsApp = async (row: ContractRow) => {
    try {
      const tenant = getTenantContact(row);
      const phone = sanitizePhone(tenant?.whatsapp_number || tenant?.phone || "");
      if (!phone) { alert("Tenant phone/WhatsApp number is missing."); return; }
      const message = `Hello ${row.tenantName}, your contract for ${row.propertyName} is ready. Period: ${row.startDate} to ${row.endDate}. Monthly rent: R${Number(row.monthlyRent).toLocaleString()}.`;
      const result = await sendWhatsApp({ to: `+${phone}`, message });
      if (result.sent) { alert("Contract sent via WhatsApp successfully!"); }
    } catch (e) { alert(e instanceof Error ? e.message : "Could not send WhatsApp."); }
  };

  /* ── template CRUD ── */
  const openAddTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm({ ...emptyTemplateForm, sections: [{ ...emptySection }] });
    setTemplateModalOpen(true);
  };

  const openEditTemplate = (tpl: TemplateRow) => {
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      title: tpl.title,
      description: tpl.description,
      monthly_rent: tpl.monthlyRent,
      deposit_amount: tpl.depositAmount,
      sections: tpl.sections.length > 0 ? tpl.sections.map((s) => ({ ...s })) : [{ ...emptySection }],
    });
    setTemplateModalOpen(true);
  };

  const addTemplateSection = () => setTemplateForm((prev) => ({ ...prev, sections: [...prev.sections, { ...emptySection }] }));
  const removeTemplateSection = (idx: number) => setTemplateForm((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }));
  const updateTemplateSection = (idx: number, field: "title" | "content", value: string) =>
    setTemplateForm((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));

  const onSaveTemplate = async () => {
    if (!templateForm.title.trim()) { alert("Please enter a template title."); return; }
    setSavingTemplate(true);
    try {
      const payload = {
        title: templateForm.title,
        description: templateForm.description,
        monthly_rent: templateForm.monthly_rent,
        deposit_amount: templateForm.deposit_amount,
      };

      let templateId = editingTemplateId;
      if (editingTemplateId) {
        const { error: err } = await supabase.from("contract_templates").update(payload).eq("id", editingTemplateId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from("contract_templates").insert(payload).select("id").single();
        if (err) throw err;
        templateId = data.id;
      }

      // Save sections
      if (templateId) {
        await supabase.from("contract_template_sections").delete().eq("template_id", templateId);
        const validSections = templateForm.sections.filter((s) => s.title.trim());
        if (validSections.length > 0) {
          const { error: secErr } = await supabase.from("contract_template_sections").insert(
            validSections.map((s, i) => ({
              template_id: templateId,
              sort_order: i,
              title: s.title,
              content: s.content,
            })),
          );
          if (secErr) throw secErr;
        }
      }

      setTemplateModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save template failed"); }
    finally { setSavingTemplate(false); }
  };

  const onDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return;
    setDeletingTemplate(true);
    try {
      const { error: err } = await supabase.from("contract_templates").delete().eq("id", deleteTemplateTarget.id);
      if (err) throw err;
      setDeleteTemplateTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete template failed"); }
    finally { setDeletingTemplate(false); }
  };

  const onSetDefaultTemplate = async (id: string) => {
    await supabase.from("contract_templates").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: err } = await supabase.from("contract_templates").update({ is_default: true }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  /* ── shared styles ── */
  const inputClass = "w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none";
  const btnSmClass = "rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated";
  const btnSmDisabled = "rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated disabled:opacity-50";

  /* ── render ── */
  return (
    <ModulePage title="Contracts" description="Manage lease agreements, contract templates, and lifecycle.">

      {/* Top-level tabs */}
      <div className="mb-4 flex gap-2 border-b border-border-color pb-2">
        <button type="button" onClick={() => setActiveTab("contracts")} className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === "contracts" ? "bg-surface-elevated border border-b-0 border-border-color" : "text-muted"}`}>Contracts</button>
        <button type="button" onClick={() => setActiveTab("templates")} className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === "templates" ? "bg-surface-elevated border border-b-0 border-border-color" : "text-muted"}`}>Contract Templates</button>
      </div>

      {/* ═══════════ CONTRACTS TAB ═══════════ */}
      {activeTab === "contracts" && (
        <>
          {loading && <LoadingState label="Loading contracts..." />}
          {!loading && error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (
            <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["all", "pending", "active", "expired", "terminated"] as const).map((key) => (
                    <button key={key} type="button" onClick={() => setActiveFilter(key)}
                      className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                      {key === "all" ? `All (${counts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Contract</button>
              </div>

              {filtered.length === 0 ? <EmptyState title="No contracts found" description="Add a contract to get started." /> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead><tr className="border-b border-border-color text-left text-muted">
                      <th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Start</th><th className="px-3 py-2 font-medium">End</th><th className="px-3 py-2 font-medium">Monthly Rent</th><th className="px-3 py-2 font-medium">Deposit</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>{filtered.map((row) => (
                      <tr key={row.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{row.tenantName}</td>
                        <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                        <td className="px-3 py-3 text-muted">{row.startDate}</td>
                        <td className="px-3 py-3 text-muted">{row.endDate}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(row.monthlyRent)}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(row.depositAmount)}</td>
                        <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                        <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void onGenerate(row)} disabled={printingId === row.id} className={btnSmDisabled}>{printingId === row.id ? "..." : "Generate"}</button>
                          <button type="button" onClick={() => void onView(row)} disabled={printingId === row.id} className={btnSmDisabled}>View</button>
                          <button type="button" onClick={() => void onDownload(row)} disabled={printingId === row.id} className={btnSmDisabled}>Download</button>
                          <button type="button" onClick={() => void onSendWhatsApp(row)} className={btnSmClass}>WhatsApp</button>
                          <button type="button" onClick={() => void onSendEmail(row)} className={btnSmClass}>Email</button>
                          {row.status === "pending" && <button type="button" onClick={() => onStatusChange(row.id, "active")} className={btnSmClass}>Activate</button>}
                          {row.status === "active" && <button type="button" onClick={() => onStatusChange(row.id, "terminated")} className={btnSmClass}>Terminate</button>}
                          {row.status === "expired" && <button type="button" onClick={() => onStatusChange(row.id, "active")} className={btnSmClass}>Renew</button>}
                          {row.status === "terminated" && <button type="button" onClick={() => onStatusChange(row.id, "active")} className={btnSmClass}>Reactivate</button>}
                          <button type="button" onClick={() => openEdit(row)} className={btnSmClass}>Edit</button>
                          <button type="button" onClick={() => setDeleteTarget(row)} className={btnSmClass}>Delete</button>
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ═══════════ TEMPLATES TAB ═══════════ */}
      {activeTab === "templates" && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Saved Contract Templates</h3>
            <button type="button" onClick={openAddTemplate} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Create Template</button>
          </div>

          {templatesLoading && <LoadingState label="Loading templates..." />}

          {!templatesLoading && templates.length === 0 && (
            <EmptyState title="No templates yet" description="Create a contract template with custom sections to get started." />
          )}

          {!templatesLoading && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-lg border border-border-color bg-surface-elevated p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{tpl.title}</h4>
                        {tpl.isDefault && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Default</span>}
                      </div>
                      {tpl.description && <p className="mt-1 text-xs text-muted">{tpl.description}</p>}
                      <div className="mt-2 flex gap-4 text-xs text-muted">
                        <span>Rent: {formatCurrency(tpl.monthlyRent)}</span>
                        <span>Deposit: {formatCurrency(tpl.depositAmount)}</span>
                        <span>Sections: {tpl.sections.length}</span>
                      </div>
                      {tpl.sections.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tpl.sections.map((s, i) => (
                            <span key={i} className="rounded border border-border-color px-2 py-0.5 text-xs text-muted">{s.title}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!tpl.isDefault && <button type="button" onClick={() => onSetDefaultTemplate(tpl.id)} className={btnSmClass}>Set Default</button>}
                      <button type="button" onClick={() => openEditTemplate(tpl)} className={btnSmClass}>Edit</button>
                      <button type="button" onClick={() => setDeleteTemplateTarget(tpl)} className={btnSmClass}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════════ CONTRACT FORM MODAL ═══════════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Contract" : "Generate Contract"}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {/* Template selector (add mode only) */}
          {!editingId && templates.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-muted">Use Template</label>
              <select value={form.template_id} onChange={(e) => onTemplateSelect(e.target.value)} className={inputClass}>
                <option value="">No template (blank)</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.title}{t.isDefault ? " (Default)" : ""}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-muted">Contract Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="e.g. Lease Agreement" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Tenant</label><select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className={inputClass}>
              <option value="">Select tenant...</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select></div>
            <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className={inputClass}>
              <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Start Date</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} /></div>
            <div><label className="mb-1 block text-sm text-muted">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Monthly Rent</label><input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} className={inputClass} /></div>
            <div><label className="mb-1 block text-sm text-muted">Deposit Amount</label><input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })} className={inputClass} /></div>
          </div>

          {/* ── Contract Sections ── */}
          <div className="space-y-2 rounded-md border border-border-color p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Contract Sections</h4>
              <button type="button" onClick={addSection} className="rounded-md border border-border-color bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-elevated">+ Add Section</button>
            </div>
            {form.sections.map((section, idx) => (
              <div key={idx} className="space-y-1 rounded-md border border-border-color/60 bg-surface p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">Section {idx + 1}</label>
                  {form.sections.length > 1 && (
                    <button type="button" onClick={() => removeSection(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
                <input placeholder="Section Title (e.g. Property Damage)" value={section.title} onChange={(e) => updateSection(idx, "title", e.target.value)} className={inputClass} />
                <textarea placeholder="Section content..." value={section.content} onChange={(e) => updateSection(idx, "content", e.target.value)} rows={3} className={inputClass} />
              </div>
            ))}
          </div>

          <div><label className="mb-1 block text-sm text-muted">Additional Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} /></div>
          <div><label className="mb-1 block text-sm text-muted">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
            <option value="pending">Pending</option><option value="active">Active</option><option value="expired">Expired</option><option value="terminated">Terminated</option>
          </select></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* ═══════════ TEMPLATE FORM MODAL ═══════════ */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editingTemplateId ? "Edit Template" : "Create Contract Template"}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="mb-1 block text-sm text-muted">Template Title</label>
            <input value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} className={inputClass} placeholder="e.g. Standard Residential Lease" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Description</label>
            <input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} className={inputClass} placeholder="Short description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Default Monthly Rent</label><input type="number" value={templateForm.monthly_rent} onChange={(e) => setTemplateForm({ ...templateForm, monthly_rent: Number(e.target.value) })} className={inputClass} /></div>
            <div><label className="mb-1 block text-sm text-muted">Default Deposit</label><input type="number" value={templateForm.deposit_amount} onChange={(e) => setTemplateForm({ ...templateForm, deposit_amount: Number(e.target.value) })} className={inputClass} /></div>
          </div>

          <div className="space-y-2 rounded-md border border-border-color p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Template Sections</h4>
              <button type="button" onClick={addTemplateSection} className="rounded-md border border-border-color bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-elevated">+ Add Section</button>
            </div>
            {templateForm.sections.map((section, idx) => (
              <div key={idx} className="space-y-1 rounded-md border border-border-color/60 bg-surface p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">Section {idx + 1}</label>
                  {templateForm.sections.length > 1 && (
                    <button type="button" onClick={() => removeTemplateSection(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
                <input placeholder="Section Title" value={section.title} onChange={(e) => updateTemplateSection(idx, "title", e.target.value)} className={inputClass} />
                <textarea placeholder="Section content..." value={section.content} onChange={(e) => updateTemplateSection(idx, "content", e.target.value)} rows={3} className={inputClass} />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTemplateModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSaveTemplate} disabled={savingTemplate} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{savingTemplate ? "Saving..." : "Save Template"}</button>
          </div>
        </div>
      </Modal>

      {/* ═══════════ DELETE DIALOGS ═══════════ */}
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Contract" message={`Delete contract for ${deleteTarget?.tenantName}?`} confirmLabel="Delete" loading={deleting} />
      <ConfirmDialog open={!!deleteTemplateTarget} onClose={() => setDeleteTemplateTarget(null)} onConfirm={onDeleteTemplate} title="Delete Template" message={`Delete template "${deleteTemplateTarget?.title}"? This cannot be undone.`} confirmLabel="Delete" loading={deletingTemplate} />
    </ModulePage>
  );
}
