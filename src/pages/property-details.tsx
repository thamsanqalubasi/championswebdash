import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { supabase } from "@/lib/supabase";

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sanitizePhoneToWhatsApp(input: string) {
  return input.replace(/\D/g, "");
}

export default function PropertyDetailsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [assignedTenants, setAssignedTenants] = useState<AssignedTenant[]>([]);
  const [unassignedTenants, setUnassignedTenants] = useState<Array<{ id: string; full_name: string }>>([]);
  const [invoices, setInvoices] = useState<PropertyInvoice[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [generatingTenantId, setGeneratingTenantId] = useState<string | null>(null);

  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);

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
        const [propertyResult, assignedTenantsResult, unassignedTenantsResult, invoicesResult, maintenanceResult] =
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
          ]);

        if (propertyResult.error) throw propertyResult.error;
        if (assignedTenantsResult.error) throw assignedTenantsResult.error;
        if (unassignedTenantsResult.error) throw unassignedTenantsResult.error;
        if (invoicesResult.error) throw invoicesResult.error;
        if (maintenanceResult.error) throw maintenanceResult.error;

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

  const sendInvoiceEmail = (invoice: PropertyInvoice) => {
    const tenant = assignedTenants.find((item) => item.id === invoice.tenantId);
    const subject = encodeURIComponent(`Invoice ${invoice.month} - ${property?.name ?? "Property"}`);
    const body = encodeURIComponent(
      `Hello ${tenant?.fullName ?? "Tenant"},\n\nYour invoice (${invoice.month}) amount is ${formatCurrency(invoice.amount)}.\nDue date: ${invoice.dueDate}.\n\nRegards`,
    );

    if (!tenant?.email) {
      alert("No tenant email address available.");
      return;
    }

    window.open(`mailto:${tenant.email}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  };

  const sendInvoiceWhatsApp = (invoice: PropertyInvoice) => {
    const tenant = assignedTenants.find((item) => item.id === invoice.tenantId);
    const phone = sanitizePhoneToWhatsApp(tenant?.whatsappNumber || tenant?.phone || "");

    if (!phone) {
      alert("No tenant WhatsApp number available.");
      return;
    }

    const text = encodeURIComponent(
      `Invoice ${invoice.month}: ${formatCurrency(invoice.amount)} due on ${invoice.dueDate}.`,
    );

    window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <ModulePage
      title={property ? `Property Details: ${property.name}` : "Property Details"}
      description="View maintenance, assigned tenants, photos, and financial breakdown for one property."
    >
      <div className="mb-4">
        <Link to="/properties" className="text-sm text-muted underline">
          Back to Properties
        </Link>
      </div>

      {loading && <LoadingState label="Loading property details..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && property && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <article className="rounded-lg border border-border-color bg-surface p-4 lg:col-span-2">
              <p className="text-xs text-muted">Address</p>
              <p className="mt-1 text-sm">{property.address || "-"}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Type</p>
                  <p>{property.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Status</p>
                  <p className="capitalize">{property.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Monthly Rent</p>
                  <p>{formatCurrency(property.monthlyRent)}</p>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-xs text-muted">Invoiced</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(invoicedTotal)}</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-xs text-muted">Outstanding</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(outstandingTotal)}</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-xs text-muted">Paid</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(paidTotal)}</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-xs text-muted">Maintenance Cost</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(maintenanceCostTotal)}</p>
            </article>
          </div>

          <article className="rounded-lg border border-border-color bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Assigned Tenants</h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTenantId}
                  onChange={(event) => setSelectedTenantId(event.target.value)}
                  className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
                >
                  <option value="">Assign unassigned tenant...</option>
                  {unassignedTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={assignTenant}
                  disabled={!selectedTenantId || assigning}
                  className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>

            {assignedTenants.length === 0 ? (
              <EmptyState
                title="No assigned tenants"
                description="Assign a tenant to this property to enable rent recording and invoice generation."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted">
                      <th className="px-3 py-2 font-medium">Tenant</th>
                      <th className="px-3 py-2 font-medium">Contact</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedTenants.map((tenant) => (
                      <tr key={tenant.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{tenant.fullName}</td>
                        <td className="px-3 py-3 text-muted">{tenant.phone || "-"}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => generateInvoiceForTenant(tenant)}
                            disabled={generatingTenantId === tenant.id}
                            className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated disabled:opacity-50"
                          >
                            {generatingTenantId === tenant.id ? "Generating..." : "Generate Invoice"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Property Pictures</h3>
            <div className="mb-3 flex gap-2">
              <input
                type="url"
                value={photoUrlInput}
                onChange={(event) => setPhotoUrlInput(event.target.value)}
                placeholder="Paste picture URL"
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addPhotoUrl}
                disabled={savingPhoto}
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {savingPhoto ? "Uploading..." : "Upload Picture"}
              </button>
            </div>

            {property.photos.length === 0 ? (
              <EmptyState title="No pictures" description="Upload property pictures to keep visual records." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {property.photos.map((photoUrl) => (
                  <a
                    key={photoUrl}
                    href={photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-md border border-border-color bg-surface-elevated"
                  >
                    <img src={photoUrl} alt="Property" className="h-40 w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Maintenance</h3>
            {maintenance.length === 0 ? (
              <EmptyState title="No maintenance items" description="No maintenance records linked to this property yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted">
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Cost</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenance.map((item) => (
                      <tr key={item.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 text-muted capitalize">{item.category}</td>
                        <td className="px-3 py-3 text-muted capitalize">{item.status}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(item.cost)}</td>
                        <td className="px-3 py-3 text-muted">{String(item.createdAt).slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Invoice Actions</h3>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" description="Generate invoices from assigned tenant actions." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted">
                      <th className="px-3 py-2 font-medium">Tenant</th>
                      <th className="px-3 py-2 font-medium">Month</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{invoice.tenantName}</td>
                        <td className="px-3 py-3 text-muted">{invoice.month}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(invoice.amount)}</td>
                        <td className="px-3 py-3 text-muted capitalize">{invoice.status}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!invoice.pdfUrl) {
                                  alert("No PDF linked to this invoice yet.");
                                  return;
                                }
                                window.open(invoice.pdfUrl, "_blank", "noopener,noreferrer");
                              }}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              View PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => sendInvoiceEmail(invoice)}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              Send Email
                            </button>
                            <button
                              type="button"
                              onClick={() => sendInvoiceWhatsApp(invoice)}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              Send WhatsApp
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      )}
    </ModulePage>
  );
}
