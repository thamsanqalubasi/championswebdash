import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
  ArrowRight,
  UserCheck,
  ShieldAlert,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  DollarSign,
  Package,
  Layers,
  Send,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { isValidUuid } from "@/lib/data";
import { Link } from "react-router-dom";

export type ProcurementRequestItem = {
  id: string;
  companyId: string;
  itemName: string;
  category: string;
  itemSpecifications: string;
  quantity: number;
  unit: string;
  urgency: "standard" | "high" | "emergency";
  estimatedCost: number;
  justification: string;
  requestingDepartment: string;
  requestedByName: string;
  requestedByEmail: string;
  approvalChannel: "manager" | "admin" | "self_approval";
  approverName: string;
  approverEmail: string;
  approvalStatus: "pending_approval" | "approved" | "rejected" | "self_approved";
  approvalNotes?: string;
  quoteFileUrl?: string;
  quoteFileName?: string;
  attachments?: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }>;
  pipelineStage: string;
  createdAt: string;
  updatedAt: string;
  events?: Array<{
    id: string;
    action: string;
    actorName: string;
    notes?: string;
    createdAt: string;
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialTab?: "request" | "requests" | "approvals";
};

const CATEGORIES = [
  "Tools & Hardware",
  "Cleaning & Sanitization Supplies",
  "Electrical & Plumbing Parts",
  "Hospitality Linens & Guest Amenities",
  "Office Supplies & Stationery",
  "IT, Computers & Electronics",
  "Furniture & Room Fixtures",
  "Kitchen, F&B & Dining",
  "Safety, Medical & PPE",
  "Maintenance & Building Materials",
  "Other",
];

const DEPARTMENTS = [
  "Maintenance",
  "Housekeeping",
  "Front Desk",
  "Food & Beverage",
  "Administration",
  "IT & Systems",
  "Stores & Inventory",
  "Security",
  "Management",
  "General",
];

