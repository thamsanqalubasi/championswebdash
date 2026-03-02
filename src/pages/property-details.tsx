import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ImageGallery } from "@/components/image-gallery";
import { supabase } from "@/lib/supabase";
import { fetchCompanyInfo, fetchAdminInfo, uploadFileToBucket, downloadHtmlDocument } from "@/lib/storage";
import { buildProfessionalInvoiceHtml } from "@/lib/document-templates";
import { useAuth } from "@/lib/auth";
import { sendEmail, sendWhatsApp } from "@/lib/notifications";
import { verifyAdminPin } from "@/lib/data";
import { billStatusMeta, frequencyLabel, type BillFrequency, type BillRow } from "@/lib/bills";
import {
  ArrowLeft,
  MapPin,
  Home,
  Tag,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Users,
  Image as ImageIcon,
  Plus,
  Upload,
  ChevronRight,
  MoreHorizontal,
  Mail,
  Phone,
  Send,
  Download,
  Eye,
  RefreshCw,
} from "lucide-react";
import { StatusBadge } from "@/components/data-table";

const PAGE_SIZE = 8;

type PropertyDetails = {
  id: string;
  name: string;
  type: string;
  address: string;
  status: string;
  monthlyRent: number;
  photos: string[];
};

type AssignedTenant = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
};

type PropertyInvoice = {
  id: string;
  tenantId: string;
  tenantName: string;
  month: string;
  dueDate: string;
  amount: number;
  status: string;
  pdfUrl: string;
};

type MaintenanceItem = {
  id: string;
  category: string;
  status: string;
  cost: number;
  createdAt: string;
};

