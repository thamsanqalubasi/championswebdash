import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchContractsData, verifyAdminPin, isValidUuid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { fetchCompanyInfo, fetchAdminInfo, uploadPdfFromHtml, createPdfAttachmentFromUrl, downloadHtmlDocument, downloadPdfDocument, downloadPdfFromUrl } from "@/lib/storage";
import { DocumentShareModal } from "@/components/document-share-modal";
import { buildProfessionalContractHtml } from "@/lib/document-templates";
import type { ContractSection } from "@/lib/document-templates";
import { sendEmailViaApi, sendWhatsAppViaApi, wrapDocumentInEmailHtml } from "@/lib/notifications";
import type { ContractRow } from "@/lib/types";
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  DollarSign, 
  ChevronRight, 
  Pencil, 
  Trash, 
  Download, 
  Mail, 
  Send,
  Eye,
  RefreshCw,
  Clock,
  User,
  Building,
  FileSignature,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Play,
  Briefcase,
  AlertCircle,
  Info,
  MessageSquare
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

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

// formatCurrency is provided by useCurrency() hook inside the component

async function ensureShareableDocumentUrl(existingUrl: string, html: string, filename: string) {
  if (existingUrl && existingUrl.startsWith("http") && existingUrl.toLowerCase().includes(".pdf")) {
    return existingUrl;
  }

  const base = filename.replace(/\.html$/i, "").replace(/\.pdf$/i, "");
  return uploadPdfFromHtml("contract-documents", "shared", html, base);
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

const MAIN_CONTRACT_TITLE = "Main Contract";
const MAIN_CONTRACT_DESCRIPTION = "Residential lease template with full clauses and editable sections.";

const MAIN_CONTRACT_SECTIONS: ContractSection[] = [
  {
    title: "Memorandum of Agreement",
    content: `<p style="text-align: center;"><strong>LEASE AGREEMENT</strong></p>
<p style="text-align: center;"><strong>(For Residential Accommodation)</strong></p>
<p style="text-align: center;"><strong>Memorandum of Agreement</strong></p>
<p style="text-align: justify;">This Memorandum of Agreement is made and entered into by and between the <strong>Landlord</strong> and the <strong>Lessee</strong> under the terms and conditions set out in this contract.</p>`,
  },
  {
    title: "Parties and Contact Details",
    content: `<p style="text-align: justify;"><strong>Landlord:</strong> Michael Beukes, ID 74020700079</p>
<p style="text-align: justify;"><strong>Landlord Address:</strong> 2673 J. James Street, Khomasdal, Windhoek</p>
<p style="text-align: justify;"><strong>Landlord Contact:</strong> 081 424 1935, michaelfbeukes@gmail.com</p>
<p style="text-align: justify;"><strong>Lessee:</strong> Mr Tamsanqa Lubasi, Passport EN903112</p>
<p style="text-align: justify;"><strong>Lessee Contact:</strong> thamulubasi@gmail.com, 081 844 5625</p>
<p style="text-align: justify;"><strong>Next of Kin:</strong> Nolwazi Dube, 081 811 5624</p>
<p style="text-align: justify;"><strong>Declaration:</strong> The Lessee confirms that all personal information supplied is correct.</p>`,
  },
  {
    title: "Property Description",
    content: `<p style="text-align: justify;">The Landlord lets to the Lessee, who hires, the following property ("<strong>The Property</strong>"):</p>
<p style="text-align: justify;"><strong>One bedroom flat (excluding garage)</strong>, located at <strong>2673 J. James Street, Khomasdal, Windhoek, Namibia</strong>.</p>`,
  },
  {
    title: "Lease Period and Rental",
    content: `<p style="text-align: justify;"><strong>Lease Term:</strong> 6 months</p>
<p style="text-align: justify;"><strong>Start Date:</strong> 1 May 2025</p>
<p style="text-align: justify;"><strong>End Date:</strong> 31 October 2025</p>
<p style="text-align: justify;"><strong>Pro-rata Rent:</strong> payable 11-30 April 2025 (4500/30 x 19 days = N$2850.00), due 10 April 2025.</p>
<p style="text-align: justify;"><strong>Monthly Rent:</strong> N$4500 (Four Thousand Five Hundred Namibian Dollars).</p>
<p style="text-align: justify;">The Lessee agrees to annual escalation aligned with the latest inflation information at the anniversary of this lease (reference: Bank of Namibia).</p>`,
  },
  {
    title: "Payment Terms and Banking Details",
    content: `<p style="text-align: justify;">Rent is payable by stop order or electronic banking, in advance, on or before the 1st day of each month.</p>
<p style="text-align: justify;">Where cash deposits are used, the Lessee bears all related banking charges.</p>
<p style="text-align: justify;"><strong>Bank Details:</strong></p>
<p style="text-align: justify;">Account Name: Michael Beukes<br/>Account No: 043132049<br/>Bank: Standard Bank Namibia<br/>Branch: Gustav Voigts Centre<br/>Branch Code: 087373</p>
<p style="text-align: justify;">If rental remains unpaid on due date, the Landlord may cancel this lease in writing, resume possession of the property, and pursue arrear rental, damages, and any legal remedies available.</p>
<p style="text-align: justify;">The Lessee undertakes to pay <strong>10% interest</strong> on rent paid later than the 5th day of the month, payable in that same month.</p>`,
  },
  {
    title: "Deposit and Deductions",
    content: `<p style="text-align: justify;"><strong>Deposit:</strong> N$4500 (Four Thousand Five Hundred Namibian Dollars), payable on or before 11 April 2025.</p>
<p style="text-align: justify;">The Landlord will refund the appropriate portion of the deposit after lease termination, subject to the property being returned in good condition and all outstanding rental and interest being settled.</p>
<p style="text-align: justify;">The Landlord may withhold <strong>N$700.00</strong> for repainting if required and <strong>N$300.00</strong> for pest control/cleaning if required.</p>
<p style="text-align: justify;">The Lessee may not use the deposit in place of monthly rental payments.</p>
<p style="text-align: justify;">If the Lessee fails to take occupation on the agreed date, the deposit is forfeited.</p>`,
  },
  {
    title: "Use and Care of the Property",
    content: `<p style="text-align: justify;">The Lessee undertakes to keep the inside and outside of the property in good order.</p>
<p style="text-align: justify;">The Lessee is responsible for damage caused during occupation.</p>
<p style="text-align: justify;">Any defects requiring repair must be reported in writing within the first 7 days of occupation; failing which, the Lessee may be held responsible.</p>
<p style="text-align: justify;">The property may only be used for residential purposes for which it is leased.</p>
<p style="text-align: justify;">The Lessee must keep the property clean, sanitary, and free from rubbish, litter, and pests. If not maintained, cleaning and pest-control costs may be charged to the Lessee.</p>`,
  },
  {
    title: "Alterations, Hazardous Materials, and Access",
    content: `<p style="text-align: justify;">No writing, painting, scratching, nails, screws, holes, or similar alterations may be made without prior written consent of the Landlord.</p>
<p style="text-align: justify;">No structural or other alterations may be made without prior written consent.</p>
<p style="text-align: justify;">Dangerous or inflammable materials (including petroleum products) may not be stored on the property if such use may invalidate building insurance.</p>
<p style="text-align: justify;">The Landlord or agent may inspect the property at all reasonable times.</p>`,
  },
  {
    title: "Liability, Utilities, and Insurance",
    content: `<p style="text-align: justify;">On termination or renewal completion, the Lessee shall return the property in the same order and condition as received.</p>
<p style="text-align: justify;">The Landlord is not responsible for damage to the Lessee's belongings caused by wind, water, hail, lightning, fire, riot, theft, strikes, state enemies, or similar causes.</p>
<p style="text-align: justify;">Where structural defects are reported in writing, the Landlord shall take immediate steps to repair such defects.</p>
<p style="text-align: justify;">Water and electricity are included in rental, subject to fair and economical use. Leakages or failures of Lessee-owned equipment are for the Lessee's account, and must be reported immediately.</p>`,
  },
  {
    title: "Occupancy, Conduct, and Restrictions",
    content: `<p style="text-align: justify;">No sub-letting is allowed.</p>
<p style="text-align: justify;">The Lessee may not cede or assign this lease without prior written consent of the Landlord.</p>
<p style="text-align: justify;">Maximum occupancy is <strong>1 adult</strong>, unless otherwise agreed in writing.</p>
<p style="text-align: justify;">No additional occupants are allowed without prior arrangement with the Landlord.</p>
<p style="text-align: justify;">No animals causing disturbance to other lessees may be harboured.</p>
<p style="text-align: justify;">Lessee and visitors may not engage in illegal activity, non-prescribed substance use, or behavior violating neighbors' rights. Such conduct constitutes grounds for termination under Namibian law.</p>
<p style="text-align: justify;">The Lessee shall respect the rights of all other lessees and neighbors at all times.</p>`,
  },
  {
    title: "Termination, Renewal, and Notice",
    content: `<p style="text-align: justify;">This contract is binding on the Lessee for the full period stated in this agreement.</p>
<p style="text-align: justify;">The Lessee must give the Landlord one full calendar month's written notice to terminate the lease early.</p>
<p style="text-align: justify;">In the absence of such notice, the lease may be extended for the same period as originally agreed.</p>
<p style="text-align: justify;">Failure to provide notice may result in forfeiture of the deposit.</p>
<p style="text-align: justify;">The Landlord reserves the right to terminate the contract prematurely by written notice to the Lessee.</p>`,
  },
  {
    title: "Signatures and Witnesses",
    content: `<p style="text-align: justify;">Thus done and signed at Windhoek on this ______ day of ______, in the presence of the undersigned witnesses.</p>
<p style="text-align: justify;"><strong>Witnesses:</strong> No.1 ____________________  No.2 ____________________</p>
<p style="text-align: justify;"><strong>Lessee Signature:</strong> ____________________</p>
<p style="text-align: justify;">Thus done and signed at Windhoek on this ______ day of ______, in the presence of the undersigned witnesses.</p>
<p style="text-align: justify;"><strong>Witnesses:</strong> No.1 ____________________  No.2 ____________________</p>
<p style="text-align: justify;"><strong>Landlord Signature:</strong> ____________________</p>`,
  },
];

async function ensureMainContractTemplateInDb(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existingTemplate, error: existingError } = await supabase
    .from("contract_templates")
    .select("id")
    .eq("title", MAIN_CONTRACT_TITLE)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { ok: false, message: existingError.message };
  }

  let templateId = String(existingTemplate?.id ?? "");

  if (!templateId) {
    const { error: unsetDefaultError } = await supabase
      .from("contract_templates")
      .update({ is_default: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (unsetDefaultError) {
      return { ok: false, message: unsetDefaultError.message };
    }

    const { data: insertedTemplate, error: insertError } = await supabase
      .from("contract_templates")
      .insert({
        title: MAIN_CONTRACT_TITLE,
        category: "residential",
        content: MAIN_CONTRACT_SECTIONS.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
        description: MAIN_CONTRACT_DESCRIPTION,
        is_default: true,
      })
      .select("id")
      .single();

    if (insertError || !insertedTemplate?.id) {
      return { ok: false, message: insertError?.message || "Could not create Main Contract template." };
    }

    templateId = String(insertedTemplate.id);
  }

  const { count, error: sectionCountError } = await supabase
    .from("contract_template_sections")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  if (sectionCountError) {
    return { ok: false, message: sectionCountError.message };
  }
  if ((count ?? 0) > 0) {
    return { ok: true };
  }

  const { error: insertSectionsError } = await supabase.from("contract_template_sections").insert(
    MAIN_CONTRACT_SECTIONS.map((section, index) => ({
      template_id: templateId,
      section_key: `sec_${index + 1}`,
      order_index: index,
      title: section.title,
      content: section.content,
    })),
  );

  if (insertSectionsError) {
    return { ok: false, message: insertSectionsError.message };
  }

  return { ok: true };
}

type RichCommand =
  | { type: "cmd"; value: string }
  | { type: "formatBlock"; value: string };

function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  const applyCommand = (command: RichCommand) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && selectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    if (command.type === "cmd") {
      document.execCommand(command.value);
    } else {
      document.execCommand("formatBlock", false, command.value);
    }
    onChange(editor.innerHTML);
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const keepEditorSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && selectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
  };

  const plainText = value.replace(/<[^>]*>/g, "").trim();

  return (
    <div className="rounded-md border border-border-color bg-surface-elevated">
      <div className="flex flex-wrap gap-1 border-b border-border-color p-2">
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "bold" })} className="rounded border border-border-color px-2 py-1 text-xs">B</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "italic" })} className="rounded border border-border-color px-2 py-1 text-xs italic">I</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "underline" })} className="rounded border border-border-color px-2 py-1 text-xs underline">U</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "insertUnorderedList" })} className="rounded border border-border-color px-2 py-1 text-xs">• List</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "insertOrderedList" })} className="rounded border border-border-color px-2 py-1 text-xs">1. List</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "outdent" })} className="rounded border border-border-color px-2 py-1 text-xs">Outdent</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "indent" })} className="rounded border border-border-color px-2 py-1 text-xs">Indent</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "justifyLeft" })} className="rounded border border-border-color px-2 py-1 text-xs">Left</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "justifyCenter" })} className="rounded border border-border-color px-2 py-1 text-xs">Center</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "justifyRight" })} className="rounded border border-border-color px-2 py-1 text-xs">Right</button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyCommand({ type: "cmd", value: "justifyFull" })} className="rounded border border-border-color px-2 py-1 text-xs">Justify</button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[120px] p-3 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
        data-placeholder={placeholder || "Type section content..."}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onBlur={captureSelection}
        onInput={(event) => onChange((event.currentTarget as HTMLDivElement).innerHTML)}
      />

      {!plainText && (
        <div className="pointer-events-none -mt-[108px] px-3 text-sm text-muted">{placeholder || "Type section content..."}</div>
      )}
    </div>
  );
}

