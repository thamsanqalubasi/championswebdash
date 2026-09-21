import React, { useState, useEffect } from 'react';
import { 
  Plus, CheckCircle, Clock, AlertTriangle, FileText, 
  Upload, Search, Mail, Download, ArrowRight, Package,
  AlertCircle, DollarSign, Activity, FileCheck, Phone, MapPin, Building, User, X,
  Paperclip, Eye, Trash2
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useCurrency } from '@/lib/currency';
import { COUNTRY_DIAL_CODES } from './providers';
import type {
  ProcurementRequest, ProcurementPipelineEvent, ProcurementQuotation,
  ProcurementStage, ProcurementUrgency, SupplierContact, QuoteContactProfile
} from "@/lib/types";
import {
  fetchProcurementRequests, createProcurementRequest, approveDeptManagerRequest,
  startQuotationGathering, uploadQuotation, escalateToProcurementManager,
  requestFundsFromAccounts, approveAccountsFunding, markPurchaseComplete,
  releaseFromStoresToDept, triggerStageReminder, advancePipelineStage,
  fetchSupplierContacts, saveSupplierContact, fetchQuoteContacts, saveQuoteContact,
  checkStoresForItem, fetchReminderThreshold, MOCK_PROCUREMENT_REQUESTS
} from "@/lib/data";