type PropertyBill = BillRow;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "NAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildDueDate(monthKey: string, dueDay: number) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const safeMonth = Number.isFinite(month) ? month : 1;
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  const day = Math.max(1, Math.min(lastDay, dueDay));
  return `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitizePhoneToWhatsApp(input: string) {
  return input.replace(/\D/g, "");
}

function isFrequencyColumnMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();
  return lowered.includes("frequency") && lowered.includes("does not exist");
}

async function ensureShareableDocumentUrl(existingUrl: string, html: string, filename: string) {
  if (existingUrl && existingUrl.startsWith("http")) {
    return existingUrl;
  }

  const file = new File([html], filename, { type: "text/html" });
  return uploadFileToBucket("documents", "shared", file);
}

function DetailStat({ label, value, icon: Icon, colorClass = "text-foreground" }: { label: string; value: string; icon: any; colorClass?: string }) {
  return (
    <div className="rounded-xl border border-border-color bg-surface p-4 transition-all hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 ${colorClass}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">{label}</p>
          <p className={`text-lg font-bold tracking-tight ${colorClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function PropertyDetailsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { user } = useAuth();

  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [assignedTenants, setAssignedTenants] = useState<AssignedTenant[]>([]);
  const [unassignedTenants, setUnassignedTenants] = useState<Array<{ id: string; full_name: string }>>([]);
  const [invoices, setInvoices] = useState<PropertyInvoice[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [bills, setBills] = useState<PropertyBill[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [generatingTenantId, setGeneratingTenantId] = useState<string | null>(null);

  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // "Load more" state for sections
  const [tenantsLimit, setTenantsLimit] = useState(PAGE_SIZE);
  const [invoicesLimit, setInvoicesLimit] = useState(PAGE_SIZE);
  const [maintenanceLimit, setMaintenanceLimit] = useState(PAGE_SIZE);
  const [billsLimit, setBillsLimit] = useState(PAGE_SIZE);
  const [photosLimit, setPhotosLimit] = useState(PAGE_SIZE);

  // Regenerating / downloading invoice
  const [regeneratingInvoiceId, setRegeneratingInvoiceId] = useState<string | null>(null);

  // Photo gallery + delete
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [billPaymentTarget, setBillPaymentTarget] = useState<PropertyBill | null>(null);
  const [billPaymentStatus, setBillPaymentStatus] = useState<"paid" | "pending">("paid");
  const [billPaidAmount, setBillPaidAmount] = useState(0);
  const [billPaidDate, setBillPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [billPaymentPin, setBillPaymentPin] = useState("");
  const [savingBillPayment, setSavingBillPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!propertyId) {
        setError("Missing property id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const loadBillSchedules = async () => {
          const withFrequency = await supabase
            .from("property_bill_schedules")
            .select("id, title, property_id, amount, due_day, frequency, created_at")
            .eq("property_id", propertyId)
            .eq("is_active", true)
            .order("title");

          if (!withFrequency.error) {
            return withFrequency.data ?? [];
          }

          if (!isFrequencyColumnMissing(withFrequency.error)) {
            throw withFrequency.error;
          }

          const fallback = await supabase
            .from("property_bill_schedules")
            .select("id, title, property_id, amount, due_day, created_at")
            .eq("property_id", propertyId)
            .eq("is_active", true)
            .order("title");

          if (fallback.error) throw fallback.error;
          return (fallback.data ?? []).map((row) => ({ ...row, frequency: "monthly" }));
        };

        const [propertyResult, assignedTenantsResult, unassignedTenantsResult, invoicesResult, maintenanceResult, billSchedules, billMonthlyResult] =
          await Promise.all([
            supabase
              .from("properties")
              .select("id, name, type, address, status, monthly_rent, photos")
              .eq("id", propertyId)
              .single(),
            supabase
              .from("tenants")
              .select("id, full_name, email, phone, whatsapp_number")
              .eq("property_id", propertyId)
              .order("full_name", { ascending: true }),
            supabase
              .from("tenants")
              .select("id, full_name")
              .is("property_id", null)
              .order("full_name", { ascending: true }),
            supabase
              .from("invoices")
              .select("id, tenant_id, month, due_date, total_amount, status, pdf_url, tenants(full_name)")
              .eq("property_id", propertyId)
              .order("created_at", { ascending: false }),
            supabase
              .from("maintenance")
              .select("id, category, status, cost, created_at")
              .eq("property_id", propertyId)
              .order("created_at", { ascending: false })
              .limit(30),
            loadBillSchedules(),
            supabase
              .from("property_monthly_bills")
              .select("schedule_id, month, due_date, amount, status, paid_at")
              .eq("property_id", propertyId)
              .order("due_date", { ascending: false }),
          ]);

        if (propertyResult.error) throw propertyResult.error;
        if (assignedTenantsResult.error) throw assignedTenantsResult.error;
        if (unassignedTenantsResult.error) throw unassignedTenantsResult.error;
        if (invoicesResult.error) throw invoicesResult.error;
        if (maintenanceResult.error) throw maintenanceResult.error;
        if (billMonthlyResult.error) throw billMonthlyResult.error;

        if (!cancelled) {
          const propertyRow = propertyResult.data;
          setProperty({
            id: String(propertyRow.id),
            name: String(propertyRow.name ?? "Unnamed"),
            type: String(propertyRow.type ?? "house"),
            address: String(propertyRow.address ?? "-"),
            status: String(propertyRow.status ?? "vacant"),
            monthlyRent: Number(propertyRow.monthly_rent ?? 0),
            photos: Array.isArray(propertyRow.photos)
              ? propertyRow.photos.map((photo) => String(photo))
              : [],
          });

          setAssignedTenants(
            (assignedTenantsResult.data ?? []).map((row) => ({
              id: String(row.id ?? ""),
              fullName: String(row.full_name ?? "Unnamed Tenant"),
              email: String(row.email ?? ""),
              phone: String(row.phone ?? ""),
              whatsappNumber: String(row.whatsapp_number ?? row.phone ?? ""),
            })),
          );

          setUnassignedTenants(
            (unassignedTenantsResult.data ?? []).map((row) => ({
              id: String(row.id ?? ""),
              full_name: String(row.full_name ?? "Unnamed Tenant"),
            })),
          );

          setInvoices(
            (invoicesResult.data ?? []).map((row) => ({
              id: String(row.id ?? ""),
              tenantId: String(row.tenant_id ?? ""),
              tenantName: String((row.tenants as { full_name?: string } | null)?.full_name ?? "Tenant"),
              month: String(row.month ?? "-"),
              dueDate: String(row.due_date ?? "-"),
              amount: Number(row.total_amount ?? 0),
              status: String(row.status ?? "draft"),
              pdfUrl: String(row.pdf_url ?? ""),
            })),
          );

          setMaintenance(
            (maintenanceResult.data ?? []).map((row) => ({
              id: String(row.id ?? ""),
              category: String(row.category ?? "general"),
              status: String(row.status ?? "open"),
              cost: Number(row.cost ?? 0),
              createdAt: String(row.created_at ?? "-"),
            })),
          );

          const monthKey = currentMonthKey();
          const monthlyRows = (billMonthlyResult.data ?? []).map((row) => ({
            scheduleId: String(row.schedule_id ?? ""),
            month: String(row.month ?? ""),
            dueDate: String(row.due_date ?? ""),
            amount: Number(row.amount ?? 0),
            status: String(row.status ?? "pending"),
            paidAt: row.paid_at ? String(row.paid_at) : "",
          }));

          const monthlyBySchedule = new Map<string, typeof monthlyRows>();
          monthlyRows.forEach((row) => {
            const existing = monthlyBySchedule.get(row.scheduleId) ?? [];
            existing.push(row);
            monthlyBySchedule.set(row.scheduleId, existing);
          });

          setBills(
            billSchedules.map((row) => {
              const scheduleId = String(row.id ?? "");
              const perSchedule = monthlyBySchedule.get(scheduleId) ?? [];
              const currentCycle = perSchedule.find((entry) => entry.month === monthKey);
              const latestPaid = perSchedule.find((entry) => entry.status === "paid" && Boolean(entry.paidAt));
              const currentPaid = currentCycle?.status === "paid";
              const frequency = String((row as Record<string, unknown>).frequency ?? "monthly") as BillFrequency;

              return {
                id: scheduleId,
                name: String(row.title ?? "Unnamed Bill"),
                propertyId: String(row.property_id ?? ""),
                propertyName: String(propertyRow.name ?? "Property"),
                amount: Number(row.amount ?? 0),
                frequency,
                dueDay: Number(row.due_day ?? 1),
                status: currentPaid ? "paid" : "pending",
                startDate: String(currentCycle?.dueDate ?? row.created_at ?? `${monthKey}-01`),
                lastPaidDate: currentPaid
                  ? String((currentCycle?.paidAt ?? "").slice(0, 10))
                  : String((latestPaid?.paidAt ?? "").slice(0, 10)),
                lastPaidAmount: currentPaid
                  ? Number(currentCycle?.amount ?? 0)
                  : Number(latestPaid?.amount ?? 0),
              } as PropertyBill;
            }),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load property details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [propertyId, reloadKey]);

  const maintenanceCostTotal = useMemo(
    () => maintenance.reduce((sum, item) => sum + item.cost, 0),
    [maintenance],
  );

  const billsTotal = useMemo(
    () => bills.reduce((sum, item) => sum + item.amount, 0),
    [bills],
  );

  const invoicedTotal = useMemo(
    () => invoices.reduce((sum, item) => sum + item.amount, 0),
    [invoices],
  );

  const paidTotal = useMemo(
    () => invoices.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0),
    [invoices],
  );

  const outstandingTotal = invoicedTotal - paidTotal;

  const reload = () => setReloadKey((value) => value + 1);

  const assignTenant = async () => {
    if (!propertyId || !selectedTenantId) {
      return;
    }

    setAssigning(true);

    try {
      const { error: assignError } = await supabase
        .from("tenants")
        .update({ property_id: propertyId })
        .eq("id", selectedTenantId);

      if (assignError) throw assignError;

      const { error: propertyStatusError } = await supabase
        .from("properties")
        .update({ status: "occupied" })
        .eq("id", propertyId)
        .eq("status", "vacant");

      if (propertyStatusError) throw propertyStatusError;

      setSelectedTenantId("");
      reload();
    } catch (assignError) {
      alert(assignError instanceof Error ? assignError.message : "Could not assign tenant.");
    } finally {
      setAssigning(false);
    }
  };

  const addPhotoUrl = async () => {
    if (!propertyId || !property) {
      return;
    }

    const trimmedUrl = photoUrlInput.trim();
    if (!trimmedUrl) {
      alert("Enter a photo URL first.");
      return;
    }

    if (property.photos.includes(trimmedUrl)) {
      alert("This photo is already attached.");
      return;
    }

    setSavingPhoto(true);

    try {
      const updatedPhotos = [...property.photos, trimmedUrl];
      const { error: updateError } = await supabase
        .from("properties")
        .update({ photos: updatedPhotos })
        .eq("id", propertyId);

      if (updateError) throw updateError;

      setPhotoUrlInput("");
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not add property photo.");
    } finally {
      setSavingPhoto(false);
    }
  };

  const deletePhoto = async (index: number) => {
    if (!propertyId || !property) return;
    setDeletingPhoto(true);
    try {
      const updatedPhotos = property.photos.filter((_, i) => i !== index);
      const { error: updateError } = await supabase
        .from("properties")
        .update({ photos: updatedPhotos })
        .eq("id", propertyId);
      if (updateError) throw updateError;
      // Adjust gallery index if needed
      if (index >= updatedPhotos.length && updatedPhotos.length > 0) {
        setGalleryIndex(updatedPhotos.length - 1);
      }
      if (updatedPhotos.length === 0) {
        setGalleryOpen(false);
      }
      reload();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "Could not delete photo.");
    } finally {
      setDeletingPhoto(false);
    }
  };

  const uploadPhotoFile = async (file: File | null) => {
    if (!file || !propertyId || !property) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadFileToBucket("property-photos", propertyId, file);
      const updatedPhotos = [...property.photos, url];
      const { error: updateError } = await supabase
        .from("properties")
        .update({ photos: updatedPhotos })
        .eq("id", propertyId);
      if (updateError) throw updateError;
      reload();
    } catch (uploadError) {
      alert(uploadError instanceof Error ? uploadError.message : "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const generateInvoiceForTenant = async (tenant: AssignedTenant) => {
    if (!propertyId || !property) {
      return;
    }

    setGeneratingTenantId(tenant.id);

    try {
      const month = currentMonthKey();

      const { data: existingInvoice, error: existingError } = await supabase
        .from("invoices")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("property_id", propertyId)
        .eq("month", month)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingInvoice?.id) {
        alert("Invoice already exists for this tenant and month. Duplicate generation blocked.");
        return;
      }

      const dueDate = `${month}-01`;

      const { error: createError } = await supabase.from("invoices").insert({
        tenant_id: tenant.id,
        property_id: propertyId,
        month,
        total_amount: property.monthlyRent,
        status: "draft",
        due_date: dueDate,
      });

      if (createError) throw createError;

      reload();
      alert("Invoice generated.");
    } catch (createError) {
      alert(createError instanceof Error ? createError.message : "Could not generate invoice.");
    } finally {
      setGeneratingTenantId(null);
    }
  };

  const buildInvoiceHtml = async (invoice: PropertyInvoice) => {
    const [company, admin] = await Promise.all([
      fetchCompanyInfo(),
      fetchAdminInfo(user?.email ?? undefined),
    ]);
    return buildProfessionalInvoiceHtml(
      {
        invoiceId: invoice.id,
        tenantName: invoice.tenantName,
        propertyName: property?.name ?? "Property",
        month: invoice.month,
        dueDate: invoice.dueDate,
        status: invoice.status,
        lineItems: [{ description: `Rent for ${invoice.month}`, amount: invoice.amount }],
      },
      company,
      admin,
    );
  };

  const viewInvoice = async (invoice: PropertyInvoice) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to view the invoice."); return; }
    try {
      // If pdf_url is an HTTP link, redirect to it
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("http")) {
        previewWindow.location.href = invoice.pdfUrl;
        return;
      }
      // If pdf_url contains stored HTML, render it
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        previewWindow.document.open();
        previewWindow.document.write(invoice.pdfUrl);
        previewWindow.document.close();
        return;
      }
      // Otherwise generate professional invoice HTML on-the-fly
      const html = await buildInvoiceHtml(invoice);
      // Save it for future use
      await supabase.from("invoices").update({ pdf_url: html }).eq("id", invoice.id);
      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not view invoice.");
      previewWindow.close();
    }
  };

  const sendInvoiceEmail = async (invoice: PropertyInvoice) => {
    const tenant = assignedTenants.find((item) => item.id === invoice.tenantId);
    if (!tenant?.email) { alert("No tenant email address available."); return; }
    try {
      const html = await buildInvoiceHtml(invoice);
      const company = await fetchCompanyInfo();
      const subject = `Invoice ${invoice.month} - ${property?.name ?? "Property"}`;
      const result = await sendEmail({
        to: tenant.email,
        recipientName: tenant.fullName,
        subject,
        bodyText: `Please find your invoice for <strong>${invoice.month}</strong> attached below. The total amount due is <strong>${formatCurrency(invoice.amount)}</strong>.`,
        documentHtml: html,
        attachmentFilename: `invoice-${invoice.id}.html`,
        companyName: company.companyName,
      });
      if (result.sent) { alert("Invoice sent via email successfully!"); }
    } catch (e) { alert(e instanceof Error ? e.message : "Could not send email."); }
  };

  const sendInvoiceWhatsApp = async (invoice: PropertyInvoice) => {
    const tenant = assignedTenants.find((item) => item.id === invoice.tenantId);
    const phone = sanitizePhoneToWhatsApp(tenant?.whatsappNumber || tenant?.phone || "");
    if (!phone) { alert("No tenant WhatsApp number available."); return; }
    try {
      const message = `Invoice ${invoice.month}: ${formatCurrency(invoice.amount)} due on ${invoice.dueDate}.`;
      const html = await buildInvoiceHtml(invoice);
      const mediaUrl = await ensureShareableDocumentUrl(invoice.pdfUrl, html, `invoice-${invoice.id}.html`);
      const result = await sendWhatsApp({ to: `+${phone}`, message, mediaUrl });
      if (result.sent) { alert("Invoice sent via WhatsApp successfully!"); }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not send WhatsApp.");
    }
  };

  const regenerateInvoice = async (invoice: PropertyInvoice) => {
    if (!property) return;
    setRegeneratingInvoiceId(invoice.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const month = currentMonthKey();
      const html = await buildInvoiceHtml({ ...invoice, month, dueDate: today });
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ pdf_url: html, due_date: today, month, updated_at: new Date().toISOString() })
        .eq("id", invoice.id);
      if (updateError) throw updateError;
      reload();
      alert("Invoice regenerated with today's date.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not regenerate invoice.");
    } finally {
      setRegeneratingInvoiceId(null);
    }
  };

  const downloadInvoice = async (invoice: PropertyInvoice) => {
    try {
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("http")) {
        const link = document.createElement("a");
        link.href = invoice.pdfUrl;
        link.download = `invoice-${invoice.id}.pdf`;
        link.click();
        return;
      }
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        downloadHtmlDocument(invoice.pdfUrl, `invoice-${invoice.id}.html`);
        return;
      }
      const html = await buildInvoiceHtml(invoice);
      downloadHtmlDocument(html, `invoice-${invoice.id}.html`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not download invoice.");
    }
  };

  const openBillPaymentModal = (bill: PropertyBill, status: "paid" | "pending") => {
    setBillPaymentTarget(bill);
    setBillPaymentStatus(status);
    setBillPaidAmount(bill.lastPaidAmount || bill.amount);
    setBillPaidDate(new Date().toISOString().slice(0, 10));
    setBillPaymentPin("");
  };

  const saveBillPayment = async () => {
    if (!billPaymentTarget) return;
    if (billPaymentStatus === "paid" && billPaidAmount <= 0) {
      alert("Please enter a valid paid amount.");
      return;
    }

    setSavingBillPayment(true);
    try {
      const pinOk = await verifyAdminPin(billPaymentPin);
      if (!pinOk) {
        alert("Invalid admin PIN.");
        return;
      }

      const monthKey = currentMonthKey();
      const dueDate = buildDueDate(monthKey, billPaymentTarget.dueDay);
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.email || "Admin";

      const { data: existingMonthly, error: existingMonthlyError } = await supabase
        .from("property_monthly_bills")
        .select("id")
        .eq("schedule_id", billPaymentTarget.id)
        .eq("month", monthKey)
        .maybeSingle();
      if (existingMonthlyError) throw existingMonthlyError;

      const monthlyPayload = {
        schedule_id: billPaymentTarget.id,
        property_id: billPaymentTarget.propertyId,
        month: monthKey,
        due_date: dueDate,
        amount: billPaymentStatus === "paid" ? billPaidAmount : billPaymentTarget.amount,
        status: billPaymentStatus,
        paid_at: billPaymentStatus === "paid" ? `${billPaidDate}T12:00:00.000Z` : null,
        executed_by_name: executorName,
      };

      if (existingMonthly?.id) {
        const { error: updateError } = await supabase.from("property_monthly_bills").update(monthlyPayload).eq("id", existingMonthly.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("property_monthly_bills").insert(monthlyPayload);
        if (insertError) throw insertError;
      }

      setBillPaymentTarget(null);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not update bill payment.");
    } finally {
      setSavingBillPayment(false);
    }
  };

  return (
    <ModulePage
      title={property ? property.name : "Property Details"}
      description="Comprehensive operational and financial overview for this unit."
    >
      <div className="mb-6 flex items-center justify-between">
        <Link to="/properties" className="flex items-center gap-2 text-sm font-bold text-muted hover:text-foreground transition-colors group">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-color group-hover:border-foreground/20 group-hover:bg-surface-elevated transition-all">
            <ArrowLeft size={16} />
          </div>
          <span>Back to Properties</span>
        </Link>
        {property && (
          <div className="flex items-center gap-3">
            <StatusBadge status={property.status} />
            <div className="h-4 w-px bg-border-color/50 mx-1" />
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <Home size={14} />
              <span className="capitalize">{property.type}</span>
            </div>
          </div>
        )}
      </div>

      {loading && <LoadingState label="Retreiving property data..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && property && (
        <div className="space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat label="Monthly Rent" value={formatCurrency(property.monthlyRent)} icon={DollarSign} colorClass="text-foreground" />
            <DetailStat label="Outstanding" value={formatCurrency(outstandingTotal)} icon={AlertCircle} colorClass={outstandingTotal > 0 ? "text-red-600" : "text-green-600"} />
            <DetailStat label="Paid (Total)" value={formatCurrency(paidTotal)} icon={CheckCircle2} colorClass="text-green-600" />
            <DetailStat label="Maintenance" value={formatCurrency(maintenanceCostTotal)} icon={Wrench} colorClass="text-amber-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Primary Details Panel */}
            <article className="lg:col-span-2 space-y-6">
              <section className="rounded-2xl border border-border-color bg-surface overflow-hidden">
                <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Property Location</h3>
                  <MapPin size={16} className="text-muted/40" />
                </header>
                <div className="p-6">
                  <p className="text-xl font-bold tracking-tight text-foreground">{property.address || "Address not provided"}</p>
                </div>
              </section>

              {/* Assigned Tenants Section */}
              <section className="rounded-2xl border border-border-color bg-surface overflow-hidden">
                <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Occupancy & Tenants</h3>
                  <Users size={16} className="text-muted/40" />
                </header>
                <div className="p-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-3 bg-surface-elevated/50 p-4 rounded-xl ring-1 ring-border-color/40">
                    <select
                      value={selectedTenantId}
                      onChange={(event) => setSelectedTenantId(event.target.value)}
                      className="flex-1 min-w-[200px] rounded-lg border border-border-color bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
                    >
                      <option value="">Assign a new tenant...</option>
                      {unassignedTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>{tenant.full_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={assignTenant}
                      disabled={!selectedTenantId || assigning}
                      className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      <Plus size={16} />
                      <span>{assigning ? "Assigning..." : "Assign Tenant"}</span>
                    </button>
                  </div>

                  {assignedTenants.length === 0 ? (
                    <EmptyState title="No active tenants" description="This unit is currently listed as vacant." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border-color/40 text-left text-muted/50 uppercase text-[10px] font-bold tracking-wider">
                            <th className="px-4 py-3">Full Name</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/30">
                          {assignedTenants.slice(0, tenantsLimit).map((tenant) => (
                            <tr key={tenant.id} className="group hover:bg-surface-elevated/20 transition-colors">
                              <td className="px-4 py-4 font-bold text-foreground">{tenant.fullName}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-4 text-muted/80">
                                  {tenant.phone && <div className="flex items-center gap-1.5"><Phone size={12} /><span>{tenant.phone}</span></div>}
                                  {tenant.email && <div className="flex items-center gap-1.5"><Mail size={12} /><span>{tenant.email}</span></div>}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => generateInvoiceForTenant(tenant)}
                                  disabled={generatingTenantId === tenant.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground transition-all disabled:opacity-50"
                                >
                                  <FileText size={14} />
                                  <span>{generatingTenantId === tenant.id ? "Processing..." : "Generate Invoice"}</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {assignedTenants.length > tenantsLimit && (
                        <button type="button" onClick={() => setTenantsLimit((v) => v + PAGE_SIZE)} className="mt-4 w-full rounded-xl border border-border-color/50 py-2.5 text-xs font-bold uppercase tracking-wider text-muted hover:bg-surface-elevated transition-all">
                          Load More Tenants
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Maintenance List Section */}
              <section className="rounded-2xl border border-border-color bg-surface overflow-hidden">
                <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Maintenance Log</h3>
                  <Wrench size={16} className="text-muted/40" />
                </header>
                <div className="p-6">
                  {maintenance.length === 0 ? (
                    <EmptyState title="Clean history" description="No maintenance events recorded for this property." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border-color/40 text-left text-muted/50 uppercase text-[10px] font-bold tracking-wider">
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Cost</th>
                            <th className="px-4 py-3 text-right">Logged Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/30">
                          {maintenance.slice(0, maintenanceLimit).map((item) => (
                            <tr key={item.id} className="group hover:bg-surface-elevated/20 transition-colors">
                              <td className="px-4 py-4 font-bold capitalize text-foreground">{item.category}</td>
                              <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                              <td className="px-4 py-4 font-medium text-foreground">{formatCurrency(item.cost)}</td>
                              <td className="px-4 py-4 text-right text-muted/80">{String(item.createdAt).slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {maintenance.length > maintenanceLimit && (
                        <button type="button" onClick={() => setMaintenanceLimit((v) => v + PAGE_SIZE)} className="mt-4 w-full rounded-xl border border-border-color/50 py-2.5 text-xs font-bold uppercase tracking-wider text-muted hover:bg-surface-elevated transition-all">
                          Load Full Maintenance Log
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </article>

            {/* Side Column: Media & Finance Actions */}
            <aside className="space-y-6">
              {/* Media Gallery Panel */}
              <section className="rounded-2xl border border-border-color bg-surface overflow-hidden">
                <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Media Gallery</h3>
                  <ImageIcon size={16} className="text-muted/40" />
                </header>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {property.photos.slice(0, 4).map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => { setGalleryIndex(idx); setGalleryOpen(true); }}
                        className="aspect-square overflow-hidden rounded-xl border border-border-color/50 bg-surface-elevated group"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </button>
                    ))}
                    {property.photos.length > 4 && (
                      <button
                        type="button"
                        onClick={() => { setGalleryIndex(4); setGalleryOpen(true); }}
                        className="aspect-square flex items-center justify-center rounded-xl bg-surface-elevated/50 border border-dashed border-border-color text-muted font-bold text-xs"
                      >
                        +{property.photos.length - 4} More
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-color py-3 text-xs font-bold text-muted hover:border-foreground/20 hover:text-foreground transition-all">
                      <Upload size={14} />
                      <span>{uploadingPhoto ? "Uploading..." : "Upload Images"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => void uploadPhotoFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* Financial Actions Panel */}
              <section className="rounded-2xl border border-border-color bg-surface overflow-hidden">
                <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Quick Actions</h3>
                  <Tag size={16} className="text-muted/40" />
                </header>
                <div className="p-4 space-y-2">
                  <Link
                    to={`/finance/bills?create=1&propertyId=${property.id}`}
                    className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-surface-elevated/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-900/20">
                        <DollarSign size={16} />
                      </div>
                      <span className="text-sm font-bold text-foreground">Schedule Bill</span>
                    </div>
                    <ChevronRight size={16} className="text-muted/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-surface-elevated/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20">
                        <Wrench size={16} />
                      </div>
                      <span className="text-sm font-bold text-foreground">Open Work Order</span>
                    </div>
                    <ChevronRight size={16} className="text-muted/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </section>
            </aside>
          </div>

          {/* Bottom Full-Width Tables */}
          <div className="space-y-6">
            {/* Bills Section */}
            <article className="rounded-2xl border border-border-color bg-surface overflow-hidden">
              <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Recurrent Bills</h3>
                  <p className="text-[10px] text-muted font-medium mt-0.5">Automated schedules for this property</p>
                </div>
                <DollarSign size={16} className="text-muted/40" />
              </header>
              <div className="p-0 overflow-x-auto">
                {bills.length === 0 ? (
                  <div className="p-12"><EmptyState title="No scheduled bills" description="Recurring bills will appear here once configured in Finance." /></div>
                ) : (
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-color/40 text-left text-muted/50 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">Bill Name</th>
                        <th className="px-6 py-4">Frequency</th>
                        <th className="px-6 py-4">Typical Amount</th>
                        <th className="px-6 py-4">Cycle Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/30">
                      {bills.slice(0, billsLimit).map((bill) => {
                        const meta = billStatusMeta(bill);
                        return (
                          <tr key={bill.id} className="group hover:bg-surface-elevated/20 transition-colors">
                            <td className="px-6 py-4 font-bold text-foreground">{bill.name}</td>
                            <td className="px-6 py-4 text-muted/80">{frequencyLabel(bill.frequency)}</td>
                            <td className="px-6 py-4 font-medium text-foreground">{formatCurrency(bill.amount)}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                                meta.tone === "paid" ? "bg-green-50 text-green-700 border-green-200/50 dark:bg-green-900/20"
                                : meta.tone === "overdue" ? "bg-red-50 text-red-700 border-red-200/50 dark:bg-red-900/20"
                                : "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-900/20"
                              }`}>
                                <Clock size={12} />
                                {meta.text}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => openBillPaymentModal(bill, "paid")} className="px-3 py-1.5 rounded-lg border border-border-color bg-surface-elevated text-xs font-bold text-muted hover:text-foreground transition-all">Record Payment</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </article>

            {/* Invoices Section */}
            <article className="rounded-2xl border border-border-color bg-surface overflow-hidden">
              <header className="px-6 py-4 border-b border-border-color/50 bg-surface-elevated/30 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted/60">Invoice Actions</h3>
                  <p className="text-[10px] text-muted font-medium mt-0.5">Billing history and sharing options</p>
                </div>
                <FileText size={16} className="text-muted/40" />
              </header>
              <div className="p-0 overflow-x-auto">
                {invoices.length === 0 ? (
                  <div className="p-12"><EmptyState title="No invoice history" description="History will populate as monthly invoices are generated." /></div>
                ) : (
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-color/40 text-left text-muted/50 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">Tenant</th>
                        <th className="px-6 py-4 text-center">Month</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Distribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/30">
                      {invoices.slice(0, invoicesLimit).map((invoice) => (
                        <tr key={invoice.id} className="group hover:bg-surface-elevated/20 transition-colors">
                          <td className="px-6 py-4 font-bold text-foreground">{invoice.tenantName}</td>
                          <td className="px-6 py-4 text-center text-muted/80 font-medium">{invoice.month}</td>
                          <td className="px-6 py-4 font-bold text-foreground">{formatCurrency(invoice.amount)}</td>
                          <td className="px-6 py-4 text-center"><StatusBadge status={invoice.status} /></td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => void viewInvoice(invoice)} title="Preview" className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all"><Eye size={14} /></button>
                              <button onClick={() => void downloadInvoice(invoice)} title="Download" className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all"><Download size={14} /></button>
                              <button onClick={() => void sendInvoiceWhatsApp(invoice)} title="WhatsApp" className="p-1.5 rounded-lg border border-border-color hover:bg-green-600 hover:text-white hover:border-green-600 transition-all"><Send size={14} /></button>
                              <button onClick={() => void sendInvoiceEmail(invoice)} title="Email" className="p-1.5 rounded-lg border border-border-color hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all"><Mail size={14} /></button>
                              <button onClick={() => void regenerateInvoice(invoice)} disabled={regeneratingInvoiceId === invoice.id} title="Regenerate" className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all"><RefreshCw size={14} className={regeneratingInvoiceId === invoice.id ? "animate-spin" : ""} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>
          </div>
        </div>
      )}

      {/* Bill Payment Modal - Improved layout */}
      <Modal open={Boolean(billPaymentTarget)} onClose={() => setBillPaymentTarget(null)} title={billPaymentStatus === "paid" ? "Record Bill Payment" : "Set Bill To Unpaid"}>
        <div className="space-y-5 py-2">
          <div className="rounded-xl bg-surface-elevated/50 p-4 ring-1 ring-border-color/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">Selected Schedule</p>
            <p className="text-base font-bold text-foreground mt-1">{billPaymentTarget?.name}</p>
          </div>

          {billPaymentStatus === "paid" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted/80">Amount Paid (NAD)</label>
                <input type="number" min={0} value={billPaidAmount} onChange={(event) => setBillPaidAmount(Number(event.target.value))} className="w-full rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted/80">Paid Date</label>
                <input type="date" value={billPaidDate} onChange={(event) => setBillPaidDate(event.target.value)} className="w-full rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5 transition-all" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted/80">Administrator PIN</label>
            <input type="password" value={billPaymentPin} onChange={(event) => setBillPaymentPin(event.target.value)} placeholder="••••" className="w-full rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:ring-2 focus:ring-foreground/5 transition-all" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setBillPaymentTarget(null)} className="flex-1 rounded-xl border border-border-color py-3 text-sm font-bold text-muted hover:bg-surface-elevated transition-all">Cancel</button>
            <button type="button" onClick={() => void saveBillPayment()} disabled={savingBillPayment} className="flex-[2] rounded-xl bg-foreground py-3 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50">
              {savingBillPayment ? "Processing..." : "Confirm & Save"}
            </button>
          </div>
        </div>
      </Modal>

      <ImageGallery images={property?.photos ?? []} currentIndex={galleryIndex} open={galleryOpen} onClose={() => setGalleryOpen(false)} onNavigate={setGalleryIndex} onDelete={deletePhoto} deleting={deletingPhoto} />
    </ModulePage>
  );
}
