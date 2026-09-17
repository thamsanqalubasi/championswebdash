import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  MessageSquare,
  CheckCircle,
  Clock,
  LogOut,
  Home,
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  HelpCircle,
  X,
  Wrench,
  Receipt,
  FileText,
  Upload,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Star,
  BedDouble,
  FileSignature,
  Download,
  Eye,
  Sparkles,
  Calendar,
  Building2,
  UserCheck,
  UserX,
  Check,
  ArrowRight,
  UploadCloud,
  ShieldAlert,
} from "lucide-react";
import {
  DEFAULT_ENQUIRY_QUESTIONS,
  getDefaultResponseForQuestion,
  sendEnquiryResponseEmail,
} from "@/lib/enquiry-templates";
import { uploadFileToBucket, downloadHtmlDocument, fetchCompanyInfo, fetchAdminInfo } from "@/lib/storage";
import { buildProfessionalContractHtml } from "@/lib/document-templates";
import type { ContractSection } from "@/lib/document-templates";
import type { TenantPaymentProof } from "@/lib/types";

type CustomerBookingView = {
  id: string;
  propertyId: string;
  propertyName: string;
  roomId?: string;
  roomNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  bookingStatus: string;
  totalAmount: number;
  amountPaid: number;
  isPaid: boolean;
  notes?: string;
  createdAt: string;
};

type Enquiry = {
  id: string;
  type: string;
  status: string;
  message: string;
  created_at: string;
  property_id?: string;
  check_in_date?: string;
  check_out_date?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  company_id?: string;
};

type EnquiryMessage = {
  id: string;
  enquiry_id: string;
  sender_type: "customer" | "staff";
  sender_name: string;
  body: string;
  created_at: string;
};