const MOCK_REQUESTS: ProcurementRequest[] = [
  {
    id: "proc-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    requestedByName: "Sipho Khumalo",
    requestingDepartment: "maintenance",
    itemName: "Industrial Air Conditioner Unit",
    itemSpecifications: "18,000 BTU inverter split system, 220V, R410A refrigerant, SABS approved, includes installation brackets and 5m copper piping",
    quantity: 2,
    unit: "units",
    urgency: "high",
    justification: "Guest rooms 203 and 204 HVAC units have failed. Guest comfort severely impacted.",
    pipelineStage: "quotation_gathering",
    pipelineType: "procurement",
    stageEnteredAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    status: "open",
    events: [
      { id: "ev-001", requestId: "proc-001", stage: "draft", action: "Request submitted", actorName: "Sipho Khumalo", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString() },
      { id: "ev-002", requestId: "proc-001", stage: "dept_manager_approval", action: "Approved by department manager", actorName: "Thamsanqa Lubasi", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString() },
      { id: "ev-003", requestId: "proc-001", stage: "stores_check", action: "Stores checked — item not found", actorName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 35).toISOString() },
      { id: "ev-004", requestId: "proc-001", stage: "quotation_gathering", action: "Quotation gathering started", actorName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString() },
    ],
    quotations: [
      { id: "quot-001", requestId: "proc-001", supplierName: "CoolTech HVAC", supplierContact: "+27 11 555 0001", amount: 24500, currency: "ZAR", fileType: "pdf", isSelected: false, uploadedByName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "proc-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    requestedByName: "Nomsa Dlamini",
    requestingDepartment: "front_desk",
    itemName: "A4 Printing Paper (500 sheets/ream)",
    itemSpecifications: "80gsm white A4 printing paper, 500 sheets per ream, acid-free, suitable for laser and inkjet printers. Brand: Rotatrim or equivalent.",
    quantity: 20,
    unit: "reams",
    urgency: "medium",
    justification: "Stock depleted. Required for daily operations and guest receipts.",
    pipelineStage: "stores_dispatch",
    pipelineType: "stores",
    stageEnteredAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: "open",
    events: [
      { id: "ev-010", requestId: "proc-002", stage: "draft", action: "Request submitted", actorName: "Nomsa Dlamini", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString() },
      { id: "ev-011", requestId: "proc-002", stage: "dept_manager_approval", action: "Approved", actorName: "Thamsanqa Lubasi", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
      { id: "ev-012", requestId: "proc-002", stage: "stores_check", action: "Stores checked — 25 reams found in stores", actorName: "Stores Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
      { id: "ev-013", requestId: "proc-002", stage: "stores_dispatch", action: "Item confirmed available in stores. Awaiting dispatch.", actorName: "Stores Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
    ],
    quotations: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "proc-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    requestedByName: "Lerato Mokoena",
    requestingDepartment: "accountant",
    itemName: "Laptop Computer",
    itemSpecifications: "15.6 inch FHD display, Intel Core i7, 16GB RAM, 512GB SSD, Windows 11 Pro. Dell Latitude or Lenovo ThinkPad preferred.",
    quantity: 1,
    unit: "pcs",
    urgency: "high",
    justification: "Current laptop is failing. Required for financial reporting.",
    pipelineStage: "fund_request_to_accounts",
    pipelineType: "procurement",
    stageEnteredAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    paymentMethod: "bank_deposit",
    bankDetails: { bankName: "Standard Bank", accountName: "TechZone Supplies", accountNumber: "076543210", branchCode: "051001", reference: "PO-2026-003" },
    totalApprovedAmount: 18500,
    status: "open",
    events: [],
    quotations: [
      { id: "quot-005", requestId: "proc-003", supplierName: "TechZone Supplies", supplierContact: "+27 21 555 8800", amount: 18500, currency: "ZAR", isSelected: true, uploadedByName: "Procurement", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
  },
];

const STAGES = [
  "draft", "dept_manager_approval", "stores_check", "stores_dispatch",
  "quotation_gathering", "procurement_manager_approval", "fund_request_to_accounts",
  "payment_approved", "purchase_in_progress", "delivered_to_stores",
  "released_to_department", "completed"
];

function getStageBadgeColor(stage: string) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
    dept_manager_approval: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    stores_check: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    stores_dispatch: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    quotation_gathering: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    procurement_manager_approval: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    fund_request_to_accounts: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    payment_approved: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300 border-lime-200 dark:border-lime-800",
    purchase_in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    delivered_to_stores: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    released_to_department: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
  };
  return colors[stage] || colors.draft;
}

function getUrgencyColor(urgency: string) {
  const colors: Record<string, string> = {
    low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return colors[urgency] || colors.low;
}

function formatStageName(stage: string) {
  return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ProcurementPage() {
  const { user, currentCompany, currentCompanyUser } = useAuth();
  const { formatWhole, currency } = useCurrency();
  const [activeTab, setActiveTab] = useState('overview');
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [reminderThreshold, setReminderThreshold] = useState(24);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);

  // New Request Form State & Attachments
  const [newRequestForm, setNewRequestForm] = useState({
    itemName: '',
    itemSpecifications: '',
    quantity: 1,
    unit: 'pcs',
    urgency: 'medium' as ProcurementUrgency,
    justification: '',
    department: 'maintenance' as any,
  });
  const [newRequestAttachments, setNewRequestAttachments] = useState<Array<{ name: string; url: string; size: number; type: string }>>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    const fileList = Array.from(files);

    fileList.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setNewRequestAttachments(prev => [
          ...prev,
          {
            name: file.name,
            url: dataUrl,
            size: file.size,
            type: file.type || 'document',
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    setUploadingAttachment(false);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setNewRequestAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestForm.itemName.trim()) {
      alert("Please enter an item name.");
      return;
    }
    if (!newRequestForm.justification.trim()) {
      alert("Please provide a justification for this request.");
      return;
    }
    setSubmittingRequest(true);
    try {
      const actorName = currentCompanyUser?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Staff Member";
      const created = await createProcurementRequest({
        companyId: currentCompany?.id || "a0000000-0000-0000-0000-000000000001",
        requestedByName: actorName,
        requestedByUserId: user?.id,
        requestingDepartment: newRequestForm.department || (currentCompanyUser?.department as any) || 'maintenance',
        itemName: newRequestForm.itemName.trim(),
        itemSpecifications: newRequestForm.itemSpecifications.trim(),
        quantity: Number(newRequestForm.quantity) || 1,
        unit: newRequestForm.unit,
        urgency: newRequestForm.urgency,
        justification: newRequestForm.justification.trim(),
        attachments: newRequestAttachments,
      });

      setRequests(prev => [created, ...prev]);
      setIsNewRequestModalOpen(false);
      setNewRequestForm({
        itemName: '',
        itemSpecifications: '',
        quantity: 1,
        unit: 'pcs',
        urgency: 'medium',
        justification: '',
        department: (currentCompanyUser?.department as any) || 'maintenance',
      });
      setNewRequestAttachments([]);
      alert("Procurement request created successfully with supporting attachments!");
    } catch (err) {
      console.error(err);
      alert("Failed to submit procurement request.");
    } finally {
      setSubmittingRequest(false);
    }
  };
  
  // Suppliers Directory state
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    supplierName: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    phoneCode: '+264',
    email: '',
    address: '',
  });
  const [suppliedItems, setSuppliedItems] = useState<string[]>([]);
  const [itemInput, setItemInput] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Pipeline Modal
  const [selectedPipelineRequest, setSelectedPipelineRequest] = useState<ProcurementRequest | null>(null);
  const [pipelineTab, setPipelineTab] = useState<'map' | 'specs' | 'quotes' | 'funds' | 'audit'>('map');
  
  // Quote Request Modal
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<ProcurementRequest | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [reqs, sups] = await Promise.all([
          fetchProcurementRequests(currentCompany?.id),
          fetchSupplierContacts(currentCompany?.id),
        ]);
        setRequests(reqs || []);
        setSuppliers(sups || []);
        const threshold = await fetchReminderThreshold();
        if (threshold) setReminderThreshold(threshold);
      } catch (e) {
        // Fallback to mock
      }
    }
    loadData();
  }, [currentCompany?.id]);

  const addSuppliedItem = () => {
    const trimmed = itemInput.trim();
    if (!trimmed) return;
    if (suppliedItems.length >= 10) {
      alert("Maximum 10 supplied items allowed.");
      return;
    }
    const words = trimmed.split(/\s+/).length;
    if (words > 30) {
      alert(`Item cannot exceed 30 words (currently ${words} words). Please shorten.`);
      return;
    }
    setSuppliedItems([...suppliedItems, trimmed]);
    setItemInput('');
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.supplierName.trim()) {
      alert("Please enter a supplier or business name.");
      return;
    }
    const fullPhone = `${supplierForm.phoneCode} ${supplierForm.phone.trim()}`.trim();
    setSavingSupplier(true);
    try {
      const saved = await saveSupplierContact({
        companyId: currentCompany?.id || '',
        supplierName: supplierForm.supplierName.trim(),
        companyName: supplierForm.companyName.trim() || supplierForm.supplierName.trim(),
        contactPerson: supplierForm.contactPerson.trim(),
        phone: fullPhone,
        email: supplierForm.email.trim(),
        address: supplierForm.address.trim(),
        suppliedItems: suppliedItems,
      });

      setSuppliers((prev) => [...prev, saved]);
      setIsAddSupplierModalOpen(false);
      setSupplierForm({
        supplierName: '',
        companyName: '',
        contactPerson: '',
        phone: '',
        phoneCode: '+264',
        email: '',
        address: '',
      });
      setSuppliedItems([]);
      setItemInput('');
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save supplier.");
    } finally {
      setSavingSupplier(false);
    }
  };

  const getHoursElapsed = (stageEnteredAt: string) => {
    return (Date.now() - new Date(stageEnteredAt).getTime()) / 3600000;
  };

  const handleRemind = async (req: ProcurementRequest) => {
    try {
      await triggerStageReminder(req.id, currentCompanyUser?.fullName || 'System');
      alert('Reminder sent!');
    } catch (e) {
      alert('Reminder sent (mock)!');
    }
  };

  const renderActionButtons = (req: ProcurementRequest) => {
    const dept = currentCompanyUser?.department || 'admin'; // fallback for demo
    const level = currentCompanyUser?.roleLevel || 'admin';
    void dept; void level; // used for gating in full implementation
    switch (req.pipelineStage) {
      case 'draft':
        return <button className="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs hover:bg-blue-700">Submit to Manager</button>;
      case 'dept_manager_approval':
        return (
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs hover:bg-emerald-700">Approve</button>
            <button className="px-3 py-1 bg-red-600 text-white rounded-xl text-xs hover:bg-red-700">Reject</button>
          </div>
        );
      case 'stores_check':
        return <button className="px-3 py-1 bg-purple-600 text-white rounded-xl text-xs hover:bg-purple-700">Check Stores</button>;
      case 'quotation_gathering':
        return (
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs hover:bg-blue-700">Upload Quote</button>
            {req.quotations && req.quotations.length > 0 && (
              <button className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs hover:bg-indigo-700">Escalate to Manager</button>
            )}
          </div>
        );
      case 'fund_request_to_accounts':
        return <button className="px-3 py-1 bg-pink-600 text-white rounded-xl text-xs hover:bg-pink-700">Approve Funds</button>;
      case 'payment_approved':
        return <button className="px-3 py-1 bg-lime-600 text-white rounded-xl text-xs hover:bg-lime-700">Mark Purchase Complete</button>;
      case 'delivered_to_stores':
        return <button className="px-3 py-1 bg-cyan-600 text-white rounded-xl text-xs hover:bg-cyan-700">Confirm Received</button>;
      case 'released_to_department':
        return <button className="px-3 py-1 bg-violet-600 text-white rounded-xl text-xs hover:bg-violet-700">Confirm Released</button>;
      default:
        return null;
    }
  };

  const renderTable = (filteredReqs: ProcurementRequest[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border-color text-[11px] text-gray-500 uppercase tracking-wider">
            <th className="p-3 font-medium">Item</th>
            <th className="p-3 font-medium">Requested By</th>
            <th className="p-3 font-medium">Dept</th>
            <th className="p-3 font-medium">Stage</th>
            <th className="p-3 font-medium">Urgency</th>
            <th className="p-3 font-medium">Time at Stage</th>
            <th className="p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="text-xs text-gray-700 dark:text-gray-300">
          {filteredReqs.map(req => {
            const hours = getHoursElapsed(req.stageEnteredAt);
            const needsReminder = hours > reminderThreshold;
            return (
              <tr key={req.id} className="border-b border-border-color hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="p-3">
                  <div className="font-medium cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSelectedPipelineRequest(req)}>{req.itemName}</div>
                  <div className="text-gray-500 text-[10px] mt-0.5 truncate max-w-xs">{req.itemSpecifications}</div>
                </td>
                <td className="p-3">{req.requestedByName}</td>
                <td className="p-3 capitalize">{req.requestingDepartment.replace('_', ' ')}</td>
                <td className="p-3">
                  <span 
                    className={`px-2 py-1 rounded-full text-[10px] border cursor-pointer hover:opacity-80 transition-opacity ${getStageBadgeColor(req.pipelineStage)}`}
                    onClick={() => setSelectedPipelineRequest(req)}
                    title="Click to view full pipeline"
                  >
                    {formatStageName(req.pipelineStage)}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-[10px] ${getUrgencyColor(req.urgency)}`}>
                    {req.urgency}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className={needsReminder ? "text-orange-600 font-medium" : ""}>
                      {hours.toFixed(1)}h
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedPipelineRequest(req)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="View Pipeline"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    {needsReminder && (
                      <button 
                        onClick={() => handleRemind(req)}
                        className="px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg text-[10px] hover:bg-orange-200 transition-colors"
                      >
                        Remind
                      </button>
                    )}
                    {renderActionButtons(req)}
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredReqs.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-gray-500">
                No requests found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Procurement Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage pipeline requests, quotations, and funding</p>
        </div>
        <button 
          onClick={() => setIsNewRequestModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border-color pb-px">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'all', label: 'All Requests' },
          { id: 'quotations', label: 'Quotations' },
          { id: 'funds', label: 'Fund Requests' },
          { id: 'completed', label: 'Completed' },
          { id: 'suppliers', label: `Suppliers Directory (${suppliers.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-border-color p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl border border-border-color bg-gray-50/50 dark:bg-gray-800/50">
                <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Requests</div>
                <div className="text-2xl font-semibold mt-1">{requests.length}</div>
              </div>
              <div className="p-4 rounded-xl border border-border-color bg-blue-50/50 dark:bg-blue-900/10">
                <div className="text-[11px] text-blue-600 uppercase tracking-wider font-medium">Pending Dept Approval</div>
                <div className="text-2xl font-semibold mt-1">{requests.filter(r => r.pipelineStage === 'dept_manager_approval').length}</div>
              </div>
              <div className="p-4 rounded-xl border border-border-color bg-orange-50/50 dark:bg-orange-900/10">
                <div className="text-[11px] text-orange-600 uppercase tracking-wider font-medium">In Quotation</div>
                <div className="text-2xl font-semibold mt-1">{requests.filter(r => r.pipelineStage === 'quotation_gathering').length}</div>
              </div>
              <div className="p-4 rounded-xl border border-border-color bg-pink-50/50 dark:bg-pink-900/10">
                <div className="text-[11px] text-pink-600 uppercase tracking-wider font-medium">Awaiting Funds</div>
                <div className="text-2xl font-semibold mt-1">{requests.filter(r => r.pipelineStage === 'fund_request_to_accounts').length}</div>
              </div>
              <div className="p-4 rounded-xl border border-border-color bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="text-[11px] text-emerald-600 uppercase tracking-wider font-medium">Completed</div>
                <div className="text-2xl font-semibold mt-1">{requests.filter(r => r.status === 'completed' || r.pipelineStage === 'completed').length}</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-4 px-2">Recent Requests</h3>
              {renderTable(requests.slice(0, 5))}
            </div>
          </div>
        )}

        {activeTab === 'all' && (
          renderTable(requests)
        )}

        {activeTab === 'quotations' && (
          <div className="space-y-4">
            {requests.filter(r => r.pipelineStage === 'quotation_gathering').map(req => (
              <div key={req.id} className="border border-border-color rounded-xl p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium text-sm">{req.itemName}</h4>
                    <p className="text-xs text-gray-500 mt-1">{req.quantity} {req.unit} — {req.requestingDepartment}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedQuoteRequest(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Generate Quote Request
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="text-[11px] uppercase text-gray-500 font-medium tracking-wider">Quotations ({req.quotations?.length || 0}/10)</div>
                  {req.quotations?.map(q => (
                    <div key={q.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-xs">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{q.supplierName}</span>
                        <span className="text-gray-500">{q.currency} {q.amount.toLocaleString()}</span>
                      </div>
                      <span className="text-gray-400 text-[10px]">Uploaded by {q.uploadedByName}</span>
                    </div>
                  ))}
                  {(!req.quotations || req.quotations.length < 10) && (
                    <button className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Quotation (PDF/Image)
                    </button>
                  )}
                </div>
              </div>
            ))}
            {requests.filter(r => r.pipelineStage === 'quotation_gathering').length === 0 && (
              <div className="text-center p-8 text-sm text-gray-500">No requests in quotation gathering stage.</div>
            )}
          </div>
        )}

        {activeTab === 'funds' && (
          <div className="space-y-4">
            {requests.filter(r => r.pipelineStage === 'fund_request_to_accounts').map(req => (
              <div key={req.id} className="border border-border-color rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    {req.itemName}
                    <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-[10px]">Fund Request</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">Requested by {req.requestedByName} ({req.requestingDepartment})</p>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-gray-500 mb-1">Payment Method</div>
                      <div className="font-medium capitalize">{req.paymentMethod?.replace('_', ' ')}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Approved Amount</div>
                      <div className="font-medium text-blue-600">{formatWhole(req.totalApprovedAmount || 0)}</div>
                    </div>
                    {req.bankDetails && (
                      <div className="col-span-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div className="font-medium mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Bank Details</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-gray-500">Bank:</span> {req.bankDetails.bankName}</div>
                          <div><span className="text-gray-500">Acc Name:</span> {req.bankDetails.accountName}</div>
                          <div><span className="text-gray-500">Acc No:</span> {req.bankDetails.accountNumber}</div>
                          <div><span className="text-gray-500">Branch:</span> {req.bankDetails.branchCode}</div>
                          <div className="col-span-2"><span className="text-gray-500">Ref:</span> {req.bankDetails.reference}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-[140px]">
                  <button className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-medium hover:bg-pink-700">
                    Approve Funds
                  </button>
                  <button className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                    Reject / Query
                  </button>
                </div>
              </div>
            ))}
            {requests.filter(r => r.pipelineStage === 'fund_request_to_accounts').length === 0 && (
              <div className="text-center p-8 text-sm text-gray-500">No pending fund requests.</div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          renderTable(requests.filter(r => r.status === 'completed' || r.pipelineStage === 'completed'))
        )}

        {activeTab === 'suppliers' && (() => {
          const filteredSuppliers = suppliers.filter(s => {
            if (!supplierSearch.trim()) return true;
            const q = supplierSearch.toLowerCase();
            return (
              s.supplierName.toLowerCase().includes(q) ||
              (s.companyName && s.companyName.toLowerCase().includes(q)) ||
              (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
              (s.suppliedItems && s.suppliedItems.some(item => item.toLowerCase().includes(q)))
            );
          });

          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Search suppliers by name, person, or items supplied..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Supplier</span>
                </button>
              </div>

              {filteredSuppliers.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-border-color rounded-2xl">
                  <Building className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-gray-800 dark:text-gray-200">No suppliers registered yet</p>
                  <p className="text-xs text-gray-500 mt-1">Add suppliers to streamline procurement quotes and inventory restocking.</p>
                  <button
                    type="button"
                    onClick={() => setIsAddSupplierModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                  >
                    + Register First Supplier
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSuppliers.map((sup) => (
                    <div
                      key={sup.id}
                      className="p-5 rounded-2xl border border-border-color bg-gray-50/40 dark:bg-gray-800/30 hover:border-blue-500/50 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{sup.supplierName}</h4>
                            {sup.companyName && sup.companyName !== sup.supplierName && (
                              <p className="text-xs text-gray-500">{sup.companyName}</p>
                            )}
                          </div>
                          <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                            <Building className="w-4 h-4" />
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-border-color/60">
                          {sup.contactPerson && (
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{sup.contactPerson}</span>
                            </div>
                          )}
                          {sup.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>{sup.phone}</span>
                            </div>
                          )}
                          {sup.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{sup.email}</span>
                            </div>
                          )}
                          {sup.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{sup.address}</span>
                            </div>
                          )}
                        </div>

                        {/* What they supply */}
                        <div className="pt-2 border-t border-border-color/60">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            Supplies {sup.suppliedItems?.length ? `(${sup.suppliedItems.length})` : ''}
                          </p>
                          {sup.suppliedItems && sup.suppliedItems.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {sup.suppliedItems.map((item, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[11px] font-medium border border-blue-100 dark:border-blue-800"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400 italic">No specific item catalog registered</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Full Pipeline Progress Map & Data Inspector */}
      {selectedPipelineRequest && (() => {
        const req = selectedPipelineRequest;
        const currentIdx = STAGES.indexOf(req.pipelineStage);
        const progressPct = Math.round(((currentIdx) / (STAGES.length - 1)) * 100);

        return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedPipelineRequest(null); setPipelineTab('map'); } }}>
          <div className="bg-surface w-full max-w-4xl rounded-2xl shadow-xl border border-border-color flex flex-col max-h-[90vh]">
            {/* Progress Header */}
            <div className="p-5 border-b border-border-color bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{req.itemName}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${getStageBadgeColor(req.pipelineStage)}`}>
                      {formatStageName(req.pipelineStage)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${getUrgencyColor(req.urgency)}`}>
                      {req.urgency}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Requested by <strong>{req.requestedByName}</strong></span>
                    <span>•</span>
                    <span className="capitalize">{req.requestingDepartment.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>Stage {currentIdx + 1} of {STAGES.length} — {progressPct}% Complete</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <button onClick={() => { setSelectedPipelineRequest(null); setPipelineTab('map'); }} className="text-gray-400 hover:text-gray-600 p-1 ml-4">✕</button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-border-color text-xs">
              {([
                { key: 'map', label: 'Pipeline Map' },
                { key: 'specs', label: `Item & Specs${(req.attachments?.length || 0) > 0 ? ` (${req.attachments?.length})` : ''}` },
                { key: 'quotes', label: `Quotations (${req.quotations?.length || 0})` },
                { key: 'funds', label: 'Funds & Payment' },
                { key: 'audit', label: `Audit Trail (${req.events?.length || 0})` },
              ] as { key: typeof pipelineTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPipelineTab(tab.key)}
                  className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                    pipelineTab === tab.key 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Pipeline Map Tab */}
              {pipelineTab === 'map' && (
                <div className="space-y-0">
                  {STAGES.map((stage, idx) => {
                    const isCurrent = req.pipelineStage === stage;
                    const isPast = idx < currentIdx;
                    const event = req.events?.find(e => e.stage === stage);

                    return (
                      <div key={stage} className="flex gap-4 relative">
                        {idx !== STAGES.length - 1 && (
                          <div className={`absolute left-[15px] top-6 bottom-[-10px] w-0.5 ${
                            isPast ? 'bg-emerald-500' : isCurrent ? 'bg-blue-400' : 'bg-gray-200 dark:bg-gray-700'
                          }`} style={!isPast && !isCurrent ? { borderLeft: '2px dashed', width: 0 } : {}} />
                        )}

                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                          isPast ? 'bg-emerald-500 text-white' :
                          isCurrent ? 'bg-blue-100 text-blue-600 border-2 border-blue-600 animate-pulse' :
                          'bg-gray-100 text-gray-400 border-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                        }`}>
                          {isPast ? <CheckCircle className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>

                        <div className={`pb-6 flex-1 ${!isPast && !isCurrent ? 'opacity-40' : ''}`}>
                          <div className={`p-3 rounded-xl text-xs border ${
                            isCurrent ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10 shadow-sm' :
                            isPast ? 'border-emerald-100 dark:border-emerald-900/30' :
                            'border-transparent'
                          }`}>
                            <div className="font-medium capitalize text-sm mb-1">{formatStageName(stage)}</div>
                            {event ? (
                              <div className="space-y-1">
                                <p className="text-gray-600 dark:text-gray-300">{event.action}</p>
                                <div className="flex justify-between items-center text-[10px] text-gray-500">
                                  <span>By {event.actorName}</span>
                                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                                </div>
                              </div>
                            ) : isCurrent ? (
                              <p className="text-blue-600 font-medium">⏳ Currently pending action...</p>
                            ) : (
                              <p className="text-gray-400 border-t border-dashed border-gray-200 dark:border-gray-700 pt-1 mt-1">Pending</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Item & Specs Tab */}
              {pipelineTab === 'specs' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Item Name</div>
                      <div className="text-sm font-medium">{req.itemName}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Quantity & Unit</div>
                      <div className="text-sm font-medium">{req.quantity} {req.unit}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Urgency</div>
                      <div className="text-sm font-medium capitalize">{req.urgency}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pipeline Type</div>
                      <div className="text-sm font-medium capitalize">{req.pipelineType}</div>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Full Specifications</div>
                    <div className="text-sm whitespace-pre-wrap">{req.itemSpecifications || 'No specifications provided.'}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Business Justification</div>
                    <div className="text-sm whitespace-pre-wrap">{req.justification || 'No justification provided.'}</div>
                  </div>

                  {/* Attachments Section */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Paperclip size={12} className="text-blue-500" />
                        <span>Attached Documents & Quotes ({req.attachments?.length || 0})</span>
                      </div>
                    </div>
                    {req.attachments && req.attachments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {req.attachments.map((att, attIdx) => (
                          <div key={attIdx} className="flex items-center justify-between p-2.5 rounded-lg border border-border-color bg-surface text-xs shadow-xs">
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <FileText size={16} className="text-blue-500 shrink-0" />
                              <div className="truncate">
                                <p className="font-medium truncate">{att.name}</p>
                                {att.size ? <p className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</p> : null}
                              </div>
                            </div>
                            <a 
                              href={att.url} 
                              download={att.name}
                              target="_blank" 
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-semibold hover:bg-blue-100 transition shrink-0 ml-2"
                            >
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 py-1 italic">No attachments uploaded with this request.</div>
                    )}
                  </div>

                  {req.notes && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Additional Notes</div>
                      <div className="text-sm whitespace-pre-wrap">{req.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Quotations Tab */}
              {pipelineTab === 'quotes' && (
                <div className="space-y-3">
                  {req.quotations && req.quotations.length > 0 ? (
                    req.quotations.map((q, qi) => (
                      <div key={q.id || qi} className={`rounded-xl border p-4 ${q.isSelected ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-border-color'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm">{q.supplierName}</div>
                            {q.supplierContact && <div className="text-xs text-gray-500">{q.supplierContact}</div>}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">{q.currency} {q.amount.toLocaleString()}</div>
                            {q.isSelected && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Selected</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-500">
                          <span>Uploaded by {q.uploadedByName || 'Unknown'}</span>
                          <span>{new Date(q.createdAt).toLocaleString()}</span>
                        </div>
                        {q.fileUrl && (
                          <a href={q.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <FileText className="w-3 h-3" /> View Document
                          </a>
                        )}
                        {q.notes && <p className="text-xs text-gray-500 mt-1">{q.notes}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">No quotations gathered yet.</div>
                  )}
                </div>
              )}

              {/* Funds & Payment Tab */}
              {pipelineTab === 'funds' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Payment Method</div>
                      <div className="text-sm font-medium capitalize">{req.paymentMethod || 'Not specified'}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Approved Amount</div>
                      <div className="text-sm font-bold">
                        {req.totalApprovedAmount ? formatWhole(req.totalApprovedAmount) : 'Pending approval'}
                      </div>
                    </div>
                  </div>
                  {req.bankDetails && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Bank Details</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {req.bankDetails.bankName && <div><span className="text-gray-500">Bank:</span> {req.bankDetails.bankName}</div>}
                        {req.bankDetails.accountName && <div><span className="text-gray-500">Account:</span> {req.bankDetails.accountName}</div>}
                        {req.bankDetails.accountNumber && <div><span className="text-gray-500">Acc No:</span> {req.bankDetails.accountNumber}</div>}
                        {req.bankDetails.branchCode && <div><span className="text-gray-500">Branch:</span> {req.bankDetails.branchCode}</div>}
                        {req.bankDetails.reference && <div className="col-span-2"><span className="text-gray-500">Reference:</span> {req.bankDetails.reference}</div>}
                      </div>
                    </div>
                  )}
                  {!req.paymentMethod && !req.bankDetails && !req.totalApprovedAmount && (
                    <div className="text-center py-8 text-gray-500 text-sm">Funds and payment details will appear here once the request reaches the accounting stage.</div>
                  )}
                </div>
              )}

              {/* Audit Trail Tab */}
              {pipelineTab === 'audit' && (
                <div className="space-y-2">
                  {req.events && req.events.length > 0 ? (
                    [...req.events].reverse().map((ev, ei) => (
                      <div key={ev.id || ei} className="flex gap-3 items-start p-3 rounded-xl border border-border-color hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{ev.action}</div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                            <span className="font-medium">{ev.actorName}</span>
                            <span>•</span>
                            <span className="capitalize">{formatStageName(ev.stage)}</span>
                            <span>•</span>
                            <span>{new Date(ev.createdAt).toLocaleString()}</span>
                          </div>
                          {ev.notes && <p className="text-xs text-gray-500 mt-1">{ev.notes}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">No audit events recorded yet.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Generate Quote Request Modal */}
      {selectedQuoteRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl border border-border-color flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border-color flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
              <div>
                <h3 className="font-semibold">Generate Quote Request</h3>
                <p className="text-xs text-gray-500 mt-0.5">Send a formal RFQ to suppliers</p>
              </div>
              <button 
                onClick={() => setSelectedQuoteRequest(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Step 1 */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                  Supplier Details
                </h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Supplier Name *</label>
                      <input type="text" className="w-full text-xs p-2 rounded-lg border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Makro Stores" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Email</label>
                      <input type="email" className="w-full text-xs p-2 rounded-lg border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="sales@supplier.com" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Phone</label>
                      <input type="text" className="w-full text-xs p-2 rounded-lg border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="+27 00 000 0000" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Contact Person</label>
                      <input type="text" className="w-full text-xs p-2 rounded-lg border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="John Doe" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
                  Preview Document
                </h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white text-black font-serif text-sm">
                  <div className="text-center font-bold text-lg border-b pb-4 mb-4">REQUEST FOR QUOTATION</div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="text-gray-500 text-xs">To:</div>
                      <div className="font-medium">[Supplier Name]</div>
                      <div>[Supplier Email]</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">Date:</div>
                      <div>{new Date().toLocaleDateString()}</div>
                      <div className="text-gray-500 text-xs mt-2">Ref:</div>
                      <div>RFQ-{selectedQuoteRequest.id.substring(0,8)}</div>
                    </div>
                  </div>
                  
                  <table className="w-full text-left border-collapse mb-6">
                    <thead>
                      <tr className="border-b-2 border-black text-xs">
                        <th className="pb-2 w-16">Qty</th>
                        <th className="pb-2 w-20">Unit</th>
                        <th className="pb-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-3 font-medium">{selectedQuoteRequest.quantity}</td>
                        <td className="py-3">{selectedQuoteRequest.unit}</td>
                        <td className="py-3">
                          <div className="font-medium">{selectedQuoteRequest.itemName}</div>
                          <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{selectedQuoteRequest.itemSpecifications}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div className="text-xs text-gray-600 mt-8 pt-4 border-t border-gray-200">
                    Please provide your best quotation for the items listed above. Include any applicable taxes, delivery fees, and estimated lead time.
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border-color bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-border-color bg-surface rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                <Download className="w-4 h-4" /> Download PDF
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                <Mail className="w-4 h-4" /> Email Quote Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface w-full max-w-xl rounded-2xl shadow-xl border border-border-color flex flex-col my-8 overflow-hidden">
            <div className="p-4 border-b border-border-color flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h3 className="font-semibold text-base">New Procurement Request</h3>
                <p className="text-xs text-gray-500 mt-0.5">Submit item requisition with quotes, specs, and attachments</p>
              </div>
              <button 
                onClick={() => setIsNewRequestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateRequest} className="flex flex-col">
              <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Item Name *</label>
                  <input 
                    type="text" 
                    required
                    value={newRequestForm.itemName}
                    onChange={(e) => setNewRequestForm(prev => ({ ...prev, itemName: e.target.value }))}
                    className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    placeholder="e.g. Industrial Air Conditioner, A4 Paper Boxes" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Requesting Department</label>
                    <select 
                      value={newRequestForm.department}
                      onChange={(e) => setNewRequestForm(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize"
                    >
                      <option value="maintenance">Maintenance</option>
                      <option value="housekeeping">Housekeeping</option>
                      <option value="front_desk">Front Desk</option>
                      <option value="it">IT & Systems</option>
                      <option value="stores">Stores & Inventory</option>
                      <option value="admin">Administration</option>
                      <option value="procurement">Procurement</option>
                      <option value="manager">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Urgency</label>
                    <select 
                      value={newRequestForm.urgency}
                      onChange={(e) => setNewRequestForm(prev => ({ ...prev, urgency: e.target.value as ProcurementUrgency }))}
                      className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low">Low (Standard Requisition)</option>
                      <option value="medium">Medium (Replenishment)</option>
                      <option value="high">High (Urgent Requirement)</option>
                      <option value="critical">Critical (Immediate Operational Impact)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity *</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={newRequestForm.quantity}
                      onChange={(e) => setNewRequestForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" 
                      placeholder="1" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unit *</label>
                    <select 
                      value={newRequestForm.unit}
                      onChange={(e) => setNewRequestForm(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="pcs">pcs (Pieces)</option>
                      <option value="units">units (Units)</option>
                      <option value="sets">sets (Sets)</option>
                      <option value="boxes">boxes (Boxes)</option>
                      <option value="liters">liters (Liters)</option>
                      <option value="kg">kg (Kilograms)</option>
                      <option value="meters">meters (Meters)</option>
                      <option value="reams">reams (Reams)</option>
                      <option value="packs">packs (Packs)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Specifications / Technical Details</label>
                  <textarea 
                    rows={2}
                    value={newRequestForm.itemSpecifications}
                    onChange={(e) => setNewRequestForm(prev => ({ ...prev, itemSpecifications: e.target.value }))}
                    className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    placeholder="Brand, size, color, model number, technical specs..." 
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Business Justification *</label>
                  <textarea 
                    rows={2}
                    required
                    value={newRequestForm.justification}
                    onChange={(e) => setNewRequestForm(prev => ({ ...prev, justification: e.target.value }))}
                    className="w-full text-sm p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    placeholder="Why is this item needed and what is its operational purpose?" 
                  />
                </div>

                {/* Attachments Section */}
                <div className="pt-3 border-t border-border-color">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-900 dark:text-white">
                        Supporting Attachments & Documents
                      </label>
                      <p className="text-[11px] text-gray-500">
                        Attach supplier quotes, proforma invoices, spec sheets, photos, or receipts (Max 10MB each)
                      </p>
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition">
                      <Paperclip size={13} />
                      <span>{uploadingAttachment ? "Uploading..." : "Add File"}</span>
                      <input 
                        type="file" 
                        multiple 
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" 
                        className="hidden" 
                        onChange={handleAttachmentUpload} 
                        disabled={uploadingAttachment} 
                      />
                    </label>
                  </div>

                  {newRequestAttachments.length > 0 ? (
                    <div className="space-y-2 mt-3">
                      {newRequestAttachments.map((att, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border-color bg-gray-50/60 dark:bg-gray-800/40 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600">
                              <FileText size={15} />
                            </div>
                            <div className="truncate">
                              <p className="font-semibold text-gray-900 dark:text-white truncate">{att.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {(att.size / 1024).toFixed(1)} KB · {att.type.split('/')[1]?.toUpperCase() || 'FILE'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a 
                              href={att.url} 
                              download={att.name} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="p-1 text-gray-500 hover:text-blue-600"
                              title="Preview / Download"
                            >
                              <Eye size={14} />
                            </a>
                            <button 
                              type="button" 
                              onClick={() => removeAttachment(idx)} 
                              className="p-1 text-gray-400 hover:text-rose-600"
                              title="Remove file"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <label className="mt-2 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-blue-400 transition bg-gray-50/30 dark:bg-gray-800/20 group">
                      <Upload size={20} className="text-gray-400 group-hover:text-blue-500 mb-1" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-blue-600">
                        Click to upload attachments (PDF, image, Word, Excel)
                      </span>
                      <span className="text-[10px] text-gray-400">Optional supporting quotes or specifications</span>
                      <input 
                        type="file" 
                        multiple 
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" 
                        className="hidden" 
                        onChange={handleAttachmentUpload} 
                        disabled={uploadingAttachment} 
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border-color bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsNewRequestModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingRequest || !newRequestForm.itemName.trim() || !newRequestForm.justification.trim()}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submittingRequest ? "Submitting..." : "Submit Procurement Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-xl rounded-2xl shadow-xl border border-border-color overflow-hidden">
            <div className="p-5 border-b border-border-color flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Register New Supplier</h3>
                <p className="text-xs text-gray-500 mt-0.5">Add partner supplier profile and catalog of supplies</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Supplier / Trade Name *
                  </label>
                  <input
                    type="text"
                    value={supplierForm.supplierName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierName: e.target.value })}
                    placeholder="e.g. Apex Electrical Supplies"
                    className="w-full text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Registered Company Name
                  </label>
                  <input
                    type="text"
                    value={supplierForm.companyName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })}
                    placeholder="e.g. Apex Holdings Ltd"
                    className="w-full text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    placeholder="e.g. Sipho Ndlovu"
                    className="w-full text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={supplierForm.phoneCode}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phoneCode: e.target.value })}
                      className="text-xs p-2.5 rounded-xl border border-border-color bg-surface font-semibold focus:outline-none"
                    >
                      {COUNTRY_DIAL_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      placeholder="81 234 5678"
                      className="flex-1 text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="sales@supplier.com"
                    className="w-full text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Physical / Delivery Address
                  </label>
                  <input
                    type="text"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    placeholder="Plot 45, Light Industrial Area, Windhoek"
                    className="w-full text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* What they supply */}
              <div className="pt-2 border-t border-border-color">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    What They Supply ({suppliedItems.length}/10 items)
                  </label>
                  <span className="text-[10px] text-gray-400">Max 30 words per item</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={itemInput}
                    onChange={(e) => setItemInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSuppliedItem();
                      }
                    }}
                    placeholder="e.g. Copper wiring, circuit breakers, conduit pipes"
                    className="flex-1 text-xs p-2.5 rounded-xl border border-border-color bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addSuppliedItem}
                    disabled={suppliedItems.length >= 10 || !itemInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {suppliedItems.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {suppliedItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 text-xs font-medium border border-blue-200 dark:border-blue-800"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => setSuppliedItems(suppliedItems.filter((_, i) => i !== idx))}
                          className="hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border-color bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSupplier}
                disabled={savingSupplier}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                {savingSupplier ? 'Saving...' : 'Register Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