/* ── component ── */

export default function ContractsPage() {
  const { user, currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const templateSeedWarningShownRef = useRef(false);

  /* ── tab state ── */
  const [activeTab, setActiveTab] = useState<"contracts" | "templates">("contracts");

  /* ── contracts state ── */
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
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
  const [shareModalDoc, setShareModalDoc] = useState<{
    isOpen: boolean;
    documentTitle: string;
    documentType?: string;
    documentHtml?: string;
    documentUrl?: string;
    fileNameBase?: string;
    ownerName?: string;
    ownerEmail?: string;
    defaultSubject?: string;
    defaultMessage?: string;
  }>({
    isOpen: false,
    documentTitle: "",
  });

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
          supabase.from("contract_sections").select("contract_id, order_index, title, content").order("order_index"),
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
        const seedResult = await ensureMainContractTemplateInDb();
        if (!seedResult.ok && !templateSeedWarningShownRef.current) {
          templateSeedWarningShownRef.current = true;
          alert(`Could not auto-create Main Contract template: ${seedResult.message}. You can run web/docs/seed-main-contract-template.sql in Supabase SQL Editor.`);
        }
        const [{ data: tpls }, { data: tplSections }] = await Promise.all([
          supabase.from("contract_templates").select("id, title, description, is_default").order("created_at", { ascending: false }),
          supabase.from("contract_template_sections").select("template_id, order_index, title, content").order("order_index"),
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
            monthlyRent: 0,
            depositAmount: 0,
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

  const filtered = useMemo(() => {
    let result = activeFilter === "all" ? contracts : contracts.filter((c) => c.status === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.tenantName.toLowerCase().includes(q) || 
        c.propertyName.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contracts, activeFilter, searchQuery]);

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
      if (currentCompany?.id && isValidUuid(currentCompany.id)) {
        payload.company_id = currentCompany.id;
      }

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
              section_key: `sec_${i + 1}`,
              order_index: i,
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
      const fileNameBase = `contract-${row.tenantName.replace(/\s+/g, "-").toLowerCase()}`;
      const existingUrl = contractDocumentUrlById[row.id];
      if (existingUrl && existingUrl.startsWith("http") && existingUrl.toLowerCase().includes(".pdf")) {
        await downloadPdfFromUrl(existingUrl, fileNameBase);
        return;
      }
      const html = await ensureGeneratedDocument(row);
      downloadPdfDocument(html, fileNameBase);
    } catch (e) { alert(e instanceof Error ? e.message : "Could not download contract."); }
    finally { setPrintingId(null); }
  };

  const onSendEmail = async (row: ContractRow) => {
    try {
      const tenant = getTenantContact(row);
      const documentHtml = await generateContractHtml(row);
      const pdfUrl = await ensureShareableDocumentUrl(contractDocumentUrlById[row.id] ?? "", documentHtml, `contract-${row.id}.pdf`);
      if (pdfUrl) {
        await supabase.from("contracts").update({ document_url: pdfUrl }).eq("id", row.id);
        setContractDocumentUrlById((prev) => ({ ...prev, [row.id]: pdfUrl }));
      }
      setShareModalDoc({
        isOpen: true,
        documentTitle: `Lease Contract - ${row.propertyName} (${row.tenantName})`,
        documentType: "Contract",
        documentHtml,
        documentUrl: pdfUrl,
        fileNameBase: `contract-${row.tenantName.replace(/\s+/g, "_")}`,
        ownerName: row.tenantName,
        ownerEmail: tenant?.email || "",
        defaultSubject: `Lease Contract - ${row.propertyName}`,
        defaultMessage: `Dear ${row.tenantName},\n\nPlease find your lease contract for ${row.propertyName} attached. The contract period is ${row.startDate} to ${row.endDate} with a monthly rent of ${formatCurrency(row.monthlyRent)}.`,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not prepare contract for sharing.");
    }
  };

  const onSendWhatsApp = async (row: ContractRow) => {
    try {
      const tenant = getTenantContact(row);
      const phone = sanitizePhone(tenant?.whatsapp_number || tenant?.phone || "");
      if (!phone) { alert("Tenant phone/WhatsApp number is missing."); return; }
      const documentHtml = await ensureGeneratedDocument(row);
      const message = `Hello ${row.tenantName}, your contract for ${row.propertyName} is ready. Period: ${row.startDate} to ${row.endDate}. Monthly rent: ${formatCurrency(row.monthlyRent)}.`;
      let mediaUrl = "";
      try {
        mediaUrl = await ensureShareableDocumentUrl(contractDocumentUrlById[row.id] ?? "", documentHtml, `contract-${row.id}.pdf`);
        await supabase.from("contracts").update({ document_url: mediaUrl }).eq("id", row.id);
        setContractDocumentUrlById((prev) => ({ ...prev, [row.id]: mediaUrl }));
      } catch {
        mediaUrl = "";
      }
      const result = await sendWhatsAppViaApi({ to: `+${phone}`, message, ...(mediaUrl ? { mediaUrl } : {}) });
      if (!result.success) throw new Error(result.error || "WhatsApp API request failed.");
      alert("Contract sent via WhatsApp successfully!");
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
      const templateContent = templateForm.sections
        .filter((section) => section.title.trim() || section.content.trim())
        .map((section) => `${section.title}\n${section.content}`)
        .join("\n\n");

      const payload: Record<string, unknown> = {
        title: templateForm.title,
        category: "residential",
        content: templateContent || templateForm.description || "Template content",
        description: templateForm.description,
      };
      if (currentCompany?.id && isValidUuid(currentCompany.id)) {
        payload.company_id = currentCompany.id;
      }

      let templateId = editingTemplateId;
      if (editingTemplateId) {
        const { error: err } = await supabase.from("contract_templates").update(payload).eq("id", editingTemplateId);
        if (err) throw err;
      } else {
        const { data: created, error: err } = await supabase.from("contract_templates").insert(payload).select("id").single();
        if (err) throw err;
        if (created) templateId = created.id;
      }

      // Save sections
      if (templateId) {
        await supabase.from("contract_template_sections").delete().eq("template_id", templateId);
        const validSections = templateForm.sections.filter((s) => s.title.trim());
        if (validSections.length > 0) {
          const { error: secErr } = await supabase.from("contract_template_sections").insert(
            validSections.map((s, i) => ({
              template_id: templateId,
              section_key: `sec_${i + 1}`,
              order_index: i,
              title: s.title,
              content: s.content,
            })),
          );
          if (secErr) throw secErr;
        }
      }

      setTemplateModalOpen(false); reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save template failed";
      if (msg.includes("relation") && msg.includes("does not exist")) {
        alert("The contract_templates table doesn't exist yet. Please run the SQL schema from docs/contract-templates-schema.sql in your Supabase SQL Editor.");
      } else {
        alert(msg);
      }
    }
    finally { setSavingTemplate(false); }
  };

  const onDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return;
    const pin = window.prompt("Enter admin PIN to delete this template:")?.trim() ?? "";
    if (!pin) {
      alert("PIN is required to delete a template.");
      return;
    }

    setDeletingTemplate(true);
    try {
      const pinOk = await verifyAdminPin(pin);
      if (!pinOk) {
        alert("Invalid admin PIN.");
        return;
      }

      const { error: deleteSectionsError } = await supabase
        .from("contract_template_sections")
        .delete()
        .eq("template_id", deleteTemplateTarget.id);
      if (deleteSectionsError) throw deleteSectionsError;

      const { error: detachContractsError } = await supabase
        .from("contracts")
        .update({ template_id: null })
        .eq("template_id", deleteTemplateTarget.id);
      if (detachContractsError) throw detachContractsError;

      const { error: err } = await supabase.from("contract_templates").delete().eq("id", deleteTemplateTarget.id);
      if (err) throw err;
      setDeleteTemplateTarget(null); reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete template failed";
      if (/foreign key|violates/i.test(msg)) {
        alert("Template is still linked to existing contracts and cannot be deleted.");
      } else {
        alert(msg);
      }
    }
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
    <ModulePage title="Lease Management" description="Draft agreements, manage active contracts, and automate lease lifecycle communications.">

      {/* Top-level tabs */}
      <div className="mb-6 flex gap-1 border-b border-border-color/50">
        <button 
          type="button" 
          onClick={() => setActiveTab("contracts")} 
          className={`relative px-6 py-3 text-sm font-bold transition-all ${activeTab === "contracts" ? "text-foreground" : "text-muted hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2">
            <FileText size={16} />
            Active Contracts
          </span>
          {activeTab === "contracts" && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-foreground rounded-full" />}
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab("templates")} 
          className={`relative px-6 py-3 text-sm font-bold transition-all ${activeTab === "templates" ? "text-foreground" : "text-muted hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2">
            <FileSignature size={16} />
            Contract Templates
          </span>
          {activeTab === "templates" && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-foreground rounded-full" />}
        </button>
      </div>

      {/* ═══════════ CONTRACTS TAB ═══════════ */}
      {activeTab === "contracts" && (
        <>
          {loading && <LoadingState label="Retreiving active lease registry..." />}
          {!loading && error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (
            <section className="rounded-xl border border-border-color bg-surface p-1">
              <div className="p-4">
                <DataTableHeader
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Search contracts by tenant or property..."
                  filters={[
                    { key: "all", label: "All", count: counts.all },
                    { key: "pending", label: "Pending", count: counts.pending },
                    { key: "active", label: "Active", count: counts.active },
                    { key: "expired", label: "Expired", count: counts.expired },
                    { key: "terminated", label: "Terminated", count: counts.terminated },
                  ]}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  actions={
                    <button
                      type="button"
                      onClick={openAdd}
                      className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-black text-surface hover:opacity-90 transition-all shadow-md"
                    >
                      <Plus size={16} />
                      <span>Draft Contract</span>
                    </button>
                  }
                />
              </div>

              {filtered.length === 0 ? (
                <div className="p-12">
                  <EmptyState title="No contracts found" description="Create your first lease agreement to get started." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4 font-bold">Tenant & Property</th>
                        <th className="px-6 py-4 font-bold">Contract Period</th>
                        <th className="px-6 py-4 font-bold text-right">Monthly Rent</th>
                        <th className="px-6 py-4 font-bold text-right">Security Deposit</th>
                        <th className="px-6 py-4 font-bold">Status</th>
                        <th className="px-6 py-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/40">
                      {filtered.map((row) => (
                        <tr key={row.id} className="group hover:bg-surface-elevated/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                                <User size={20} className="text-muted/60 group-hover:text-current" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold tracking-tight text-foreground truncate">{row.tenantName}</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted">
                                  <Building size={12} />
                                  <span>{row.propertyName}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                <Calendar size={12} className="text-muted" />
                                <span>{row.startDate}</span>
                                <span className="text-muted/40 font-normal">to</span>
                                <span>{row.endDate}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted font-bold uppercase tracking-tighter">
                                <Clock size={10} />
                                <span>Fixed Term Lease</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-foreground">{formatCurrency(row.monthlyRent)}</td>
                          <td className="px-6 py-4 text-right font-medium text-muted">{formatCurrency(row.depositAmount)}</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <TableRowActions>
                              <TableActionButton
                                icon={RefreshCw}
                                label="Regenerate Contract"
                                onClick={(e) => { e.stopPropagation(); void onGenerate(row); }}
                                disabled={printingId === row.id}
                              />
                              <TableActionButton
                                icon={Eye}
                                label="View Document"
                                onClick={(e) => { e.stopPropagation(); void onView(row); }}
                                disabled={printingId === row.id}
                              />
                              <TableActionButton
                                icon={Download}
                                label="Download"
                                onClick={(e) => { e.stopPropagation(); void onDownload(row); }}
                                disabled={printingId === row.id}
                              />
                              <TableActionButton
                                icon={Mail}
                                label="Send Email"
                                onClick={(e) => { e.stopPropagation(); void onSendEmail(row); }}
                              />
                              <TableActionButton
                                icon={MessageSquare}
                                label="Send WhatsApp"
                                onClick={(e) => { e.stopPropagation(); void onSendWhatsApp(row); }}
                              />
                              <TableActionButton
                                icon={Pencil}
                                label="Edit Data"
                                onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                              />
                              {row.status === "pending" && (
                                <TableActionButton
                                  icon={Play}
                                  label="Activate Lease"
                                  onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "active"); }}
                                  variant="success"
                                />
                              )}
                              <TableActionButton
                                icon={Trash}
                                label="Delete"
                                variant="danger"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                              />
                              <div className="ml-2 pl-2 border-l border-border-color/40">
                                <ChevronRight size={18} className="text-muted/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </TableRowActions>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
                  Showing {filtered.length} of {counts.all} legal records
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {/* ═══════════ TEMPLATES TAB ═══════════ */}
      {activeTab === "templates" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Contract Templates</h3>
              <p className="text-sm text-muted">Standardized legal frameworks for reusable lease structures.</p>
            </div>
            <button 
              type="button" 
              onClick={openAddTemplate} 
              className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-black text-surface hover:opacity-90 shadow-md transition-all"
            >
              <Plus size={16} />
              <span>Create Template</span>
            </button>
          </div>

          {templatesLoading && <LoadingState label="Loading legal library..." />}

          {!templatesLoading && templates.length === 0 && (
            <div className="p-20 rounded-3xl border-2 border-dashed border-border-color bg-muted/5 text-center">
              <FileSignature size={48} className="mx-auto text-muted/10 mb-4" />
              <EmptyState title="Legal Library Empty" description="Create a contract template with custom clauses to automate your workflow." />
            </div>
          )}

          {!templatesLoading && templates.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {templates.map((tpl) => (
                <article key={tpl.id} className="group relative rounded-2xl border border-border-color bg-surface p-6 transition-all hover:shadow-xl hover:border-foreground/20 overflow-hidden">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-lg font-bold tracking-tight truncate">{tpl.title}</h4>
                        {tpl.isDefault && (
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/30">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted line-clamp-2 leading-relaxed">{tpl.description || "No description provided."}</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/5 text-muted group-hover:bg-foreground group-hover:text-surface transition-all">
                      <FileSignature size={24} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-border-color/40 mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Default Rent</p>
                      <p className="font-bold text-foreground">{formatCurrency(tpl.monthlyRent)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Structure</p>
                      <p className="font-bold text-foreground">{tpl.sections.length} Legal Sections</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => openEditTemplate(tpl)} 
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border-color bg-surface-elevated/50 py-2.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition-all"
                    >
                      <Pencil size={14} />
                      Edit Template
                    </button>
                    {!tpl.isDefault && (
                      <button 
                        type="button" 
                        onClick={() => onSetDefaultTemplate(tpl.id)} 
                        className="flex items-center justify-center gap-2 rounded-xl border border-border-color bg-surface-elevated/50 px-4 py-2.5 text-xs font-bold text-muted hover:text-foreground transition-all"
                      >
                        Set Default
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => setDeleteTemplateTarget(tpl)} 
                      className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-600 hover:bg-red-100 transition-all dark:bg-red-900/10 dark:border-red-900/20"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════════ CONTRACT FORM MODAL ═══════════ */}
      <SideDrawer open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Contract Protocol" : "New Lease Agreement Protocol"}>
        <div className="space-y-8 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Assignment Data</h4>
                <div className="space-y-4">
                  {!editingId && templates.length > 0 && (
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Legal Template</label>
                      <select value={form.template_id} onChange={(e) => onTemplateSelect(e.target.value)} className={inputClass}>
                        <option value="">No template (blank)</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.title}{t.isDefault ? " (Default)" : ""}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Tenant</label>
                      <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className={inputClass}>
                        <option value="">Select tenant...</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </div>
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Property Unit</label>
                      <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className={inputClass}>
                        <option value="">Select unit...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Contract Timeline</h4>
                <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Start Date</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">End Date</label>
                    <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Financial Structure</h4>
                <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Monthly Rent (NAD)</label>
                    <input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Security Deposit</label>
                    <input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })} className={inputClass} />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Operational State</h4>
                <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Workflow Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                      <option value="pending">Pending Review</option>
                      <option value="active">Active Execution</option>
                      <option value="expired">Expired Term</option>
                      <option value="terminated">Terminated EARLY</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Internal Administration Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} placeholder="Add private operational notes here..." />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* ── Contract Sections ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40">Lease Clauses & Content</h4>
              <button type="button" onClick={addSection} className="flex items-center gap-1.5 rounded-lg bg-surface-elevated border border-border-color px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-all">
                <Plus size={12} />
                Add Clause
              </button>
            </div>
            
            <div className="space-y-6">
              {form.sections.map((section, idx) => (
                <article key={idx} className="group relative rounded-2xl border border-border-color bg-surface-elevated/10 p-6 transition-all hover:bg-surface-elevated/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-black text-surface">
                        {idx + 1}
                      </span>
                      <input 
                        placeholder="Clause Heading (e.g. Utility Charges)" 
                        value={section.title} 
                        onChange={(e) => updateSection(idx, "title", e.target.value)} 
                        className="bg-transparent text-sm font-bold text-foreground outline-none border-b border-transparent focus:border-border-color transition-all min-w-[240px]" 
                      />
                    </div>
                    {form.sections.length > 1 && (
                      <button type="button" onClick={() => removeSection(idx)} className="text-[10px] font-bold uppercase text-red-500 opacity-0 group-hover:opacity-100 hover:underline transition-all">
                        Delete Clause
                      </button>
                    )}
                  </div>
                  <RichTextEditor
                    value={section.content}
                    onChange={(value) => updateSection(idx, "content", value)}
                    placeholder="Describe the specific legal terms for this clause..."
                  />
                </article>
              ))}
            </div>
          </section>

          <footer className="flex justify-end gap-3 pt-8 border-t border-border-color/50">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-border-color px-6 py-3 text-sm font-bold text-muted hover:text-foreground">Cancel</button>
            <button 
              type="button" 
              onClick={onSave} 
              disabled={saving} 
              className="rounded-xl bg-foreground px-10 py-3 text-sm font-black text-surface hover:opacity-90 disabled:opacity-50 shadow-lg transition-all"
            >
              {saving ? "Synchronizing..." : editingId ? "Update Registry" : "Execute Agreement"}
            </button>
          </footer>
        </div>
      </SideDrawer>

      {/* ═══════════ TEMPLATE FORM MODAL ═══════════ */}
      <SideDrawer open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editingTemplateId ? "Edit Legal Blueprint" : "Create New Legal Blueprint"}>
        <div className="space-y-8 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Blueprint Registry</h4>
                <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Blueprint Title</label>
                    <input value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} className={inputClass} placeholder="e.g. Standard House Lease 2026" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Strategic Description</label>
                    <textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} rows={2} className={inputClass} placeholder="Internal description for administrative use..." />
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Financial Defaults</h4>
                <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Standard Rent</label>
                    <input type="number" value={templateForm.monthly_rent} onChange={(e) => setTemplateForm({ ...templateForm, monthly_rent: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold text-muted/60 uppercase">Standard Deposit</label>
                    <input type="number" value={templateForm.deposit_amount} onChange={(e) => setTemplateForm({ ...templateForm, deposit_amount: Number(e.target.value) })} className={inputClass} />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40">Standardized Clause Library</h4>
              <button type="button" onClick={addTemplateSection} className="flex items-center gap-1.5 rounded-lg bg-surface-elevated border border-border-color px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-all">
                <Plus size={12} />
                Add Clause Blueprint
              </button>
            </div>

            <div className="space-y-6">
              {templateForm.sections.map((section, idx) => (
                <article key={idx} className="group relative rounded-2xl border border-border-color bg-surface-elevated/10 p-6 transition-all hover:bg-surface-elevated/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-black text-surface">
                        {idx + 1}
                      </span>
                      <input 
                        placeholder="Clause Blueprint Heading" 
                        value={section.title} 
                        onChange={(e) => updateTemplateSection(idx, "title", e.target.value)} 
                        className="bg-transparent text-sm font-bold text-foreground outline-none border-b border-transparent focus:border-border-color transition-all min-w-[240px]" 
                      />
                    </div>
                    {templateForm.sections.length > 1 && (
                      <button type="button" onClick={() => removeTemplateSection(idx)} className="text-[10px] font-bold uppercase text-red-500 opacity-0 group-hover:opacity-100 hover:underline transition-all">
                        Remove Pattern
                      </button>
                    )}
                  </div>
                  <RichTextEditor
                    value={section.content}
                    onChange={(value) => updateTemplateSection(idx, "content", value)}
                    placeholder="Standard legal language for this clause pattern..."
                  />
                </article>
              ))}
            </div>
          </section>

          <footer className="flex justify-end gap-3 pt-8 border-t border-border-color/50">
            <button type="button" onClick={() => setTemplateModalOpen(false)} className="rounded-xl border border-border-color px-6 py-3 text-sm font-bold text-muted hover:text-foreground">Cancel</button>
            <button 
              type="button" 
              onClick={onSaveTemplate} 
              disabled={savingTemplate} 
              className="rounded-xl bg-foreground px-10 py-3 text-sm font-black text-surface hover:opacity-90 disabled:opacity-50 shadow-lg transition-all"
            >
              {savingTemplate ? "Archiving Blueprint..." : "Save Legal Blueprint"}
            </button>
          </footer>
        </div>
      </SideDrawer>

      {/* ═══════════ DELETE DIALOGS ═══════════ */}
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Contract" message={`Delete contract for ${deleteTarget?.tenantName}?`} confirmLabel="Delete" loading={deleting} />
      <ConfirmDialog open={!!deleteTemplateTarget} onClose={() => setDeleteTemplateTarget(null)} onConfirm={onDeleteTemplate} title="Delete Template" message={`Delete template "${deleteTemplateTarget?.title}"? This cannot be undone.`} confirmLabel="Delete" loading={deletingTemplate} />

      <DocumentShareModal
        isOpen={shareModalDoc.isOpen}
        onClose={() => setShareModalDoc((prev) => ({ ...prev, isOpen: false }))}
        documentTitle={shareModalDoc.documentTitle}
        documentType={shareModalDoc.documentType}
        documentHtml={shareModalDoc.documentHtml}
        documentUrl={shareModalDoc.documentUrl}
        fileNameBase={shareModalDoc.fileNameBase}
        ownerName={shareModalDoc.ownerName}
        ownerEmail={shareModalDoc.ownerEmail}
        defaultSubject={shareModalDoc.defaultSubject}
        defaultMessage={shareModalDoc.defaultMessage}
      />
    </ModulePage>
  );
}