export function ProcurementRequestModal({ open, onClose, initialTab = "request" }: Props) {
  const { user, currentCompany, currentCompanyUser, isSuperAdmin, isAdmin } = useAuth();
  const { format: formatCurrency, symbol: currencySymbol } = useCurrency();

  const [activeTab, setActiveTab] = useState<"request" | "requests" | "approvals">(initialTab);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Staff & managers list for approval routing
  const [companyStaff, setCompanyStaff] = useState<Array<{ id: string; name: string; email: string; role: string; department: string }>>([]);

  // Requests state
  const [requests, setRequests] = useState<ProcurementRequestItem[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [requestsFilter, setRequestsFilter] = useState<"all" | "my" | "pending" | "approved" | "completed" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Approval action state
  const [approvalModalItem, setApprovalModalItem] = useState<ProcurementRequestItem | null>(null);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Form State
  const [formData, setFormData] = useState<{
    itemName: string;
    category: string;
    itemSpecifications: string;
    quantity: string;
    unit: string;
    urgency: "standard" | "high" | "emergency";
    estimatedCost: string;
    justification: string;
    requestingDepartment: string;
    approvalRouting: string;
    selectedApproverEmail: string;
    quoteFileUrl: string;
    quoteFileName: string;
    attachments: Array<{ name: string; url: string; size?: number; type?: string }>;
  }>({
    itemName: "",
    category: CATEGORIES[0],
    itemSpecifications: "",
    quantity: "1",
    unit: "units",
    urgency: "standard",
    estimatedCost: "",
    justification: "",
    requestingDepartment: (currentCompanyUser?.department as string) || "Maintenance",
    approvalRouting: "manager", // "manager" | "admin" | "self_approval"
    selectedApproverEmail: "",
    quoteFileUrl: "",
    quoteFileName: "",
    attachments: [],
  });

  const isProcurementOrAdmin = useMemo(() => {
    const role = (currentCompanyUser?.roleLevel || (currentCompanyUser as any)?.role || "").toLowerCase();
    const dept = (currentCompanyUser?.department || "").toLowerCase();
    return (
      role === "admin" ||
      role === "super_admin" ||
      role === "manager" ||
      role === "all_rights" ||
      dept === "procurement" ||
      dept === "admin" ||
      Boolean(isSuperAdmin) ||
      Boolean(isAdmin)
    );
  }, [currentCompanyUser, isSuperAdmin, isAdmin]);

  // Load staff list for approval dropdown
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setSuccessMsg(null);
    setErrorMsg(null);

    async function loadStaffAndRequests() {
      setLoading(true);
      const compId = currentCompany?.id;

      try {
        // 1. Fetch company staff for approval routing
        if (compId && isValidUuid(compId)) {
          const { data: cuData } = await supabase
            .from("company_users")
            .select("id, user_id, department, role, users(id, email, full_name, raw_user_meta_data)")
            .eq("company_id", compId);

          if (cuData && cuData.length > 0) {
            const mapped = cuData
              .map((cu: any) => {
                const u = cu.users;
                const name = u?.raw_user_meta_data?.full_name || u?.full_name || u?.email?.split("@")[0] || "Staff Member";
                const email = u?.email || "";
                return {
                  id: cu.user_id || cu.id,
                  name,
                  email,
                  role: cu.role || "Staff",
                  department: cu.department || "General",
                };
              })
              .filter((s) => s.email && s.email.toLowerCase() !== user?.email?.toLowerCase());

            setCompanyStaff(mapped);

            // Default to first manager/senior if available
            const firstManager = mapped.find(
              (s) => s.role.toLowerCase().includes("manager") || s.role.toLowerCase().includes("admin") || s.role.toLowerCase().includes("senior")
            );
            if (firstManager) {
              setFormData((prev) => ({ ...prev, selectedApproverEmail: firstManager.email }));
            } else if (mapped.length > 0) {
              setFormData((prev) => ({ ...prev, selectedApproverEmail: mapped[0].email }));
            }
          }
        }

        // 2. Fetch existing procurement requests
        await loadRequestsList();
      } catch (err) {
        console.warn("Error initializing procurement modal:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadStaffAndRequests();
  }, [open, currentCompany?.id, initialTab]);

  const loadRequestsList = async () => {
    const compId = currentCompany?.id;
    let combinedList: ProcurementRequestItem[] = [];

    // Check localStorage first
    const storageKey = `procurement_requests_${compId || "local"}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        combinedList = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load local procurement requests", e);
    }

    // Try fetching from Supabase procurement_requests table
    if (compId && isValidUuid(compId)) {
      try {
        const { data: dbData, error: dbErr } = await supabase
          .from("procurement_requests")
          .select("*")
          .eq("company_id", compId)
          .order("created_at", { ascending: false });

        if (!dbErr && dbData && dbData.length > 0) {
          const dbMapped: ProcurementRequestItem[] = dbData.map((row: any) => ({
            id: row.id,
            companyId: row.company_id,
            itemName: row.item_name || row.title || "Procurement Item",
            category: row.category || "General",
            itemSpecifications: row.item_specifications || row.specifications || "",
            quantity: Number(row.quantity || 1),
            unit: row.unit || "units",
            urgency: (row.urgency as any) || "standard",
            estimatedCost: Number(row.estimated_cost || row.total_approved_amount || 0),
            justification: row.justification || "",
            requestingDepartment: row.requesting_department || "Maintenance",
            requestedByName: row.requested_by_name || "Staff",
            requestedByEmail: row.requested_by_email || "",
            approvalChannel: (row.approval_channel as any) || "manager",
            approverName: row.approver_name || "Manager",
            approverEmail: row.approver_email || "",
            approvalStatus: (row.approval_status as any) || (row.pipeline_stage === "dept_manager_approval" ? "pending_approval" : "approved"),
            approvalNotes: row.approval_notes,
            quoteFileUrl: row.quote_file_url,
            quoteFileName: row.quote_file_name,
            pipelineStage: row.pipeline_stage || "dept_manager_approval",
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
            events: row.events || [],
          }));

          // Merge without duplicates by ID
          const existingIds = new Set(dbMapped.map((r) => r.id));
          const uniqueLocal = combinedList.filter((r) => !existingIds.has(r.id));
          combinedList = [...dbMapped, ...uniqueLocal];
        }
      } catch (err) {
        console.warn("Supabase procurement_requests query notice:", err);
      }
    }

    setRequests(combinedList);
  };

  // Handle quote & supporting file attachments
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    fileList.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds 10MB limit. Please upload a smaller document.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEv) => {
        const dataUri = loadEv.target?.result as string;
        setFormData((prev) => ({
          ...prev,
          quoteFileUrl: prev.quoteFileUrl || dataUri,
          quoteFileName: prev.quoteFileName || file.name,
          attachments: [
            ...prev.attachments,
            {
              name: file.name,
              url: dataUri,
              size: file.size,
              type: file.type || 'document',
            }
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeModalAttachment = (index: number) => {
    setFormData((prev) => {
      const updated = prev.attachments.filter((_, i) => i !== index);
      return {
        ...prev,
        attachments: updated,
        quoteFileName: updated[0]?.name || "",
        quoteFileUrl: updated[0]?.url || "",
      };
    });
  };

  // Handle Create Procurement Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName.trim()) {
      setErrorMsg("Please enter an item name or description.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const compId = currentCompany?.id || "local";
    const now = new Date().toISOString();
    const requestId = `proc-${Date.now()}`;

    // Determine approval status and approver
    let approverName = "";
    let approverEmail = "";
    let initialApprovalStatus: ProcurementRequestItem["approvalStatus"] = "pending_approval";
    let initialPipelineStage = "dept_manager_approval";

    if (formData.approvalRouting === "self_approval") {
      approverName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Self-Approved";
      approverEmail = user?.email || "";
      initialApprovalStatus = "self_approved";
      initialPipelineStage = "quotation_gathering"; // routes directly to procurement department
    } else if (formData.approvalRouting === "admin") {
      approverName = "Super Admin / General Manager";
      approverEmail = "admin@paimbabook.com";
      initialApprovalStatus = "pending_approval";
      initialPipelineStage = "admin_approval";
    } else {
      const selectedStaff = companyStaff.find((s) => s.email === formData.selectedApproverEmail);
      approverName = selectedStaff?.name || "Department Senior";
      approverEmail = formData.selectedApproverEmail || "";
      initialApprovalStatus = "pending_approval";
      initialPipelineStage = "dept_manager_approval";
    }

    const requesterName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Staff Member";

    const newRequest: ProcurementRequestItem = {
      id: requestId,
      companyId: compId,
      itemName: formData.itemName.trim(),
      category: formData.category,
      itemSpecifications: formData.itemSpecifications.trim(),
      quantity: Number(formData.quantity) || 1,
      unit: formData.unit.trim() || "units",
      urgency: formData.urgency,
      estimatedCost: Number(formData.estimatedCost) || 0,
      justification: formData.justification.trim(),
      requestingDepartment: formData.requestingDepartment,
      requestedByName: requesterName,
      requestedByEmail: user?.email || "",
      approvalChannel: formData.approvalRouting as any,
      approverName,
      approverEmail,
      approvalStatus: initialApprovalStatus,
      quoteFileUrl: formData.quoteFileUrl || undefined,
      quoteFileName: formData.quoteFileName || undefined,
      attachments: formData.attachments,
      pipelineStage: initialPipelineStage,
      createdAt: now,
      updatedAt: now,
      events: [
        {
          id: `ev-${Date.now()}`,
          action:
            formData.approvalRouting === "self_approval"
              ? `Request placed and self-approved by ${requesterName}. Directly routed to Procurement Dept.`
              : `Procurement request submitted. Awaiting approval from ${approverName}.`,
          actorName: requesterName,
          createdAt: now,
        },
      ],
    };

    try {
      // 1. Save to Supabase
      if (compId && isValidUuid(compId)) {
        await supabase.from("procurement_requests").insert({
          company_id: compId,
          requested_by_name: requesterName,
          requesting_department: formData.requestingDepartment.toLowerCase(),
          item_name: formData.itemName.trim(),
          item_specifications: formData.itemSpecifications.trim(),
          quantity: Number(formData.quantity) || 1,
          unit: formData.unit.trim() || "units",
          urgency: formData.urgency,
          justification:
            formData.approvalRouting === "self_approval"
              ? `[SELF-APPROVED by ${requesterName}] ${formData.justification.trim()}`
              : formData.justification.trim(),
          pipeline_stage: initialPipelineStage,
          pipeline_type: "procurement",
          stage_entered_at: now,
          status: "open",
          total_approved_amount: Number(formData.estimatedCost) || 0,
          notes: `Routing: ${formData.approvalRouting} | Approver: ${approverName} (${approverEmail})`,
        });

        // Log to audit log
        await supabase.from("audit_log").insert({
          user_email: user?.email || "staff@paimbabook.com",
          user_name: requesterName,
          action: "procurement_request_created",
          entity_type: "procurement_request",
          company_id: compId,
          details: {
            item_name: formData.itemName.trim(),
            quantity: formData.quantity,
            estimated_cost: formData.estimatedCost,
            approval_routing: formData.approvalRouting,
            approver_name: approverName,
          },
        });
      }

      // 2. Persist to localStorage
      const storageKey = `procurement_requests_${compId}`;
      const existing = requests;
      const updated = [newRequest, ...existing];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setRequests(updated);

      setSuccessMsg(
        formData.approvalRouting === "self_approval"
          ? `Request placed and self-approved! It has been forwarded directly to the Procurement Department for quotation gathering.`
          : `Procurement request submitted! It has been routed to ${approverName} for department approval.`
      );

      // Reset form
      setFormData({
        itemName: "",
        category: CATEGORIES[0],
        itemSpecifications: "",
        quantity: "1",
        unit: "units",
        urgency: "standard",
        estimatedCost: "",
        justification: "",
        requestingDepartment: currentCompanyUser?.department || "Maintenance",
        approvalRouting: "manager",
        selectedApproverEmail: companyStaff[0]?.email || "",
        quoteFileUrl: "",
        quoteFileName: "",
        attachments: [],
      });

      // Switch to View Requests tab after 1.5 seconds
      setTimeout(() => {
        setActiveTab("requests");
        setSuccessMsg(null);
      }, 1800);
    } catch (err) {
      console.warn("Could not save to Supabase directly, saved to local cache:", err);
      // Fallback local save
      const storageKey = `procurement_requests_${compId}`;
      const updated = [newRequest, ...requests];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setRequests(updated);
      setSuccessMsg(`Request saved and routed to ${approverName}!`);
      setTimeout(() => {
        setActiveTab("requests");
        setSuccessMsg(null);
      }, 1800);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Manager / Admin Approval
  const handleProcessApproval = async () => {
    if (!approvalModalItem || !approvalAction) return;

    setSubmitting(true);
    const now = new Date().toISOString();
    const actorName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Manager";
    const compId = currentCompany?.id || "local";

    const isApprove = approvalAction === "approve";
    const newStatus: ProcurementRequestItem["approvalStatus"] = isApprove ? "approved" : "rejected";
    const newPipelineStage = isApprove ? "quotation_gathering" : "rejected";

    const updatedRequests = requests.map((req) => {
      if (req.id === approvalModalItem.id) {
        const events = req.events || [];
        return {
          ...req,
          approvalStatus: newStatus,
          pipelineStage: newPipelineStage,
          approvalNotes: approvalNotes.trim(),
          updatedAt: now,
          events: [
            ...events,
            {
              id: `ev-${Date.now()}`,
              action: isApprove
                ? `Approved by ${actorName}. Advanced to Procurement Pipeline for quotes & fulfillment.`
                : `Rejected by ${actorName}. Reason: ${approvalNotes.trim() || "No reason specified."}`,
              actorName,
              notes: approvalNotes.trim(),
              createdAt: now,
            },
          ],
        };
      }
      return req;
    });

    try {
      // 1. Update Supabase if possible
      if (compId && isValidUuid(compId)) {
        await supabase
          .from("procurement_requests")
          .update({
            pipeline_stage: newPipelineStage,
            status: isApprove ? "open" : "cancelled",
            notes: `Approval by ${actorName}: ${approvalNotes.trim()}`,
          })
          .eq("id", approvalModalItem.id);

        await supabase.from("audit_log").insert({
          user_email: user?.email || "manager@paimbabook.com",
          user_name: actorName,
          action: isApprove ? "procurement_request_approved" : "procurement_request_rejected",
          entity_type: "procurement_request",
          company_id: compId,
          details: {
            request_id: approvalModalItem.id,
            item_name: approvalModalItem.itemName,
            notes: approvalNotes.trim(),
          },
        });
      }

      // 2. Persist to localStorage
      localStorage.setItem(`procurement_requests_${compId}`, JSON.stringify(updatedRequests));
      setRequests(updatedRequests);
      setApprovalModalItem(null);
      setApprovalAction(null);
      setApprovalNotes("");
      setSuccessMsg(isApprove ? "Request approved successfully! Sent to Procurement Department." : "Request rejected.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.warn("Error updating approval in Supabase:", err);
      localStorage.setItem(`procurement_requests_${compId}`, JSON.stringify(updatedRequests));
      setRequests(updatedRequests);
      setApprovalModalItem(null);
      setApprovalAction(null);
      setApprovalNotes("");
      setSuccessMsg(isApprove ? "Request approved and updated locally." : "Request rejected.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter requests for Tab 2
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Filter tab
      if (requestsFilter === "my" && r.requestedByEmail?.toLowerCase() !== user?.email?.toLowerCase()) {
        return false;
      }
      if (requestsFilter === "pending" && r.approvalStatus !== "pending_approval") {
        return false;
      }
      if (requestsFilter === "approved" && r.approvalStatus !== "approved" && r.approvalStatus !== "self_approved") {
        return false;
      }
      if (requestsFilter === "completed" && r.pipelineStage !== "completed" && r.pipelineStage !== "fulfilled") {
        return false;
      }
      if (requestsFilter === "rejected" && r.approvalStatus !== "rejected") {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.itemName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.requestingDepartment.toLowerCase().includes(q) ||
          r.requestedByName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, requestsFilter, searchQuery, user?.email]);

  // Pending Approvals for Tab 3
  const pendingApprovals = useMemo(() => {
    const userEm = (user?.email || "").toLowerCase();
    return requests.filter((r) => {
      if (r.approvalStatus !== "pending_approval") return false;
      // If direct approver email matches OR user is an admin / general manager
      if (r.approverEmail?.toLowerCase() === userEm) return true;
      if (isProcurementOrAdmin) return true;
      return false;
    });
  }, [requests, user?.email, isProcurementOrAdmin]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-border-color bg-surface shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4 bg-surface-elevated/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Procurement Desk</h2>
              <p className="text-xs text-muted">Request supplies, track requisitions & approve orders</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-elevated transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 TABS BAR */}
        <div className="flex border-b border-border-color bg-surface px-5 pt-2 gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("request")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition -mb-[1px] ${
              activeTab === "request"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Plus size={15} />
            <span>Request Procurement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition -mb-[1px] ${
              activeTab === "requests"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Layers size={15} />
            <span>View Requests</span>
            {requests.length > 0 && (
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-extrabold text-muted">
                {requests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition -mb-[1px] ${
              activeTab === "approvals"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <CheckCircle size={15} />
            <span>Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-extrabold animate-pulse">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </div>

        {/* NOTIFICATIONS */}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ========================================================================= */}
          {/* TAB 1: REQUEST PROCUREMENT                                               */}
          {/* ========================================================================= */}
          {activeTab === "request" && (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item Name */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                    Item Name &amp; Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Industrial Inverter Aircon, Bathroom Mixer Taps, A4 Paper Reams..."
                    value={formData.itemName}
                    onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-amber-500 transition"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                    Item Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-amber-500 transition"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Requesting Department */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                    Requesting Department
                  </label>
                  <select
                    value={formData.requestingDepartment}
                    onChange={(e) => setFormData({ ...formData, requestingDepartment: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-amber-500 transition"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity & Unit */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-amber-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                      Unit
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. units, boxes, kg"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                {/* Estimated Budget / Cost */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                    Estimated Total Budget ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 1500"
                    value={formData.estimatedCost}
                    onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-amber-500 transition"
                  />
                </div>

                {/* Urgency */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5 block">
                    Urgency Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "standard" })}
                      className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                        formData.urgency === "standard"
                          ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
                          : "border-border-color bg-surface-elevated hover:bg-surface text-muted"
                      }`}
                    >
                      <span className="text-xs font-bold">Standard</span>
                      <span className="text-[10px] text-muted leading-tight">Routine replenishment</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "high" })}
                      className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                        formData.urgency === "high"
                          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
                          : "border-border-color bg-surface-elevated hover:bg-surface text-muted"
                      }`}
                    >
                      <span className="text-xs font-bold">High Priority</span>
                      <span className="text-[10px] text-muted leading-tight">Affects daily operations</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "emergency" })}
                      className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                        formData.urgency === "emergency"
                          ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 ring-2 ring-red-500/20"
                          : "border-border-color bg-surface-elevated hover:bg-surface text-muted"
                      }`}
                    >
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertTriangle size={12} /> Emergency
                      </span>
                      <span className="text-[10px] text-muted leading-tight">Guest disruption / Safety hazard</span>
                    </button>
                  </div>
                </div>

                {/* Detailed Specifications */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                    Detailed Specifications / Model / Brand
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Specific brand, model number, dimensions, voltage, color, or technical requirements..."
                    value={formData.itemSpecifications}
                    onChange={(e) => setFormData({ ...formData, itemSpecifications: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2 text-xs font-medium text-foreground outline-none focus:border-amber-500 transition"
                  />
                </div>

                {/* Justification */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">
                    Justification / Operational Need
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Explain why this item is needed (e.g. Unit 4 faucet cracked, stock depleted, guest complaint)..."
                    value={formData.justification}
                    onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2 text-xs font-medium text-foreground outline-none focus:border-amber-500 transition"
                  />
                </div>

                {/* Quotation / Reference File */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                      Supporting Attachments (Quotes, Proformas, Spec Documents)
                    </label>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border-color bg-surface-elevated hover:bg-surface cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400 transition">
                      <Paperclip size={13} />
                      <span>Attach Documents</span>
                      <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
                    </label>
                  </div>
                  
                  {formData.attachments && formData.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-foreground font-semibold bg-surface-elevated px-3 py-1.5 rounded-lg border border-border-color shadow-2xs">
                          <FileText size={13} className="text-blue-500 shrink-0" />
                          <span className="max-w-[180px] truncate">{att.name}</span>
                          {att.size ? <span className="text-[10px] text-muted">({(att.size / 1024).toFixed(0)}KB)</span> : null}
                          <button
                            type="button"
                            onClick={() => removeModalAttachment(idx)}
                            className="text-muted hover:text-red-500 ml-1"
                            title="Remove attachment"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted mt-1">No attachments added yet. You can attach quotation PDFs, images, or spec sheets.</p>
                  )}
                </div>
              </div>

              {/* APPROVAL ROUTING SECTION */}
              <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                  <UserCheck size={16} className="text-amber-500" />
                  <span>Approval Routing Channel</span>
                </div>
                <p className="text-xs text-muted">
                  Select who should review and approve this procurement request before quotation gathering and ordering.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                      formData.approvalRouting === "manager"
                        ? "border-amber-500 bg-amber-500/10 text-foreground ring-2 ring-amber-500/20"
                        : "border-border-color bg-surface hover:bg-surface-elevated text-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="approvalRouting"
                        checked={formData.approvalRouting === "manager"}
                        onChange={() => setFormData({ ...formData, approvalRouting: "manager" })}
                        className="text-amber-600"
                      />
                      <span className="text-xs font-bold text-foreground">Department Senior</span>
                    </div>
                    <span className="text-[10px] text-muted ml-5">Direct supervisor or department head</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                      formData.approvalRouting === "admin"
                        ? "border-amber-500 bg-amber-500/10 text-foreground ring-2 ring-amber-500/20"
                        : "border-border-color bg-surface hover:bg-surface-elevated text-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="approvalRouting"
                        checked={formData.approvalRouting === "admin"}
                        onChange={() => setFormData({ ...formData, approvalRouting: "admin" })}
                        className="text-amber-600"
                      />
                      <span className="text-xs font-bold text-foreground">Super Admin / GM</span>
                    </div>
                    <span className="text-[10px] text-muted ml-5">General manager or executive</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                      formData.approvalRouting === "self_approval"
                        ? "border-amber-500 bg-amber-500/10 text-foreground ring-2 ring-amber-500/20"
                        : "border-border-color bg-surface hover:bg-surface-elevated text-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="approvalRouting"
                        checked={formData.approvalRouting === "self_approval"}
                        onChange={() => setFormData({ ...formData, approvalRouting: "self_approval" })}
                        className="text-amber-600"
                      />
                      <span className="text-xs font-bold text-foreground">Self-Approval</span>
                    </div>
                    <span className="text-[10px] text-muted ml-5">Emergency or no senior available</span>
                  </label>
                </div>

                {/* Manager Dropdown */}
                {formData.approvalRouting === "manager" && (
                  <div className="pt-2">
                    <label className="text-xs font-bold text-muted mb-1 block">Choose Senior / Manager *</label>
                    {companyStaff.length === 0 ? (
                      <p className="text-xs text-muted italic">
                        No other managers detected in this company. You may choose &ldquo;Super Admin&rdquo; or &ldquo;Self-Approval&rdquo;.
                      </p>
                    ) : (
                      <select
                        value={formData.selectedApproverEmail}
                        onChange={(e) => setFormData({ ...formData, selectedApproverEmail: e.target.value })}
                        className="w-full rounded-xl border border-border-color bg-surface px-3.5 py-2 text-xs font-semibold text-foreground outline-none"
                      >
                        {companyStaff.map((staff) => (
                          <option key={staff.id || staff.email} value={staff.email}>
                            {staff.name} — {staff.role} ({staff.department}) &lt;{staff.email}&gt;
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Self-Approval Callout */}
                {formData.approvalRouting === "self_approval" && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert size={14} />
                      <span>Direct-to-Procurement Routing</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This requisition will be flagged as <strong>[Self-Approved by {user?.user_metadata?.full_name || user?.email}]</strong> and sent directly to the Procurement Department for quote gathering, bypassing department manager review.
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{submitting ? "Placing Request..." : "Place Procurement Request"}</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: VIEW REQUESTS                                                     */}
          {/* ========================================================================= */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "my", "pending", "approved", "completed", "rejected"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRequestsFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                        requestsFilter === filter
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-surface-elevated text-muted hover:text-foreground"
                      }`}
                    >
                      {filter === "all" ? "All Requests" : filter === "my" ? "My Requests" : filter}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated pl-8 pr-3 py-1.5 text-xs text-foreground outline-none"
                  />
                </div>
              </div>

              {/* Requests list */}
              {filteredRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-color p-8 text-center space-y-2">
                  <Package size={28} className="mx-auto text-muted opacity-40" />
                  <p className="text-sm font-bold text-foreground">No Procurement Requests Found</p>
                  <p className="text-xs text-muted">Use the &ldquo;Request Procurement&rdquo; tab to submit a requisition.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("request")}
                    className="inline-flex items-center gap-1.5 mt-2 rounded-xl bg-amber-600 text-white px-4 py-1.5 text-xs font-bold"
                  >
                    <Plus size={13} />
                    <span>Create Request</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((req) => {
                    const isExpanded = expandedRequestId === req.id;
                    const isPending = req.approvalStatus === "pending_approval";
                    const isSelfApproved = req.approvalStatus === "self_approved";
                    const isApproved = req.approvalStatus === "approved";
                    const isRejected = req.approvalStatus === "rejected";

                    return (
                      <div
                        key={req.id}
                        className={`rounded-xl border transition-all ${
                          isExpanded
                            ? "border-amber-500/50 bg-surface shadow-md"
                            : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated"
                        }`}
                      >
                        <div
                          onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                          className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground">{req.itemName}</span>
                              <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-bold text-muted border border-border-color">
                                {req.category}
                              </span>
                              {req.urgency === "emergency" && (
                                <span className="rounded-md bg-red-500/10 border border-red-500/30 text-red-600 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                  <AlertTriangle size={10} /> Emergency
                                </span>
                              )}
                              {req.urgency === "high" && (
                                <span className="rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                                  High
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted">
                              Requested by <strong>{req.requestedByName}</strong> ({req.requestingDepartment}) • {req.quantity} {req.unit}
                              {req.estimatedCost > 0 && ` • ${formatCurrency(req.estimatedCost)}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status Badge */}
                            {isPending && (
                              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                                <Clock size={12} />
                                <span>Awaiting Approval ({req.approverName.split(" ")[0]})</span>
                              </span>
                            )}
                            {isSelfApproved && (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                                <ShieldAlert size={12} />
                                <span>Self-Approved &rarr; With Procurement</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                                <CheckCircle size={12} />
                                <span>Approved (In Procurement)</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="rounded-full border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>Rejected</span>
                              </span>
                            )}

                            {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                          </div>
                        </div>

                        {/* EXPANDED DETAILS */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-border-color/60 text-xs space-y-3 bg-surface-elevated/20">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <p className="font-bold text-muted uppercase text-[10px]">Specifications</p>
                                <p className="text-foreground mt-0.5">{req.itemSpecifications || "No specifications specified."}</p>
                              </div>
                              <div>
                                <p className="font-bold text-muted uppercase text-[10px]">Justification</p>
                                <p className="text-foreground mt-0.5">{req.justification || "No justification provided."}</p>
                              </div>
                            </div>

                            {/* Quote attachment */}
                            {req.quoteFileUrl && (
                              <div className="pt-2 border-t border-border-color/40 flex items-center gap-2">
                                <FileText size={14} className="text-blue-500" />
                                <span className="text-muted">Attached Quote:</span>
                                <a
                                  href={req.quoteFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <span>{req.quoteFileName || "View Attachment"}</span>
                                  <ExternalLink size={11} />
                                </a>
                              </div>
                            )}

                            {/* Approval History / Timeline */}
                            <div className="pt-2 border-t border-border-color/40 space-y-1.5">
                              <p className="font-bold text-muted uppercase text-[10px]">Audit &amp; Timeline</p>
                              {(req.events || []).map((ev, idx) => (
                                <div key={ev.id || idx} className="flex items-start gap-2 text-[11px] text-muted">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                  <div>
                                    <span className="font-semibold text-foreground">{ev.action}</span>
                                    {ev.notes && <span className="italic block text-muted">&ldquo;{ev.notes}&rdquo;</span>}
                                    <span className="text-[10px] text-muted block">{new Date(ev.createdAt).toLocaleString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: APPROVALS                                                         */}
          {/* ========================================================================= */}
          {activeTab === "approvals" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Requisitions Pending Review</h3>
                  <p className="text-[11px] text-muted">Requests requiring manager or administrative authorization</p>
                </div>
                <span className="rounded-full bg-amber-500/10 text-amber-600 px-3 py-1 text-xs font-bold border border-amber-500/20">
                  {pendingApprovals.length} Pending Action
                </span>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-color p-8 text-center space-y-2">
                  <CheckCircle size={28} className="mx-auto text-emerald-500 opacity-60" />
                  <p className="text-sm font-bold text-foreground">All Clear!</p>
                  <p className="text-xs text-muted">No pending procurement requests currently require your approval.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((req) => (
                    <div key={req.id} className="rounded-xl border border-border-color bg-surface p-4 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">{req.itemName}</span>
                            <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-bold text-muted border border-border-color">
                              {req.category}
                            </span>
                            {req.urgency === "emergency" && (
                              <span className="rounded-md bg-red-500/10 border border-red-500/30 text-red-600 px-2 py-0.5 text-[10px] font-bold">
                                Emergency
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            Requested by <strong>{req.requestedByName}</strong> ({req.requestingDepartment}) • {req.quantity} {req.unit}
                            {req.estimatedCost > 0 && ` • Estimated Cost: ${formatCurrency(req.estimatedCost)}`}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setApprovalModalItem(req);
                              setApprovalAction("reject");
                              setApprovalNotes("");
                            }}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 px-3 py-1.5 text-xs font-bold transition"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setApprovalModalItem(req);
                              setApprovalAction("approve");
                              setApprovalNotes("");
                            }}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <Check size={13} />
                            <span>Approve</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-border-color/50 text-muted">
                        <div>
                          <span className="font-semibold text-foreground">Specifications: </span>
                          <span>{req.itemSpecifications || "Standard"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Justification: </span>
                          <span>{req.justification || "Operational necessity"}</span>
                        </div>
                      </div>

                      {req.quoteFileUrl && (
                        <div className="text-xs flex items-center gap-1.5 pt-1">
                          <Paperclip size={12} className="text-blue-500" />
                          <a
                            href={req.quoteFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-semibold text-[11px]"
                          >
                            View Attached Quote ({req.quoteFileName || "File"})
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-border-color px-5 py-3 bg-surface-elevated/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted">
            {isProcurementOrAdmin ? (
              <Link
                to="/procurement"
                onClick={onClose}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
              >
                <span>Procurement Officer? Open Full 12-Stage Engine</span>
                <ArrowRight size={12} />
              </Link>
            ) : (
              <span>Requisitions are tracked in real-time.</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-color px-4 py-1.5 text-xs font-semibold text-muted hover:bg-surface transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* APPROVAL / REJECTION CONFIRMATION MODAL */}
      {approvalModalItem && approvalAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {approvalAction === "approve" ? "Confirm Procurement Approval" : "Reject Procurement Request"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setApprovalModalItem(null);
                  setApprovalAction(null);
                }}
                className="text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted">
              {approvalAction === "approve"
                ? `You are approving the request for "${approvalModalItem.itemName}" (${approvalModalItem.quantity} ${approvalModalItem.unit}) requested by ${approvalModalItem.requestedByName}. This will advance the request to the Procurement Department for quotation gathering and purchase.`
                : `Please provide a reason for rejecting this procurement request for "${approvalModalItem.itemName}".`}
            </p>

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">
                {approvalAction === "approve" ? "Approval Notes / Budget Code (Optional)" : "Rejection Reason *"}
              </label>
              <textarea
                rows={3}
                required={approvalAction === "reject"}
                placeholder={
                  approvalAction === "approve"
                    ? "e.g. Approved under Q3 maintenance budget. Please prioritize quick delivery."
                    : "e.g. Existing stock available in Store 2; please check with inventory clerk."
                }
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated p-2.5 text-xs text-foreground outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={() => {
                  setApprovalModalItem(null);
                  setApprovalAction(null);
                }}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || (approvalAction === "reject" && !approvalNotes.trim())}
                onClick={handleProcessApproval}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition ${
                  approvalAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitting ? "Processing..." : approvalAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