type MaintenanceItem = {
  id: string;
  property_id?: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  executed_by_name?: string;
  company_id?: string;
  created_at: string;
  photo_url?: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  auto_closed: "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300",
};

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Tenancy assignment status
  const [assignedTenant, setAssignedTenant] = useState<any>(null);
  const [assignedProperty, setAssignedProperty] = useState<any>(null);
  const [tenantContracts, setTenantContracts] = useState<any[]>([]);
  const [contractSectionsMap, setContractSectionsMap] = useState<Record<string, ContractSection[]>>({});
  const [selectedContractForPreview, setSelectedContractForPreview] = useState<any | null>(null);

  // Navigation tab: if assigned -> "tenancy", if unassigned -> "listings"
  const [activeTab, setActiveTab] = useState<"tenancy" | "bookings" | "listings" | "enquiries">("listings");
  const [tenancySubTab, setTenancySubTab] = useState<"chat" | "pop" | "contracts" | "maintenance">("chat");

  // Assigned Property Chat
  const [propertyChatEnquiry, setPropertyChatEnquiry] = useState<Enquiry | null>(null);
  const [propertyChatMessages, setPropertyChatMessages] = useState<EnquiryMessage[]>([]);
  const [propertyChatText, setPropertyChatText] = useState("");
  const [sendingPropertyChat, setSendingPropertyChat] = useState(false);

  // Rent & Payment Proof (POP) state
  const [paymentProofs, setPaymentProofs] = useState<TenantPaymentProof[]>([]);
  const [popForm, setPopForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    paid_month: new Date().toISOString().slice(0, 7),
    payment_method: "EFT / Bank Transfer",
    reference_number: "",
    document_url: "",
    notes: "",
  });
  const [popFile, setPopFile] = useState<File | null>(null);
  const [uploadingPop, setUploadingPop] = useState(false);
  const [submittingPop, setSubmittingPop] = useState(false);
  const [popSuccessMsg, setPopSuccessMsg] = useState("");

  // Maintenance & Issue Reporting
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceItem[]>([]);
  const [maintenanceForm, setMaintenanceForm] = useState({
    category: "plumbing",
    priority: "medium",
    description: "",
    photo_url: "",
  });
  const [maintFile, setMaintFile] = useState<File | null>(null);
  const [uploadingMaintPhoto, setUploadingMaintPhoto] = useState(false);
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);
  const [maintenanceSuccessMsg, setMaintenanceSuccessMsg] = useState("");

  // Room Bookings state
  const [roomBookings, setRoomBookings] = useState<CustomerBookingView[]>([]);
  const [activeBookingChat, setActiveBookingChat] = useState<CustomerBookingView | null>(null);
  const [bookingChatEnquiry, setBookingChatEnquiry] = useState<Enquiry | null>(null);
  const [bookingChatMessages, setBookingChatMessages] = useState<EnquiryMessage[]>([]);
  const [bookingChatText, setBookingChatText] = useState("");
  const [sendingBookingChat, setSendingBookingChat] = useState(false);

  // Public Published Listings & Reviews/Inquiries
  const [publishedListings, setPublishedListings] = useState<any[]>([]);
  const [selectedListingForReview, setSelectedListingForReview] = useState<any | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", body: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");

  const [selectedListingForInquiry, setSelectedListingForInquiry] = useState<any | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ question_id: "", message: "", phone: "" });
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccessMsg, setInquirySuccessMsg] = useState("");

  // General Enquiries & Support History
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [messagesByEnquiry, setMessagesByEnquiry] = useState<Record<string, EnquiryMessage[]>>({});
  const [expandedEnquiries, setExpandedEnquiries] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});

  // Compute strict tenancy status
  const isAssigned = useMemo(() => {
    if (!assignedTenant?.property_id) return false;
    if (assignedTenant?.tenure_status === "ended") return false;
    if (tenantContracts.length > 0 && tenantContracts.every((c) => c.status === "ended" || c.status === "expired")) {
      return false;
    }
    return true;
  }, [assignedTenant, tenantContracts]);

  const hasEndedContract = useMemo(() => {
    if (assignedTenant?.tenure_status === "ended") return true;
    if (tenantContracts.length > 0 && tenantContracts.every((c) => c.status === "ended" || c.status === "expired")) {
      return true;
    }
    return false;
  }, [assignedTenant, tenantContracts]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/portal/login");
        return;
      }
      setSession(data.session);
      const email = data.session.user.email!;
      const sessionData = data.session;
      void loadAllPortalData(email, sessionData);
    });
  }, [navigate]);

  async function loadAllPortalData(email: string, sessionData?: any) {
    setLoading(true);
    try {
      // 1. Check if user is a tenant assigned to a property
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("*, properties(*)")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setAssignedTenant(tenantData || null);
      if (tenantData?.properties) {
        setAssignedProperty(tenantData.properties);
      } else {
        setAssignedProperty(null);
      }

      // 2. Load contracts for this tenant
      let userContracts: any[] = [];
      if (tenantData?.id) {
        const { data: cData } = await supabase
          .from("contracts")
          .select("*, properties(name)")
          .eq("tenant_id", tenantData.id)
          .order("created_at", { ascending: false });
        if (cData) {
          userContracts = cData;
          setTenantContracts(cData);

          // Load contract sections
          const contractIds = cData.map((c) => String(c.id));
          if (contractIds.length > 0) {
            const { data: cs } = await supabase
              .from("contract_sections")
              .select("contract_id, order_index, title, content")
              .in("contract_id", contractIds)
              .order("order_index");
            if (cs) {
              const secMap: Record<string, ContractSection[]> = {};
              cs.forEach((s: any) => {
                const cid = String(s.contract_id);
                if (!secMap[cid]) secMap[cid] = [];
                secMap[cid].push({ title: String(s.title), content: String(s.content) });
              });
              setContractSectionsMap(secMap);
            }
          }
        }
      }

      // Determine active assigned state
      const currentlyAssigned = Boolean(
        tenantData?.property_id &&
        tenantData?.tenure_status !== "ended" &&
        (!userContracts.length || userContracts.some((c) => c.status === "active" || c.status === "draft"))
      );

      if (currentlyAssigned) {
        setActiveTab("tenancy");
      } else {
        setActiveTab("listings");
      }

      // 3. Load published listings (public posts only)
      const { data: pubProps } = await supabase
        .from("properties")
        .select("id, name, type, address, city, country, monthly_rent, photos, description, is_published, company_id")
        .eq("is_published", true)
        .order("name", { ascending: true })
        .limit(50);
      if (pubProps) setPublishedListings(pubProps);
      // 3. Load published listings (Rooms, Properties, Agent Listings matching front index)
      try {
        const [roomsRes, pubPropsRes, agentRes] = await Promise.all([
          supabase
            .from("room_type_listings")
            .select("id, property_id, display_name, property_name, type_key, adults_capacity, kids_capacity, total_rooms_of_type, price_room_only, price_bed_breakfast, price_full_board, photos, amenities, is_active, properties(city, country, address)")
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("properties")
            .select("id, name, type, address, city, country, monthly_rent, photos, description, is_published, company_id")
            .or("is_published.eq.true,is_published.is.null")
            .order("name", { ascending: true })
            .limit(50),
          supabase
            .from("agent_listings")
            .select("*")
            .eq("is_published", true)
            .order("created_at", { ascending: false }),
        ]);

        const allUnified: any[] = [];

        // Room Type Showcases
        (roomsRes.data || []).forEach((r: any) => {
          const photos = Array.isArray(r.photos)
            ? r.photos
            : typeof r.photos === "string"
            ? (() => { try { return JSON.parse(r.photos); } catch { return []; } })()
            : [];
          const price = Number(r.price_room_only || r.price_bed_breakfast || r.price_full_board || 0);
          allUnified.push({
            id: r.id,
            property_id: r.property_id || r.id,
            name: r.display_name || r.property_name || "Hospitality Suite Showcase",
            type: r.type_key || "room",
            category_label: "Hospitality Showcase",
            address: (r.properties as any)?.address || r.property_name || "",
            city: (r.properties as any)?.city || "",
            country: (r.properties as any)?.country || "Namibia",
            monthly_rent: price,
            rent_unit: "/night",
            photos,
            description: Array.isArray(r.amenities) ? `Amenities: ${r.amenities.join(", ")}` : "Verified hospitality room suite with modern amenities.",
            listing_type: "room_showcase",
          });
        });

        // Properties
        (pubPropsRes.data || []).forEach((p: any) => {
          const photos = Array.isArray(p.photos)
            ? p.photos
            : typeof p.photos === "string"
            ? (() => { try { return JSON.parse(p.photos); } catch { return []; } })()
            : [];
          allUnified.push({
            id: p.id,
            property_id: p.id,
            name: p.name,
            type: p.type || "property",
            category_label: "Rental Property",
            address: p.address || "",
            city: p.city || "",
            country: p.country || "Namibia",
            monthly_rent: Number(p.monthly_rent || 0),
            rent_unit: "/mo",
            photos,
            description: p.description || `${p.name} - verified managed rental property ready for occupancy.`,
            listing_type: "property",
          });
        });

        // Agent Listings
        (agentRes.data || []).forEach((a: any) => {
          const photos = Array.isArray(a.photos)
            ? a.photos
            : typeof a.photos === "string"
            ? (() => { try { return JSON.parse(a.photos); } catch { return []; } })()
            : [];
          allUnified.push({
            id: a.id,
            property_id: a.id,
            name: a.name,
            type: a.type || "house",
            category_label: a.listing_type === "sale" ? "Property For Sale" : "Agent Rental",
            address: a.address || "",
            city: a.city || "",
            country: a.country || "Namibia",
            monthly_rent: Number(a.price || 0),
            rent_unit: a.listing_type === "sale" ? "" : "/mo",
            photos,
            description: a.description || `${a.name} - premium agent listing in ${a.city || "prime location"}.`,
            listing_type: "agent_listing",
          });
        });

        setPublishedListings(allUnified);
      } catch (e) {
        console.warn("Could not load published listings:", e);
      }

      // 4. If assigned, load assigned property chat, maintenance, and POPs
      if (currentlyAssigned && tenantData?.property_id) {
        await Promise.all([
          initAssignedPropertyChat(email, tenantData.property_id, tenantData.properties?.company_id, sessionData),
          loadMaintenanceForProperty(tenantData.property_id),
          loadPaymentProofs(email),
        ]);
      } else {
        await loadPaymentProofs(email);
      }

      // 5. Load commercial room bookings
      await loadRoomBookings(email);

      // 6. Load general support enquiries
      await loadEnquiries(email);
    } catch (err) {
      console.warn("Error loading customer portal data:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ---- Assigned Property Chat ---- */
  async function initAssignedPropertyChat(email: string, propertyId: string, companyId?: string, sessionData?: any) {
    try {
      const tenantName = sessionData?.user?.user_metadata?.full_name || email.split("@")[0] || "Tenant";
      // Use type 'general' with a special message prefix since enquiries.type CHECK constraint
      // only allows: rental_enquiry, room_booking, general
      const CHAT_PREFIX = "[RESIDENT_CHAT]";

      const { data: existingChat } = await supabase
        .from("enquiries")
        .select("*")
        .eq("customer_email", email)
        .eq("property_id", propertyId)
        .eq("type", "general")
        .ilike("message", `${CHAT_PREFIX}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingChat) {
        setPropertyChatEnquiry(existingChat);
        await loadPropertyChatMessages(existingChat.id);
      } else {
        // Create initial resident chat thread
        const { data: newChat, error: chatError } = await supabase
          .from("enquiries")
          .insert({
            customer_email: email,
            customer_name: tenantName,
            property_id: propertyId,
            company_id: companyId || null,
            type: "general",
            status: "open",
            message: `${CHAT_PREFIX} Assigned Resident Communication Channel`,
          })
          .select()
          .single();

        if (chatError) {
          console.warn("Could not create resident chat thread:", chatError.message);
          return;
        }

        if (newChat) {
          setPropertyChatEnquiry(newChat);
          await supabase.from("enquiry_messages").insert({
            enquiry_id: newChat.id,
            sender_type: "staff",
            sender_name: "Property Management",
            body: `Welcome ${tenantName}! This is your direct resident chat with property management. Message us anytime for assistance, lease queries, or maintenance guidance.`,
          });
          await loadPropertyChatMessages(newChat.id);
        }
      }
    } catch (err) {
      console.warn("Could not init assigned property chat:", err);
    }
  }

  async function loadPropertyChatMessages(enquiryId: string) {
    try {
      const { data } = await supabase
        .from("enquiry_messages")
        .select("*")
        .eq("enquiry_id", enquiryId)
        .order("created_at", { ascending: true });
      if (data) setPropertyChatMessages(data);
    } catch (err) {
      console.warn("Could not load property chat messages:", err);
    }
  }

  const handleSendPropertyChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyChatText.trim() || !propertyChatEnquiry) return;
    setSendingPropertyChat(true);
    try {
      const senderName = session?.user?.user_metadata?.full_name || session?.user?.email || "Tenant";
      const { data: inserted } = await supabase
        .from("enquiry_messages")
        .insert({
          enquiry_id: propertyChatEnquiry.id,
          sender_type: "customer",
          sender_name: senderName,
          body: propertyChatText.trim(),
        })
        .select()
        .single();

      if (inserted) {
        setPropertyChatMessages((prev) => [...prev, inserted]);
        setPropertyChatText("");
      }
    } catch (err) {
      console.warn("Could not send message:", err);
    } finally {
      setSendingPropertyChat(false);
    }
  };

  /* ---- Maintenance Handlers ---- */
  async function loadMaintenanceForProperty(propertyId: string) {
    try {
      const { data } = await supabase
        .from("maintenance")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

      if (data) {
        setMaintenanceList(data);
      }
    } catch (err) {
      console.warn("Could not load maintenance:", err);
    }
  }

  const handleMaintPhotoUpload = async (file: File | null) => {
    if (!file || !session?.user?.email) return;
    setUploadingMaintPhoto(true);
    try {
      const url = await uploadFileToBucket("maintenance-photos", session.user.email, file);
      setMaintenanceForm((prev) => ({ ...prev, photo_url: url }));
    } catch (err) {
      alert("Could not upload photo: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingMaintPhoto(false);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedProperty?.id) {
      alert("You must be assigned to an active property to submit maintenance.");
      return;
    }
    if (!maintenanceForm.description.trim()) {
      alert("Please describe the maintenance issue.");
      return;
    }

    setSubmittingMaintenance(true);
    try {
      const email = session?.user?.email!;
      const userName = session?.user?.user_metadata?.full_name || email.split("@")[0] || "Tenant";

      const desc = maintenanceForm.photo_url.trim()
        ? `${maintenanceForm.description.trim()}\n\n[Photo Attachment]: ${maintenanceForm.photo_url.trim()}`
        : maintenanceForm.description.trim();

      const { data: inserted, error } = await supabase
        .from("maintenance")
        .insert({
          property_id: assignedProperty.id,
          company_id: assignedProperty.company_id || null,
          category: maintenanceForm.category,
          priority: maintenanceForm.priority,
          description: desc,
          photo_url: maintenanceForm.photo_url || null,
          status: "open",
          executed_by_name: `${userName} (${email})`,
        })
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        setMaintenanceList((prev) => [inserted, ...prev]);
      }
      setMaintenanceSuccessMsg("Your maintenance ticket has been logged for management dispatch!");
      setTimeout(() => {
        setMaintenanceSuccessMsg("");
        setMaintenanceForm({
          category: "plumbing",
          priority: "medium",
          description: "",
          photo_url: "",
        });
        setMaintFile(null);
      }, 2500);
    } catch (err: any) {
      alert(err?.message || "Failed to submit maintenance ticket.");
    } finally {
      setSubmittingMaintenance(false);
    }
  };

  /* ---- Rent POP Handlers ---- */
  async function loadPaymentProofs(email: string) {
    try {
      const { data } = await supabase
        .from("tenant_payment_proofs")
        .select("*")
        .eq("customer_email", email)
        .order("payment_date", { ascending: false });
      if (data) setPaymentProofs(data);
    } catch (err) {
      console.warn("Could not load payment proofs:", err);
    }
  }

  const handlePopFileUpload = async (file: File | null) => {
    if (!file || !session?.user?.email) return;
    setUploadingPop(true);
    try {
      const url = await uploadFileToBucket("payment-proofs", session.user.email, file);
      setPopForm((prev) => ({ ...prev, document_url: url }));
    } catch (err) {
      alert("Could not upload POP receipt: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingPop(false);
    }
  };

  const handleCreatePop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedProperty?.id) {
      alert("You must be assigned to an active property to upload rent POP.");
      return;
    }
    const amt = Number(popForm.amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }
    if (!popForm.document_url) {
      alert("Please upload your bank receipt or payment slip document.");
      return;
    }

    setSubmittingPop(true);
    try {
      const email = session?.user?.email!;
      const userName = session?.user?.user_metadata?.full_name || email.split("@")[0] || "Tenant";

      const notesPayload = `Period: ${popForm.paid_month} | Method: ${popForm.payment_method}${popForm.notes ? ` | Notes: ${popForm.notes}` : ""}`;

      const { data: inserted, error } = await supabase
        .from("tenant_payment_proofs")
        .insert({
          company_id: assignedProperty.company_id || null,
          tenant_id: assignedTenant?.id || null,
          property_id: assignedProperty.id,
          customer_email: email,
          customer_name: userName,
          amount: amt,
          payment_date: popForm.payment_date,
          reference_number: popForm.reference_number.trim() || `${popForm.paid_month} Rent POP`,
          document_url: popForm.document_url,
          notes: notesPayload,
          status: "pending_review",
        })
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        setPaymentProofs((prev) => [inserted, ...prev]);
      }
      setPopSuccessMsg("Proof of Payment uploaded successfully! The accounting team will verify it shortly.");
      setTimeout(() => {
        setPopSuccessMsg("");
        setPopForm({
          amount: "",
          payment_date: new Date().toISOString().slice(0, 10),
          paid_month: new Date().toISOString().slice(0, 7),
          payment_method: "EFT / Bank Transfer",
          reference_number: "",
          document_url: "",
          notes: "",
        });
        setPopFile(null);
      }, 2500);
    } catch (err: any) {
      alert(err?.message || "Failed to submit POP.");
    } finally {
      setSubmittingPop(false);
    }
  };

  const handleDownloadContract = async (c: any) => {
    try {
      const sections = contractSectionsMap[c.id] || [];
      const [comp, adm] = await Promise.all([
        fetchCompanyInfo(assignedProperty?.company_id),
        fetchAdminInfo(),
      ]);
      const html = buildProfessionalContractHtml(
        {
          contractTitle: c.title || "Lease Agreement",
          tenantName: userName,
          propertyName: c.properties?.name || assignedProperty?.name || "Assigned Property",
          startDate: c.start_date || "",
          endDate: c.end_date || "",
          monthlyRent: Number(c.monthly_rent || 0),
          depositAmount: Number(c.deposit_amount || 0),
          status: c.status || "active",
          notes: c.notes || "",
          sections,
        },
        comp,
        adm
      );
      downloadHtmlDocument(html, `contract-${(c.title || "lease").replace(/\s+/g, "_")}.html`);
    } catch (err) {
      alert("Could not generate contract download: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  /* ---- Room Bookings & Booking Chat ---- */
  async function loadRoomBookings(email: string) {
    try {
      const { data } = await supabase
        .from("commercial_bookings")
        .select("*, properties(name), commercial_rooms(room_number)")
        .eq("customer_email", email)
        .order("check_in_date", { ascending: false });

      if (data) {
        const mapped: CustomerBookingView[] = data.map((b: any) => ({
          id: String(b.id),
          propertyId: String(b.property_id || ""),
          propertyName: b.properties?.name || "Lodge/Hotel",
          roomId: String(b.room_id || ""),
          roomNumber: b.commercial_rooms?.room_number || "Reserved Room",
          customerName: String(b.customer_name || ""),
          customerEmail: String(b.customer_email || ""),
          customerPhone: b.customer_phone || undefined,
          checkInDate: String(b.check_in_date || ""),
          checkOutDate: String(b.check_out_date || ""),
          bookingStatus: (b.booking_status || "confirmed") as any,
          totalAmount: Number(b.total_amount || 0),
          amountPaid: Number(b.amount_paid || 0),
          isPaid: Boolean(b.is_paid || Number(b.amount_paid) >= Number(b.total_amount)),
          notes: b.notes || undefined,
          createdAt: String(b.created_at || ""),
        }));
        setRoomBookings(mapped);
      }
    } catch (err) {
      console.warn("Could not load commercial bookings:", err);
    }
  }

  const handleOpenBookingChat = async (booking: CustomerBookingView) => {
    setActiveBookingChat(booking);
    try {
      const email = session?.user?.email!;
      const { data: existingChat } = await supabase
        .from("enquiries")
        .select("*")
        .eq("customer_email", email)
        .eq("property_id", booking.propertyId)
        .eq("type", "room_booking_chat")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingChat) {
        setBookingChatEnquiry(existingChat);
        const { data: msgs } = await supabase
          .from("enquiry_messages")
          .select("*")
          .eq("enquiry_id", existingChat.id)
          .order("created_at", { ascending: true });
        if (msgs) setBookingChatMessages(msgs);
      } else {
        const { data: newChat } = await supabase
          .from("enquiries")
          .insert({
            customer_email: email,
            customer_name: booking.customerName || email.split("@")[0] || "Guest",
            property_id: booking.propertyId,
            type: "room_booking_chat",
            status: "open",
            message: `Room Booking Chat for Room ${booking.roomNumber} (${booking.checkInDate} to ${booking.checkOutDate})`,
          })
          .select()
          .single();

        if (newChat) {
          setBookingChatEnquiry(newChat);
          await supabase.from("enquiry_messages").insert({
            enquiry_id: newChat.id,
            sender_type: "staff",
            sender_name: "Front Desk & Reservations",
            body: `Hello ${booking.customerName || "Guest"}! Your reservation for Room ${booking.roomNumber} from ${booking.checkInDate} to ${booking.checkOutDate} is recorded. How can we assist your stay?`,
          });
          const { data: msgs } = await supabase
            .from("enquiry_messages")
            .select("*")
            .eq("enquiry_id", newChat.id)
            .order("created_at", { ascending: true });
          if (msgs) setBookingChatMessages(msgs);
        }
      }
    } catch (err) {
      console.warn("Could not open booking chat:", err);
    }
  };

  const handleSendBookingChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingChatText.trim() || !bookingChatEnquiry) return;
    setSendingBookingChat(true);
    try {
      const senderName = session?.user?.user_metadata?.full_name || session?.user?.email || "Guest";
      const { data: inserted } = await supabase
        .from("enquiry_messages")
        .insert({
          enquiry_id: bookingChatEnquiry.id,
          sender_type: "customer",
          sender_name: senderName,
          body: bookingChatText.trim(),
        })
        .select()
        .single();

      if (inserted) {
        setBookingChatMessages((prev) => [...prev, inserted]);
        setBookingChatText("");
      }
    } catch (err) {
      alert("Could not send booking chat: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSendingBookingChat(false);
    }
  };

  /* ---- Public Listing Review & Inquiry Handlers ---- */
  const handleSubmitSpecificReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListingForReview) return;
    setSubmittingReview(true);
    try {
      const email = session?.user?.email!;
      const userName = session?.user?.user_metadata?.full_name || email.split("@")[0] || "Customer";

      await supabase.from("audit_log").insert({
        user_email: email,
        user_name: userName,
        action: "public_listing_review",
        entity_type: "property",
        entity_id: selectedListingForReview.id,
        company_id: selectedListingForReview.company_id || null,
        details: {
          property_name: selectedListingForReview.name,
          rating: reviewForm.rating,
          title: reviewForm.title,
          body: reviewForm.body,
          submitted_at: new Date().toISOString(),
        },
      });

      setReviewSuccessMsg(`Thank you! Your verified review for "${selectedListingForReview.name}" has been published.`);
      setTimeout(() => {
        setSelectedListingForReview(null);
        setReviewSuccessMsg("");
        setReviewForm({ rating: 5, title: "", body: "" });
      }, 2200);
    } catch (err: any) {
      alert("Failed to submit review: " + (err?.message || String(err)));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitSpecificInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListingForInquiry) return;
    if (!inquiryForm.message.trim()) {
      alert("Please enter a question or inquiry message.");
      return;
    }
    setSubmittingInquiry(true);
    try {
      const email = session?.user?.email!;
      const userName = session?.user?.user_metadata?.full_name || email.split("@")[0] || "Customer";

      const { data: inserted, error } = await supabase
        .from("enquiries")
        .insert({
          customer_email: email,
          customer_name: userName,
          customer_phone: inquiryForm.phone || null,
          property_id: selectedListingForInquiry.id,
          company_id: selectedListingForInquiry.company_id || null,
          type: "rental_enquiry",
          status: "open",
          message: `Inquiry on listing "${selectedListingForInquiry.name}":\n\n${inquiryForm.message.trim()}`,
        })
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        await supabase.from("enquiry_messages").insert({
          enquiry_id: inserted.id,
          sender_type: "customer",
          sender_name: userName,
          body: inquiryForm.message.trim(),
        });
      }

      setInquirySuccessMsg(`Your inquiry on "${selectedListingForInquiry.name}" has been sent to the property managers!`);
      setTimeout(() => {
        setSelectedListingForInquiry(null);
        setInquirySuccessMsg("");
        setInquiryForm({ question_id: "", message: "", phone: "" });
        void loadEnquiries(email);
      }, 2200);
    } catch (err: any) {
      alert("Failed to send inquiry: " + (err?.message || String(err)));
    } finally {
      setSubmittingInquiry(false);
    }
  };

  /* ---- Support Enquiries History ---- */
  async function loadEnquiries(email: string) {
    try {
      const { data } = await supabase
        .from("enquiries")
        .select("*")
        .eq("customer_email", email)
        .order("created_at", { ascending: false });

      if (data) {
        setEnquiries(data);
        const ids = data.map((e) => e.id);
        const initialExpanded: Record<string, boolean> = {};
        data.slice(0, 2).forEach((e) => {
          initialExpanded[e.id] = true;
        });
        setExpandedEnquiries(initialExpanded);
        void loadMessagesForEnquiries(ids);
      }
    } catch (err) {
      console.error("Error loading enquiries:", err);
    }
  }

  async function loadMessagesForEnquiries(enquiryIds: string[]) {
    if (!enquiryIds || enquiryIds.length === 0) return;
    try {
      const { data } = await supabase
        .from("enquiry_messages")
        .select("*")
        .in("enquiry_id", enquiryIds)
        .order("created_at", { ascending: true });

      if (data) {
        const grouped: Record<string, EnquiryMessage[]> = {};
        data.forEach((m: any) => {
          if (!grouped[m.enquiry_id]) grouped[m.enquiry_id] = [];
          grouped[m.enquiry_id].push(m);
        });
        setMessagesByEnquiry((prev) => ({ ...prev, ...grouped }));
      }
    } catch (err) {
      console.warn("Could not load enquiry messages:", err);
    }
  }

  const handleSendReply = async (enquiry: Enquiry) => {
    const text = (replyText[enquiry.id] || "").trim();
    if (!text) return;

    setSubmittingReply((prev) => ({ ...prev, [enquiry.id]: true }));
    try {
      const customerName = session?.user?.user_metadata?.full_name || enquiry.customer_name || "Customer";
      const { data: insertedMsg } = await supabase
        .from("enquiry_messages")
        .insert({
          enquiry_id: enquiry.id,
          sender_type: "customer",
          sender_name: customerName,
          body: text,
        })
        .select()
        .single();

      if (insertedMsg) {
        setMessagesByEnquiry((prev) => ({
          ...prev,
          [enquiry.id]: [...(prev[enquiry.id] || []), insertedMsg],
        }));
      }

      setReplyText((prev) => ({ ...prev, [enquiry.id]: "" }));
    } catch (err: any) {
      alert("Failed to send reply: " + (err?.message || String(err)));
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [enquiry.id]: false }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || "Resident";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 text-slate-900 dark:text-slate-100">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Resident Portal</h1>
              {isAssigned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <UserCheck size={12} />
                  <span>Assigned Resident</span>
                </span>
              ) : hasEndedContract ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <UserX size={12} />
                  <span>Tenancy Ended</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-500/20">
                  <span>Guest / Unassigned</span>
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">
              {userName} &bull; {session?.user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            <Home size={14} /> Main Site
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* STRICT TENANCY BANNER */}
      {isAssigned && assignedProperty ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Assigned Residence
              </p>
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                {assignedProperty.name}
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                {assignedProperty.address ? `${assignedProperty.address}, ` : ""}{assignedProperty.city || "Namibia"}
                {assignedTenant?.tenure_start_date && (
                  <span className="ml-2 font-medium text-emerald-700 dark:text-emerald-300">
                    &bull; Leased since {new Date(assignedTenant.tenure_start_date).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveTab("tenancy");
                setTenancySubTab("chat");
              }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs"
            >
              <MessageSquare size={13} /> Chat with Management
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
          <AlertTriangle size={22} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
              {hasEndedContract
                ? "Your tenancy contract has ended."
                : "You are currently not assigned to any property."}
            </p>
            <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              Explore our verified published listings below. You can comment, leave a review, or send an inquiry directly on any specific public property post. To link a new residential lease, request an invitation link from your property manager.
            </p>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-gray-200 dark:border-slate-800 pb-3">
        {/* If assigned, show Tenancy tab */}
        {isAssigned && (
          <button
            onClick={() => setActiveTab("tenancy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === "tenancy"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
            }`}
          >
            <Building2 size={16} />
            <span>My Tenancy</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase">
              Active
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("listings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "listings"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Home size={16} />
          <span>Public Listings</span>
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold">
            {publishedListings.length}
          </span>
        </button>

        {roomBookings.length > 0 && (
          <button
            onClick={() => setActiveTab("bookings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === "bookings"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
            }`}
          >
            <BedDouble size={16} />
            <span>Room Bookings</span>
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-extrabold">
              {roomBookings.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("enquiries")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "enquiries"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <MessageSquare size={16} />
          <span>Inquiries &amp; Support</span>
          {enquiries.length > 0 && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold">
              {enquiries.length}
            </span>
          )}
        </button>

        {isAssigned && (
          <button
            onClick={() => { setActiveTab("tenancy"); setTenancySubTab("chat"); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === "tenancy"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
            }`}
          >
            <Building2 size={16} />
            <span>Assigned Residence</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY TENANCY (LOCKED TO ASSIGNED PROPERTY)                           */}
      {/* ========================================================================= */}
      {activeTab === "tenancy" && isAssigned && assignedProperty && (
        <div className="space-y-6">
          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setTenancySubTab("chat")}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                tenancySubTab === "chat"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
              }`}
            >
              <MessageSquare size={14} /> Property Chat
            </button>
            <button
              onClick={() => setTenancySubTab("pop")}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                tenancySubTab === "pop"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
              }`}
            >
              <Receipt size={14} /> Rent &amp; POP ({paymentProofs.length})
            </button>
            <button
              onClick={() => setTenancySubTab("contracts")}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                tenancySubTab === "contracts"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
              }`}
            >
              <FileSignature size={14} /> Contracts ({tenantContracts.length})
            </button>
            <button
              onClick={() => setTenancySubTab("maintenance")}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                tenancySubTab === "maintenance"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
              }`}
            >
              <Wrench size={14} /> Maintenance ({maintenanceList.length})
            </button>
          </div>

          {/* SUBTAB A: PROPERTY CHAT */}
          {tenancySubTab === "chat" && (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageSquare size={16} className="text-emerald-600" />
                    Resident Chat &bull; {assignedProperty.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Direct thread with property management staff and landlord operations
                  </p>
                </div>
                <button
                  onClick={() => propertyChatEnquiry && loadPropertyChatMessages(propertyChatEnquiry.id)}
                  className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {/* Message thread */}
              <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto bg-slate-50/30 dark:bg-slate-900/30">
                {propertyChatMessages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No messages yet. Send a message to property management below!
                  </div>
                ) : (
                  propertyChatMessages.map((m) => {
                    const isStaff = m.sender_type === "staff";
                    // Check for 1-click ticket prompt
                    const promptMatch = m.body.match(/\[Ticket Prompt:\s*([^\]]+)\]/i);
                    const promptSubject = promptMatch ? promptMatch[1].trim() : null;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isStaff ? "items-start" : "items-end"} space-y-1`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                            isStaff
                              ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 shadow-xs"
                              : "bg-emerald-600 text-white shadow-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.body.replace(/\[Ticket Prompt:\s*[^\]]+\]/gi, "").trim()}
                          </p>

                          {/* 1-Click Ticket Prompt button if staff prompted tenant */}
                          {promptSubject && isStaff && (
                            <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-700">
                              <button
                                onClick={() => {
                                  setTenancySubTab("maintenance");
                                  setMaintenanceForm((prev) => ({
                                    ...prev,
                                    category: promptSubject.toLowerCase().includes("plumb")
                                      ? "plumbing"
                                      : promptSubject.toLowerCase().includes("electr")
                                      ? "electrical"
                                      : promptSubject.toLowerCase().includes("applian")
                                      ? "appliance"
                                      : "general",
                                    description: `Issue regarding: ${promptSubject}\n\n`,
                                  }));
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                              >
                                <Wrench size={12} />
                                <span>Open {promptSubject} Ticket Now</span>
                                <ArrowRight size={11} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Attribution in small font */}
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 px-1">
                          {isStaff ? (
                            <span>
                              Responded by: <strong className="text-gray-600 dark:text-slate-300 font-semibold">{m.sender_name}</strong>
                            </span>
                          ) : (
                            <span>You</span>
                          )}
                          <span>&bull;</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendPropertyChat} className="p-3 border-t border-gray-100 dark:border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message to management (e.g. rent receipt question, amenity request)..."
                  value={propertyChatText}
                  onChange={(e) => setPropertyChatText(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={sendingPropertyChat || !propertyChatText.trim()}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* SUBTAB B: RENT & PROOF OF PAYMENT (POP) */}
          {tenancySubTab === "pop" && (
            <div className="space-y-6">
              {/* Upload POP Card */}
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Receipt size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                        Upload Rent Proof of Payment (POP)
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Attach your EFT bank slip, transfer receipt, or deposit slip for reconciliation.
                      </p>
                    </div>
                  </div>
                </div>

                {popSuccessMsg ? (
                  <div className="p-6 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 text-center space-y-2">
                    <CheckCircle size={32} className="mx-auto text-emerald-500" />
                    <p className="font-bold text-sm">{popSuccessMsg}</p>
                  </div>
                ) : (
                  <form onSubmit={handleCreatePop} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Payment Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={popForm.payment_date}
                          onChange={(e) => setPopForm({ ...popForm, payment_date: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Paid Month / Period *
                        </label>
                        <input
                          type="month"
                          required
                          value={popForm.paid_month}
                          onChange={(e) => setPopForm({ ...popForm, paid_month: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Amount Paid (NAD / ZAR) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          required
                          placeholder="e.g. 8500.00"
                          value={popForm.amount}
                          onChange={(e) => setPopForm({ ...popForm, amount: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Means of Payment *
                        </label>
                        <select
                          value={popForm.payment_method}
                          onChange={(e) => setPopForm({ ...popForm, payment_method: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-emerald-500"
                        >
                          <option value="EFT / Bank Transfer">EFT / Bank Transfer</option>
                          <option value="Cash">Cash (Over the counter / Office)</option>
                          <option value="POS Card">POS Card</option>
                          <option value="Mobile Money">Mobile Money (e.g. eWallet / EasyWallet)</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Bank Reference / TXN Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. FT2609001928, Slip #, or Cheque #"
                          value={popForm.reference_number}
                          onChange={(e) => setPopForm({ ...popForm, reference_number: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Receipt File Upload */}
                    <div>
                      <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                        Proof of Payment Document (PDF or Photo) *
                      </label>
                      <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                        {popForm.document_url ? (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 truncate">
                              <FileText size={16} className="text-emerald-500 shrink-0" />
                              <span className="truncate max-w-[280px] font-semibold text-gray-900 dark:text-white">
                                {popFile?.name || "Uploaded Proof Document"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={popForm.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                View <ExternalLink size={11} />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  setPopForm({ ...popForm, document_url: "" });
                                  setPopFile(null);
                                }}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center cursor-pointer">
                            <UploadCloud size={28} className="text-gray-400 mb-1" />
                            <span className="font-bold text-gray-700 dark:text-slate-200">
                              {uploadingPop ? "Uploading receipt..." : "Click to select POP receipt or PDF"}
                            </span>
                            <span className="text-[10px] text-gray-400">Supports JPG, PNG, PDF up to 10MB</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              disabled={uploadingPop}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setPopFile(file);
                                if (file) void handlePopFileUpload(file);
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                        Optional Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paid together with water bill..."
                        value={popForm.notes}
                        onChange={(e) => setPopForm({ ...popForm, notes: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingPop || uploadingPop || !popForm.amount}
                        className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs flex items-center gap-2"
                      >
                        <Upload size={14} />
                        <span>{submittingPop ? "Submitting..." : "Submit Proof of Payment"}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Submitted POPs History */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Receipt size={16} className="text-emerald-600" />
                  Your Submitted Proof of Payments
                </h4>

                {paymentProofs.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
                    No payment proofs submitted yet. Submit your rent payment slip above!
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    {paymentProofs.map((p) => (
                      <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              NAD {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                p.status === "verified"
                                  ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                                  : p.status === "rejected"
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {p.status ? p.status.replace("_", " ") : "Pending Review"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Payment Date: {p.payment_date} &bull; Ref: {p.reference_number || "—"}
                          </p>
                          {p.notes && <p className="text-[11px] text-gray-600 dark:text-slate-400 mt-1">{p.notes}</p>}
                        </div>

                        {p.document_url && (
                          <a
                            href={p.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-1.5 font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition shrink-0"
                          >
                            <FileText size={13} className="text-emerald-600" />
                            <span>View Attached Receipt</span>
                            <ExternalLink size={11} className="text-gray-400" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB C: LEASE CONTRACTS */}
          {tenancySubTab === "contracts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileSignature size={16} className="text-emerald-600" />
                    Lease Agreements &amp; Contracts
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Official lease contracts signed with the property management company.
                  </p>
                </div>
              </div>

              {tenantContracts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
                  <FileSignature size={36} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                  No formal contract documents uploaded yet. Contact property management for a digital copy.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tenantContracts.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-base text-gray-900 dark:text-white uppercase tracking-tight">
                            {c.title}
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              c.status === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-3">
                          {c.properties?.name || assignedProperty.name}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Rental Period</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {c.start_date} to {c.end_date}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Monthly Rent</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">
                              NAD {Number(c.monthly_rent || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
                        <button
                          onClick={() => setSelectedContractForPreview(c)}
                          className="flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-200"
                        >
                          <Eye size={13} /> View Terms
                        </button>
                        {c.document_url ? (
                          <a
                            href={c.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                          >
                            <Download size={13} /> Download PDF
                          </a>
                        ) : (
                          <button
                            onClick={() => void handleDownloadContract(c)}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                          >
                            <Download size={13} /> Save Agreement
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB D: MAINTENANCE TICKETS (LOCKED TO PROPERTY) */}
          {tenancySubTab === "maintenance" && (
            <div className="space-y-6">
              {/* Log Ticket Card */}
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
                <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800 mb-5">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                      Log Maintenance Issue &bull; {assignedProperty.name}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Report plumbing, electrical, or structural faults directly to our technical service team.
                    </p>
                  </div>
                </div>

                {maintenanceSuccessMsg ? (
                  <div className="p-6 rounded-xl bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200 text-center space-y-2">
                    <CheckCircle size={32} className="mx-auto text-green-500" />
                    <p className="font-bold text-sm">{maintenanceSuccessMsg}</p>
                  </div>
                ) : (
                  <form onSubmit={handleCreateMaintenance} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Issue Category *
                        </label>
                        <select
                          value={maintenanceForm.category}
                          onChange={(e) => setMaintenanceForm({ ...maintenanceForm, category: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-amber-500"
                        >
                          <option value="plumbing">Plumbing (Leaks, Taps, Drainage)</option>
                          <option value="electrical">Electrical (Lights, Sockets, Breakers)</option>
                          <option value="appliance">Appliance (Stove, Geyser, Fridge)</option>
                          <option value="hvac">HVAC / Air Conditioning</option>
                          <option value="roofing">Roofing &amp; Ceilings</option>
                          <option value="pest_control">Pest Control</option>
                          <option value="structural">Doors, Locks &amp; Windows</option>
                          <option value="general">General Maintenance</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                          Urgency / Priority *
                        </label>
                        <select
                          value={maintenanceForm.priority}
                          onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-amber-500"
                        >
                          <option value="low">Low (Standard routine check)</option>
                          <option value="medium">Medium (Requires attention soon)</option>
                          <option value="high">High (Impacting daily comfort)</option>
                          <option value="urgent">Urgent (Flooding, total power outage, hazard)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                        Issue Description *
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Describe the exact problem, location in unit (e.g. master bathroom), and how long it has been occurring..."
                        value={maintenanceForm.description}
                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    {/* Photo upload */}
                    <div>
                      <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                        Attach Photo of Fault / Damage (Optional)
                      </label>
                      <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                        {maintenanceForm.photo_url ? (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                            <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[280px]">
                              Photo attached successfully
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setMaintenanceForm({ ...maintenanceForm, photo_url: "" });
                                setMaintFile(null);
                              }}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 cursor-pointer py-1">
                            <UploadCloud size={18} className="text-gray-400" />
                            <span className="font-bold text-gray-700 dark:text-slate-200">
                              {uploadingMaintPhoto ? "Uploading photo..." : "Upload Photo of Problem"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingMaintPhoto}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setMaintFile(file);
                                if (file) void handleMaintPhotoUpload(file);
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingMaintenance || uploadingMaintPhoto || !maintenanceForm.description.trim()}
                        className="rounded-xl bg-amber-600 px-6 py-2.5 font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition shadow-xs flex items-center gap-2"
                      >
                        <Wrench size={14} />
                        <span>{submittingMaintenance ? "Submitting..." : "Log Maintenance Request"}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Maintenance History */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Wrench size={16} className="text-amber-600" />
                  Your Active &amp; Past Work Orders
                </h4>

                {maintenanceList.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
                    No maintenance tickets reported for this unit. Everything is running smoothly!
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    {maintenanceList.map((m) => (
                      <div key={m.id} className="p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                STATUS_COLORS[m.status] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {m.status.replace("_", " ")}
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white capitalize">
                              {m.category} Issue
                            </span>
                            <span className="text-[10px] text-gray-400">
                              &bull; {m.priority} priority
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {m.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PUBLIC PUBLISHED LISTINGS & REVIEWS/INQUIRIES                     */}
      {/* ========================================================================= */}
      {activeTab === "listings" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Home size={18} className="text-indigo-600" />
                Published Properties &amp; Hospitality Showcases
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Browse verified properties. Click to comment, leave a verified review, or send an inquiry on any specific post.
              </p>
            </div>
          </div>

          {publishedListings.length === 0 ? (
            <div className="p-16 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
              <Home size={40} className="mx-auto mb-2 opacity-30 text-indigo-500" />
              No public listings are published at this moment. Check back soon!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {publishedListings.map((listing) => {
                const photos = Array.isArray(listing.photos)
                  ? listing.photos
                  : typeof listing.photos === "string"
                  ? (() => { try { return JSON.parse(listing.photos); } catch { return []; } })()
                  : [];
                const photo = photos[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80";
                const rent = Number(listing.monthly_rent || 0);

                return (
                  <div
                    key={listing.id}
                    className="group rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                  >
                    {/* Photo */}
                    <div className="relative h-52 w-full bg-gray-100 dark:bg-slate-800 overflow-hidden shrink-0">
                      <img
                        src={photo}
                        alt={listing.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80";
                        }}
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {/* Type badge */}
                      <span className="absolute top-3 left-3 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-gray-800 dark:text-slate-100 uppercase tracking-wider shadow-sm">
                        {listing.type ? listing.type.replace(/_/g, " ") : "Property"}
                        {listing.category_label || (listing.type ? listing.type.replace(/_/g, " ") : "Property")}
                      </span>
                      {/* Photo count */}
                      {photos.length > 1 && (
                        <span className="absolute top-3 right-3 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                          {photos.length}
                        </span>
                      )}
                      {/* Price on image */}
                      {rent > 0 && (
                        <div className="absolute bottom-3 left-3">
                          <span className="rounded-xl bg-indigo-600 px-3 py-1 text-xs font-black text-white shadow-md">
                            NAD {rent.toLocaleString()}<span className="font-normal opacity-80 text-[10px]">/mo</span>
                            NAD {rent.toLocaleString()}<span className="font-normal opacity-80 text-[10px]">{listing.rent_unit || "/mo"}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-col flex-1 p-4 gap-2">
                      {/* Title + Location */}
                      <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1 leading-tight">
                          {listing.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 line-clamp-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {[listing.address, listing.city, listing.country].filter(Boolean).join(", ") || "Namibia"}
                        </p>
                      </div>

                      {/* Description */}
                      {listing.description ? (
                        <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2 leading-relaxed flex-1">
                          {listing.description}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic flex-1">No description provided.</p>
                      )}

                      {/* Divider + Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-3 mt-auto border-t border-gray-100 dark:border-slate-800">
                        <button
                          onClick={() => {
                            setSelectedListingForReview(listing);
                            setReviewForm({ rating: 5, title: "", body: "" });
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 py-2 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-950/20 dark:hover:text-amber-400 transition"
                        >
                          <Star size={13} className="text-amber-500" /> Leave Review
                        </button>
                        <button
                          onClick={() => {
                            setSelectedListingForInquiry(listing);
                            setInquiryForm({ question_id: "", message: "", phone: "" });
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs"
                        >
                          <Send size={12} /> Send Inquiry
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ROOM BOOKINGS (HOTEL & LODGE RESERVATIONS)                         */}
      {/* ========================================================================= */}
      {activeTab === "bookings" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BedDouble size={18} className="text-purple-600" />
                My Room Bookings &amp; Reservation Chats
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Hotel, motel, and safari lodge stays. Chat directly with reception for arrival times or special requests.
              </p>
            </div>
          </div>

          {roomBookings.length === 0 ? (
            <div className="p-16 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
              <BedDouble size={40} className="mx-auto mb-2 opacity-30 text-purple-500" />
              You have no active room reservations. Check out our verified lodge listings!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {roomBookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-base text-gray-900 dark:text-white">
                        {b.propertyName || "Hospitality Suite"}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        {b.bookingStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400 mt-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Check-In</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{b.checkInDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Check-Out</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{b.checkOutDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Room #</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{b.roomNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Total Cost</p>
                        <p className="font-bold text-purple-600 dark:text-purple-400">
                          NAD {b.totalAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end">
                    <button
                      onClick={() => handleOpenBookingChat(b)}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition shadow-xs"
                    >
                      <MessageSquare size={13} /> Chat in this Booking
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPPORT INQUIRIES & PAST TICKETS                                  */}
      {/* ========================================================================= */}
      {activeTab === "enquiries" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" />
                My Inquiries &amp; Support Threads
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                All your submitted questions, inquiries, and customer care discussions.
              </p>
            </div>
            <button
              onClick={() => session?.user?.email && loadEnquiries(session.user.email)}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {enquiries.length === 0 ? (
            <div className="p-16 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
              <MessageSquare size={40} className="mx-auto mb-2 opacity-30 text-blue-500" />
              You have no active inquiries. View public listings above to inquire on any property!
            </div>
          ) : (
            <div className="space-y-3">
              {enquiries.map((e) => {
                const isExpanded = !!expandedEnquiries[e.id];
                const messages = messagesByEnquiry[e.id] || [];

                return (
                  <div
                    key={e.id}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                  >
                    <div
                      onClick={() => {
                        const next = !expandedEnquiries[e.id];
                        setExpandedEnquiries((prev) => ({ ...prev, [e.id]: next }));
                        if (next && !messagesByEnquiry[e.id]) {
                          void loadMessagesForEnquiries([e.id]);
                        }
                      }}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              STATUS_COLORS[e.status] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {e.status}
                          </span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white capitalize">
                            {e.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-1">{e.message}</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{new Date(e.created_at).toLocaleDateString()}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-4">
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {messages.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No message logs recorded yet.</p>
                          ) : (
                            messages.map((m) => {
                              const isStaff = m.sender_type === "staff";
                              return (
                                <div
                                  key={m.id}
                                  className={`flex flex-col ${isStaff ? "items-start" : "items-end"} space-y-0.5`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                                      isStaff
                                        ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700"
                                        : "bg-blue-600 text-white"
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap">{m.body}</p>
                                  </div>
                                  <span className="text-[10px] text-gray-400 px-1">
                                    {isStaff ? `Responded by: ${m.sender_name}` : "You"} &bull;{" "}
                                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <input
                            type="text"
                            placeholder="Type a follow-up reply..."
                            value={replyText[e.id] || ""}
                            onChange={(ev) => setReplyText((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                            className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleSendReply(e)}
                            disabled={submittingReply[e.id] || !(replyText[e.id] || "").trim()}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Send size={12} />
                          </button>
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
      {/* MODAL: SUBMIT REVIEW ON SPECIFIC LISTING                                 */}
      {/* ========================================================================= */}
      {selectedListingForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-1.5">
                  <Star size={16} className="text-amber-500" />
                  Review {selectedListingForReview.name}
                </h3>
                <p className="text-[11px] text-gray-500">Share your public feedback on this listing</p>
              </div>
              <button onClick={() => setSelectedListingForReview(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {reviewSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle size={36} className="mx-auto text-emerald-500" />
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">{reviewSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitSpecificReview} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1.5">
                    Rating *
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                        className={`p-1 rounded-lg transition ${
                          star <= reviewForm.rating ? "text-amber-500" : "text-gray-300 dark:text-slate-600"
                        }`}
                      >
                        <Star size={24} fill={star <= reviewForm.rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                    <span className="ml-2 font-bold text-gray-700 dark:text-slate-300">
                      {reviewForm.rating} / 5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                    Review Headline (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Wonderful apartment, quiet neighborhood..."
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                    Your Review &amp; Comments *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe the unit condition, maintenance responsiveness, amenities..."
                    value={reviewForm.body}
                    onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedListingForReview(null)}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview || !reviewForm.body.trim()}
                    className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
                  >
                    {submittingReview ? "Submitting..." : "Publish Review"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SEND INQUIRY ON SPECIFIC PUBLIC POST                               */}
      {/* ========================================================================= */}
      {selectedListingForInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-1.5">
                  <Send size={16} className="text-indigo-600" />
                  Inquire on {selectedListingForInquiry.name}
                </h3>
                <p className="text-[11px] text-gray-500">Specific property post inquiry</p>
              </div>
              <button onClick={() => setSelectedListingForInquiry(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {inquirySuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle size={36} className="mx-auto text-emerald-500" />
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">{inquirySuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitSpecificInquiry} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                    Your Question / Message *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ask about availability dates, lease conditions, deposit details, or viewings..."
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +264 81 123 4567"
                    value={inquiryForm.phone}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedListingForInquiry(null)}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInquiry || !inquiryForm.message.trim()}
                    className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>{submittingInquiry ? "Sending..." : "Submit Inquiry"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ROOM BOOKING CHAT                                                  */}
      {/* ========================================================================= */}
      {activeBookingChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <BedDouble size={16} className="text-purple-600" />
                  Booking Chat &bull; {activeBookingChat.propertyName}
                </h3>
                <p className="text-[11px] text-gray-500">
                  Room: {activeBookingChat.roomNumber} &bull; {activeBookingChat.checkInDate} to {activeBookingChat.checkOutDate}
                </p>
              </div>
              <button onClick={() => setActiveBookingChat(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {bookingChatMessages.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-xs">No messages yet. Send a note to the front desk host.</p>
              ) : (
                bookingChatMessages.map((m) => {
                  const isStaff = m.sender_type === "staff";
                  return (
                    <div key={m.id} className={`flex flex-col ${isStaff ? "items-start" : "items-end"} space-y-0.5`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                          isStaff
                            ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                            : "bg-purple-600 text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">
                        {isStaff ? `Responded by: ${m.sender_name}` : "You"} &bull;{" "}
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendBookingChat} className="p-3 border-t border-gray-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Ask about arrival time, dietary requests, key pickup..."
                value={bookingChatText}
                onChange={(e) => setBookingChatText(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={sendingBookingChat || !bookingChatText.trim()}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 shadow-xs"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW CONTRACT TERMS                                               */}
      {/* ========================================================================= */}
      {selectedContractForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <FileSignature size={18} className="text-emerald-600" />
                  {selectedContractForPreview.title}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedContractForPreview.properties?.name || assignedProperty?.name} &bull; {selectedContractForPreview.start_date} to {selectedContractForPreview.end_date}
                </p>
              </div>
              <button onClick={() => setSelectedContractForPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Monthly Rental</p>
                  <p className="font-black text-sm text-gray-900 dark:text-white">
                    NAD {Number(selectedContractForPreview.monthly_rent || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Deposit Held</p>
                  <p className="font-black text-sm text-gray-900 dark:text-white">
                    NAD {Number(selectedContractForPreview.deposit_amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-xs uppercase tracking-wider text-gray-400">Lease Clauses &amp; Terms</h5>
                {(contractSectionsMap[selectedContractForPreview.id] || []).length === 0 ? (
                  <p className="text-gray-500 italic">Standard statutory tenancy terms and conditions apply.</p>
                ) : (
                  (contractSectionsMap[selectedContractForPreview.id] || []).map((sec, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                      <p className="font-bold text-gray-900 dark:text-white">{sec.title}</p>
                      <p className="text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedContractForPreview(null)}
                className="rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
