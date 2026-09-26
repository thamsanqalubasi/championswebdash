import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Search, 
  Filter, 
  Plus, 
  Minus, 
  Package, 
  ArrowDownRight, 
  ArrowUpRight, 
  History, 
  AlertTriangle, 
  Edit, 
  X,
  RefreshCw,
  ClipboardList,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  FileText
} from "lucide-react";
import { uploadInventoryMedia } from '@/lib/storage';
import { Pagination } from "@/components/pagination";
import type { 
  StoresItem, 
  StoresTransaction, 
  StoresItemSource, 
  ProcurementRequest 
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import {
  fetchStoresInventory,
  fetchStoresTransactions,
  receiveStoresItem,
  releaseStoresItem,
  updateStoresInventoryItem,
  addStoresInventoryItem
} from "@/lib/data";

// MOCK DATA
const MOCK_STORES: StoresItem[] = [
  {
    id: "store-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Luxury Egyptian Cotton Linen Sets",
    category: "Hospitality & Housekeeping",
    quantity: 45,
    unit: "sets",
    minStockLevel: 20,
    unitCost: 650,
    supplier: "Hotel Linen Direct",
    location: "Central Linen Room B",
    source: "maintenance_inventory",
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "store-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "LED Ceiling Downlights 9W",
    category: "Electrical",
    quantity: 12,
    unit: "pcs",
    minStockLevel: 25,
    unitCost: 85,
    supplier: "VoltMax Supplies",
    location: "Maintenance Store 1",
    source: "maintenance_inventory",
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "store-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "A4 Printing Paper (500 sheets/ream)",
    category: "Office Supplies",
    quantity: 25,
    unit: "reams",
    minStockLevel: 10,
    unitCost: 55,
    supplier: "Office Mart",
    location: "Admin Storeroom",
    source: "stores",
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  },
  {
    id: "store-004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Bathroom Amenity Sets (Shampoo/Soap/Lotion)",
    category: "Hospitality & Housekeeping",
    quantity: 8,
    unit: "sets",
    minStockLevel: 50,
    unitCost: 35,
    supplier: "Amenity World SA",
    location: "Housekeeping Storage A",
    source: "procured",
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
  },
  {
    id: "store-005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Gate Remote Controls",
    category: "Security & Access",
    quantity: 6,
    unit: "pcs",
    minStockLevel: 5,
    unitCost: 180,
    supplier: "Access Systems SA",
    location: "Front Desk Drawer",
    source: "procured",
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-08-30T00:00:00Z",
  },
];

const MOCK_TRANSACTIONS: StoresTransaction[] = [
  {
    id: "txn-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    inventoryId: "store-003",
    inventoryName: "A4 Printing Paper (500 sheets/ream)",
    transactionType: "receive",
    quantity: 30,
    receivedFrom: "Office Mart Delivery",
    notes: "Monthly restock order",
    performedByName: "Stores Staff",
    transactionDate: "2026-09-01",
    createdAt: "2026-09-01T09:00:00Z",
  },
  {
    id: "txn-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    inventoryId: "store-003",
    inventoryName: "A4 Printing Paper (500 sheets/ream)",
    transactionType: "release",
    quantity: 5,
    department: "front_desk",
    releasedToName: "Nomsa Dlamini",
    notes: "Daily operational use",
    performedByName: "Stores Staff",
    transactionDate: "2026-09-05",
    createdAt: "2026-09-05T10:00:00Z",
  },
  {
    id: "txn-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    inventoryId: "store-004",
    inventoryName: "Bathroom Amenity Sets",
    transactionType: "receive",
    quantity: 100,
    receivedFrom: "Amenity World SA",
    procurementRequestId: "proc-001",
    notes: "Received from procurement order",
    performedByName: "Stores Staff",
    transactionDate: "2026-09-10",
    createdAt: "2026-09-10T14:00:00Z",
  },
];

const DEPARTMENTS = [
  "admin",
  "manager",
  "accountant",
  "front_desk",
  "it",
  "maintenance",
  "human_resources",
  "procurement",
  "stores",
  "audit"
];

export default function StoresInventoryPage() {
  const { currentCompany, currentCompanyUser, user } = useAuth();
  const companyId = currentCompany?.id || "a0000000-0000-0000-0000-000000000001";
  const userDisplayName = currentCompanyUser?.fullName || user?.user_metadata?.full_name || "Stores Officer";

  const [activeTab, setActiveTab] = useState<"inventory" | "receive" | "release" | "transactions">("inventory");
  const [loading, setLoading] = useState(true);
  
  const [inventory, setInventory] = useState<StoresItem[]>([]);
  const [transactions, setTransactions] = useState<StoresTransaction[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [inv, txns] = await Promise.all([
        fetchStoresInventory(companyId),
        fetchStoresTransactions(companyId),
      ]);
      setInventory(inv || []);
      setTransactions(txns || []);
    } catch (err) {
      console.warn("Could not load stores data from server, using existing inventory", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);
  
  // --- INVENTORY TAB STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<StoresItem | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const categories = useMemo(() => {
    const cats = new Set(inventory.map((item) => item.category));
    return ["All", ...Array.from(cats)];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
      if (sourceFilter !== "All") {
        if (sourceFilter === "From Maintenance" && item.source !== "maintenance_inventory") return false;
        if (sourceFilter === "Procured" && item.source !== "procured") return false;
        if (sourceFilter === "Stores-native" && item.source !== "stores") return false;
      }
      return true;
    });
  }, [inventory, searchQuery, categoryFilter, sourceFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(filteredInventory.length / PAGE_SIZE) || 1;
  const paginatedInventory = useMemo(() => {
    return filteredInventory.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filteredInventory, currentPage]);

  const stats = useMemo(() => {
    const totalItems = inventory.length;
    const lowStock = inventory.filter(i => i.quantity <= i.minStockLevel).length;
    const totalValue = inventory.reduce((acc, curr) => acc + (curr.quantity * curr.unitCost), 0);
    return { totalItems, lowStock, totalValue };
  }, [inventory]);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    const targetQty = adjustType === "add" ? adjustItem.quantity + qty : Math.max(0, adjustItem.quantity - qty);

    const newInventory = inventory.map(item => {
      if (item.id === adjustItem.id) {
        return {
          ...item,
          quantity: targetQty
        };
      }
      return item;
    });
    setInventory(newInventory);

    try {
      await updateStoresInventoryItem(adjustItem.id, { quantity: targetQty });
    } catch (err) {
      console.warn("Could not persist adjusted stock", err);
    }

    const newTxn: StoresTransaction = {
      id: `txn-${Date.now()}`,
      companyId,
      inventoryId: adjustItem.id,
      inventoryName: adjustItem.name,
      transactionType: adjustType === "add" ? "receive" : "release",
      quantity: qty,
      notes: `Manual adjustment: ${adjustNotes}`,
      performedByName: userDisplayName,
      transactionDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    setTransactions([newTxn, ...transactions]);

    setAdjustModalOpen(false);
    setAdjustItem(null);
    setAdjustQty("");
    setAdjustNotes("");
  };

  // --- RECEIVE TAB STATE ---
  const [recItemId, setRecItemId] = useState("");
  const [recNewName, setRecNewName] = useState("");
  const [recQty, setRecQty] = useState("");
  const [recSupplier, setRecSupplier] = useState("");
  const [recFrom, setRecFrom] = useState("");
  const [recNotes, setRecNotes] = useState("");
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [receiptPreview, setReceiptPreview] = useState<string>('');

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(recQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    setUploading(true);
    try {
      let uploadedPhotoUrl = photoPreview && !photoFile ? photoPreview : undefined;
      let uploadedReceiptUrl = receiptPreview && !receiptFile ? receiptPreview : undefined;
      
      try {
        if (photoFile) uploadedPhotoUrl = await uploadInventoryMedia('stores', photoFile, 'picture');
      } catch (err) {
        console.error("Failed to upload photo", err);
      }
      try {
        if (receiptFile) uploadedReceiptUrl = await uploadInventoryMedia('stores', receiptFile, 'receipt');
      } catch (err) {
        console.error("Failed to upload receipt", err);
      }

      let targetId = recItemId;
      let targetName = "";

      if (recItemId === "new") {
        targetId = `store-${Date.now()}`;
        targetName = recNewName;
        try {
          const created = await addStoresInventoryItem({
            companyId,
            name: recNewName,
            category: "General",
            quantity: qty,
            unit: "pcs",
            minStockLevel: 5,
            unitCost: 0,
            supplier: recSupplier,
            location: "Central Stores",
            source: "stores",
            notes: recNotes,
            photoUrl: uploadedPhotoUrl,
            receiptUrl: uploadedReceiptUrl,
          });
          targetId = created.id;
          setInventory(prev => [...prev, created]);
        } catch (err) {
          console.warn("Could not create stores item", err);
        }
      } else {
        const existing = inventory.find(i => i.id === recItemId);
        if (existing) {
          targetName = existing.name;
          setInventory(inventory.map(i => i.id === recItemId ? { ...i, quantity: i.quantity + qty } : i));
        }
      }

      try {
        const txn = await receiveStoresItem({
          companyId,
          inventoryId: targetId,
          quantity: qty,
          receivedFrom: recFrom || recSupplier,
          notes: recNotes,
          performedByName: userDisplayName,
          transactionDate: recDate,
          photo_url: uploadedPhotoUrl,
          receipt_url: uploadedReceiptUrl,
        } as any);
        setTransactions(prev => [txn, ...prev]);
      } catch (err) {
        console.warn("Could not save receive transaction", err);
      }
      
      // reset
      setRecItemId("");
      setRecNewName("");
      setRecQty("");
      setRecSupplier("");
      setRecFrom("");
      setRecNotes("");
      setPhotoFile(null);
      setReceiptFile(null);
      setPhotoPreview('');
      setReceiptPreview('');
    } finally {
      setUploading(false);
    }
  };

  const recentReceives = useMemo(() => {
    return transactions.filter(t => t.transactionType === "receive").slice(0, 10);
  }, [transactions]);

  // --- RELEASE TAB STATE ---
  const [relItemId, setRelItemId] = useState("");
  const [relQty, setRelQty] = useState("");
  const [relDept, setRelDept] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relNotes, setRelNotes] = useState("");
  const [relDate, setRelDate] = useState(new Date().toISOString().slice(0, 10));

  const selectedRelItem = inventory.find(i => i.id === relItemId);

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelItem) return;
    const qty = parseInt(relQty, 10);
    if (isNaN(qty) || qty <= 0 || qty > selectedRelItem.quantity) return;

    setInventory(inventory.map(i => i.id === relItemId ? { ...i, quantity: i.quantity - qty } : i));

    try {
      const txn = await releaseStoresItem({
        companyId,
        inventoryId: relItemId,
        quantity: qty,
        department: relDept as any,
        releasedToName: relTo,
        notes: relNotes,
        performedByName: userDisplayName,
        transactionDate: relDate,
      });
      setTransactions(prev => [txn, ...prev]);
    } catch (err) {
      console.warn("Could not save release transaction", err);
    }
    
    setRelItemId("");
    setRelQty("");
    setRelDept("");
    setRelTo("");
    setRelNotes("");
  };

  const recentReleases = useMemo(() => {
    return transactions.filter(t => t.transactionType === "release").slice(0, 10);
  }, [transactions]);

  // --- TRANSACTIONS TAB STATE ---
  const [txnTypeFilter, setTxnTypeFilter] = useState("All");
  const [txnSearch, setTxnSearch] = useState("");

  const filteredTxns = useMemo(() => {
    return transactions.filter(t => {
      if (txnTypeFilter !== "All" && t.transactionType !== txnTypeFilter.toLowerCase()) return false;
      if (txnSearch && !t.inventoryName?.toLowerCase().includes(txnSearch.toLowerCase())) return false;
      return true;
    });
  }, [transactions, txnTypeFilter, txnSearch]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-foreground bg-background min-h-screen">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Stores & Inventory</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
              <Package size={12} />
              Stores & Maintenance Blended
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Central storehouse stock, material receipts, departmental issuances, and blended inventory from maintenance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-elevated transition shadow-sm"
            title="Refresh stores & inventory data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <Link
            to="/maintenance/inventory"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <ClipboardList size={15} />
            <span>Inventory & Stock Hub</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Sync Banner */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs">
        <div className="flex items-center gap-2.5 text-foreground">
          <Package className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            <strong>Inventory Sync Active:</strong> Items added under <strong>Inventory & Stock</strong> automatically appear here in Stores & Inventory.
          </span>
        </div>
        <Link
          to="/maintenance/inventory"
          className="text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0 flex items-center gap-1"
        >
          <span>Open Inventory & Stock</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Tabs Bar with Inventory & Stock option */}
      <div className="flex items-center justify-between border-b border-border-color">
        <div className="flex space-x-1">
          {(["inventory", "receive", "release", "transactions"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border-color"
              }`}
            >
              {tab === "inventory" ? "Central Stores Inventory" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <Link
          to="/maintenance/inventory"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
        >
          <ClipboardList size={14} />
          <span>Inventory & Stock (Maintenance) ↗</span>
        </Link>
      </div>

      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface rounded-2xl shadow-sm border border-border-color p-4 flex items-center space-x-4">
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Items</p>
                <p className="text-xl font-semibold">{stats.totalItems}</p>
              </div>
            </div>
            <div className="bg-surface rounded-2xl shadow-sm border border-border-color p-4 flex items-center space-x-4">
              <div className="p-3 bg-red-500/10 text-red-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low Stock Items</p>
                <p className="text-xl font-semibold text-red-600">{stats.lowStock}</p>
              </div>
            </div>
            <div className="bg-surface rounded-2xl shadow-sm border border-border-color p-4 flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <span className="font-bold text-lg">R</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-xl font-semibold">R {stats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl shadow-sm border border-border-color overflow-hidden">
            <div className="p-4 border-b border-border-color flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search inventory..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative">
                  <Filter className="w-3 h-3 absolute left-3 top-3 text-muted-foreground" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 pr-8 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <Filter className="w-3 h-3 absolute left-3 top-3 text-muted-foreground" />
                  <select
                    value={sourceFilter}
                    onChange={(e) => {
                      setSourceFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 pr-8 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                  >
                    <option value="All">All Sources</option>
                    <option value="From Maintenance">From Maintenance</option>
                    <option value="Procured">Procured</option>
                    <option value="Stores-native">Stores-native</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border-color">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium text-right">Unit Cost</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-border-color">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No items found
                      </td>
                    </tr>
                  ) : (
                    paginatedInventory.map(item => {
                      const isLow = item.quantity <= item.minStockLevel;
                      return (
                        <tr key={item.id} className={`hover:bg-muted/20 transition-colors ${isLow ? 'bg-red-500/5 hover:bg-red-500/10' : ''}`}>
                          <td className="px-4 py-3 font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-semibold ${
                              item.source === "maintenance_inventory" ? "bg-blue-500/10 text-blue-600" :
                              item.source === "procured" ? "bg-emerald-500/10 text-emerald-600" :
                              "bg-gray-500/10 text-gray-500"
                            }`}>
                              {item.source.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isLow ? 'text-red-600' : ''}`}>
                              {item.quantity} {item.unit}
                            </span>
                            {isLow && <AlertTriangle className="inline w-3 h-3 ml-1 text-red-600" />}
                          </td>
                          <td className="px-4 py-3 text-right">R {item.unitCost}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.location || "-"}</td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustType("add");
                                setAdjustModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 font-medium text-xs px-3 py-1 bg-blue-500/10 rounded-xl"
                            >
                              Adjust
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border-color p-3 bg-surface">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredInventory.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "receive" && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl shadow-sm border border-border-color p-6 max-w-2xl">
            <h2 className="text-lg font-medium mb-4 flex items-center"><ArrowDownRight className="w-5 h-5 mr-2 text-emerald-600" /> Receive Goods</h2>
            <form onSubmit={handleReceive} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Item</label>
                <select 
                  required
                  value={recItemId}
                  onChange={(e) => setRecItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Item...</option>
                  <option value="new">+ Receive New Item</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Current: {i.quantity} {i.unit})</option>
                  ))}
                </select>
              </div>

              {recItemId === "new" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">New Item Name</label>
                  <input
                    type="text"
                    required
                    value={recNewName}
                    onChange={(e) => setRecNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="E.g. AAA Batteries"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity Received</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={recQty}
                    onChange={(e) => setRecQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier</label>
                  <input
                    type="text"
                    value={recSupplier}
                    onChange={(e) => setRecSupplier(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Received From (Person)</label>
                  <input
                    type="text"
                    value={recFrom}
                    onChange={(e) => setRecFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Delivery Photo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setPhotoFile(f);
                          setPhotoPreview(URL.createObjectURL(f));
                        }
                      }}
                      className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {photoPreview && (
                      <img src={photoPreview} alt="Preview" className="h-9 w-9 rounded-md object-cover border border-border-color shrink-0" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Receipt / Invoice</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setReceiptFile(f);
                          if (f.type.startsWith('image/')) {
                            setReceiptPreview(URL.createObjectURL(f));
                          } else {
                            setReceiptPreview('');
                          }
                        }
                      }}
                      className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {receiptPreview && (
                      <img src={receiptPreview} alt="Receipt" className="h-9 w-9 rounded-md object-cover border border-border-color shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={uploading} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  {uploading ? "Uploading & Recording..." : "Record Receipt"}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-surface rounded-2xl shadow-sm border border-border-color overflow-hidden max-w-4xl">
            <div className="p-4 border-b border-border-color bg-muted/20">
              <h3 className="font-medium text-sm">Recent Receipts</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border-color">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {recentReceives.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No recent receipts</td></tr>}
                {recentReceives.map(txn => (
                  <tr key={txn.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 whitespace-nowrap">{txn.transactionDate}</td>
                    <td className="px-4 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {txn.photoUrl && (
                          <img src={txn.photoUrl} alt="Photo" className="h-6 w-6 rounded-md object-cover border border-border-color" />
                        )}
                        <span>{txn.inventoryName}</span>
                        {txn.receiptUrl && (
                          <a href={txn.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 ml-1">
                            <FileText size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-emerald-600 font-medium">+{txn.quantity}</td>
                    <td className="px-4 py-2 text-muted-foreground">{txn.receivedFrom || "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{txn.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "release" && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl shadow-sm border border-border-color p-6 max-w-2xl">
            <h2 className="text-lg font-medium mb-4 flex items-center"><ArrowUpRight className="w-5 h-5 mr-2 text-red-600" /> Issue/Release Items</h2>
            <form onSubmit={handleRelease} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Item</label>
                <select 
                  required
                  value={relItemId}
                  onChange={(e) => setRelItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Item...</option>
                  {inventory.filter(i => i.quantity > 0).map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Available: {i.quantity} {i.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity to Issue</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedRelItem?.quantity || ""}
                    value={relQty}
                    onChange={(e) => setRelQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {selectedRelItem && (
                    <p className="text-[10px] text-muted-foreground mt-1">Max available: {selectedRelItem.quantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={relDate}
                    onChange={(e) => setRelDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
                  <select
                    required
                    value={relDept}
                    onChange={(e) => setRelDept(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize"
                  >
                    <option value="">Select Dept...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Issued To (Person)</label>
                  <input
                    type="text"
                    required
                    value={relTo}
                    onChange={(e) => setRelTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes / Reason</label>
                <textarea
                  required
                  value={relNotes}
                  onChange={(e) => setRelNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={!selectedRelItem || parseInt(relQty) > selectedRelItem.quantity}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Issue Items
                </button>
              </div>
            </form>
          </div>

          <div className="bg-surface rounded-2xl shadow-sm border border-border-color overflow-hidden max-w-4xl">
            <div className="p-4 border-b border-border-color bg-muted/20">
              <h3 className="font-medium text-sm">Recent Issues</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border-color">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Dept / Person</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {recentReleases.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No recent issues</td></tr>}
                {recentReleases.map(txn => (
                  <tr key={txn.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 whitespace-nowrap">{txn.transactionDate}</td>
                    <td className="px-4 py-2 font-medium">{txn.inventoryName}</td>
                    <td className="px-4 py-2 text-red-600 font-medium">-{txn.quantity}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <span className="capitalize">{txn.department?.replace('_', ' ')}</span> / {txn.releasedToName}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{txn.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="bg-surface rounded-2xl shadow-sm border border-border-color overflow-hidden">
          <div className="p-4 border-b border-border-color flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search transactions by item..."
                value={txnSearch}
                onChange={(e) => setTxnSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="relative w-full md:w-auto">
              <Filter className="w-3 h-3 absolute left-3 top-3 text-muted-foreground" />
              <select
                value={txnTypeFilter}
                onChange={(e) => setTxnTypeFilter(e.target.value)}
                className="pl-8 pr-8 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
              >
                <option value="All">All Types</option>
                <option value="Receive">Receive</option>
                <option value="Release">Release</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border-color">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Performed By</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-border-color">
                {filteredTxns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTxns.map(txn => (
                    <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{txn.transactionDate}</td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {txn.photoUrl && (
                            <img src={txn.photoUrl} alt="Photo" className="h-6 w-6 rounded-md object-cover border border-border-color" />
                          )}
                          <span>{txn.inventoryName}</span>
                          {txn.receiptUrl && (
                            <a href={txn.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 ml-1">
                              <FileText size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-semibold ${
                          txn.transactionType === "receive" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                        }`}>
                          {txn.transactionType}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${txn.transactionType === "receive" ? "text-emerald-600" : "text-red-600"}`}>
                        {txn.transactionType === "receive" ? "+" : "-"}{txn.quantity}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {txn.transactionType === "receive" 
                          ? `From: ${txn.receivedFrom || "-"}` 
                          : `To: ${txn.releasedToName || "-"} (${txn.department?.replace('_', ' ') || "-"})`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{txn.performedByName || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{txn.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalOpen && adjustItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border-color rounded-2xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border-color flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold text-foreground">Adjust Stock: {adjustItem.name}</h3>
              <button 
                onClick={() => setAdjustModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Current quantity: <span className="font-semibold text-foreground">{adjustItem.quantity} {adjustItem.unit}</span>
                </p>
                <div className="flex gap-4 mb-4">
                  <label className="flex-1">
                    <input 
                      type="radio" 
                      className="sr-only peer"
                      name="adjustType"
                      checked={adjustType === "add"}
                      onChange={() => setAdjustType("add")}
                    />
                    <div className="p-3 text-center border border-border-color rounded-xl cursor-pointer peer-checked:border-emerald-600 peer-checked:bg-emerald-500/10 peer-checked:text-emerald-600 transition-all text-sm font-medium">
                      <Plus className="w-4 h-4 mx-auto mb-1" />
                      Add Stock
                    </div>
                  </label>
                  <label className="flex-1">
                    <input 
                      type="radio" 
                      className="sr-only peer"
                      name="adjustType"
                      checked={adjustType === "subtract"}
                      onChange={() => setAdjustType("subtract")}
                    />
                    <div className="p-3 text-center border border-border-color rounded-xl cursor-pointer peer-checked:border-red-600 peer-checked:bg-red-500/10 peer-checked:text-red-600 transition-all text-sm font-medium">
                      <Minus className="w-4 h-4 mx-auto mb-1" />
                      Remove Stock
                    </div>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={adjustType === "subtract" ? adjustItem.quantity : undefined}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reason / Notes</label>
                <textarea
                  required
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Found extra in storage, Damaged goods, Count correction"
                  className="w-full px-3 py-2 text-sm bg-background border border-border-color rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-muted/50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors ${
                    adjustType === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
