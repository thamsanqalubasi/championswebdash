import { useState, useEffect, useMemo, useRef } from "react";
import { ModulePage } from "@/components/module-page";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { isValidUuid } from "@/lib/data";
import { Modal } from "@/components/modal";
import { uploadFileToBucket } from "@/lib/storage";
import { StripePaymentModal } from "@/components/stripe-payment-modal";
import type { MarketingAd, MarketingBoostedListing, MarketingCampaign, BoostTier, MarketingAdPlacement } from "@/lib/types";
import {
  Megaphone,
  TrendingUp,
  Plus,
  Eye,
  MousePointerClick,
  Percent,
  Flame,
  Check,
  Building2,
  ExternalLink,
  MapPin,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  QrCode,
  Download,
  Calendar,
  Layers,
  Star,
  CheckCircle2,
  Sliders,
  Send,
  BedDouble,
  Tag,
  HelpCircle,
  X,
  Upload,
  Loader2,
  CreditCard,
  Image as FileImage,
} from "lucide-react";

export default function MarketingPage() {
  const { currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<"overview" | "ads" | "boost">("overview");

  // Data states
  const [ads, setAds] = useState<MarketingAd[]>([]);
  const [boostedListings, setBoostedListings] = useState<MarketingBoostedListing[]>([]);
  const [properties, setProperties] = useState<Array<any>>([]);
  const [roomShowcases, setRoomShowcases] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // New Ad Modal State
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [submittingAd, setSubmittingAd] = useState(false);
  const [adForm, setAdForm] = useState({
    title: "",
    subtitle: "",
    placement: "hero_banner" as MarketingAdPlacement,
    image_url: "",
    cta_text: "Explore Listing",
    link_url: "",
    target_property_id: "",
    badge_text: "Special Promotion",
    is_active: true,
  });

  // Boost Modal State (redesigned)
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [submittingBoost, setSubmittingBoost] = useState(false);
  const [boostSelectedIds, setBoostSelectedIds] = useState<string[]>([]);
  const [boostForm, setBoostForm] = useState({
    boost_tier: "featured" as BoostTier,
    badge_label: "Sponsored",
    budget: "",
    boost_start_date: new Date().toISOString().slice(0, 10),
    boost_end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });
  const [boostGeoGlobal, setBoostGeoGlobal] = useState(true);
  const [boostGeoCountries, setBoostGeoCountries] = useState<string[]>([]);
  const [boostGeoCities, setBoostGeoCities] = useState<string[]>([]);
  const [boostGeoCountryFilter, setBoostGeoCountryFilter] = useState("");
  const [boostGeoCityInput, setBoostGeoCityInput] = useState("");
  const [publishedListingsForBoost, setPublishedListingsForBoost] = useState<any[]>([]);

  // Stripe Boost Payment State
  const [stripePaymentOpen, setStripePaymentOpen] = useState(false);
  const [pendingBoostPayload, setPendingBoostPayload] = useState<any[] | null>(null);
  const [boostPaymentNotice, setBoostPaymentNotice] = useState<string | null>(null);

  const boostAmountUsd = useMemo(() => {
    if (boostForm.budget && Number(boostForm.budget) > 0 && boostForm.boost_start_date && boostForm.boost_end_date) {
      const days = Math.max(1, Math.ceil((new Date(boostForm.boost_end_date).getTime() - new Date(boostForm.boost_start_date).getTime()) / 86400000));
      const totalNad = Number(boostForm.budget) * days;
      // Convert NAD to USD (1 NAD ≈ 0.055 USD)
      return Math.max(0.50, Math.round(totalNad * 0.055 * 100) / 100);
    }
    const tierRates: Record<BoostTier, number> = {
      standard: 5.00,
      featured: 10.00,
      premium_sponsor: 20.00,
    };
    const rate = tierRates[boostForm.boost_tier] || 10.00;
    const count = Math.max(1, boostSelectedIds.length);
    return Math.max(0.50, Math.round(rate * count * 100) / 100);
  }, [boostForm.boost_tier, boostForm.budget, boostForm.boost_start_date, boostForm.boost_end_date, boostSelectedIds.length]);

  // Image Uploading State
  const [uploadingImage, setUploadingImage] = useState(false);
  const adImageInputRef = useRef<HTMLInputElement | null>(null);

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadFileToBucket("marketing-assets", "ad-banners", file);
      setAdForm((prev) => ({ ...prev, image_url: url }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload banner image");
    } finally {
      setUploadingImage(false);
      if (adImageInputRef.current) adImageInputRef.current.value = "";
    }
  };

  // Reload trigger
  const reload = () => setReloadKey((v) => v + 1);

  // Load Data
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      const compId = currentCompany?.id;
      if (!compId || !isValidUuid(compId)) {
        setLoading(false);
        return;
      }

      try {
        const [adsRes, boostRes, propsRes, roomsRes, pubPropsRes, agentRes] = await Promise.all([
          supabase.from("marketing_ads").select("*").eq("company_id", compId).order("created_at", { ascending: false }),
          supabase.from("marketing_boosted_listings").select("*").eq("company_id", compId).order("created_at", { ascending: false }),
          supabase.from("properties").select("id, name, type, address, city, country, status, monthly_rent, photos, available_from").eq("company_id", compId).order("name"),
          supabase.from("room_type_listings").select("id, property_id, display_name, property_name, type_key, price_room_only, price_bed_breakfast, price_full_board, photos, amenities, is_active, company_id").or(`company_id.eq.${compId},company_id.is.null`).eq("is_active", true).order("created_at", { ascending: false }),
          supabase.from("properties").select("id, name, type, address, city, country, monthly_rent, photos, is_published, company_id").or(`company_id.eq.${compId},company_id.is.null`).eq("is_published", true).order("name"),
          supabase.from("agent_listings").select("id, name, type, address, city, country, price, photos, is_published, company_id").or(`company_id.eq.${compId},company_id.is.null`).eq("is_published", true).order("created_at", { ascending: false }),
        ]);

        if (!cancelled) {
          if (adsRes.data) setAds(adsRes.data as MarketingAd[]);
          if (boostRes.data) setBoostedListings(boostRes.data as MarketingBoostedListing[]);

          // Unify all published posts (Showcase Posts, Properties, Agent Listings)
          const roomItems = (roomsRes.data || []).map((r: any) => ({
            id: r.id,
            listing_type: "room_type" as const,
            name: r.display_name || "Room Type Showcase",
            subtitle: r.property_name ? `At ${r.property_name}` : "Hospitality Suite",
            type: r.type_key || "room",
            categoryLabel: "Showcase Post",
            price: Number(r.price_room_only || r.price_bed_breakfast || r.price_full_board || 0),
            priceUnit: "/night",
            city: "",
            country: "",
            photos: Array.isArray(r.photos) ? r.photos : typeof r.photos === "string" ? (() => { try { return JSON.parse(r.photos); } catch { return []; } })() : [],
          }));

          const propItems = (pubPropsRes.data || []).map((p: any) => ({
            id: p.id,
            listing_type: "property" as const,
            name: p.name,
            subtitle: p.address ? `${p.address}, ${p.city || ""}` : p.city || "",
            type: p.type || "property",
            categoryLabel: "Rental Property",
            price: Number(p.monthly_rent || 0),
            priceUnit: "/mo",
            city: p.city || "",
            country: p.country || "",
            photos: Array.isArray(p.photos) ? p.photos : typeof p.photos === "string" ? (() => { try { return JSON.parse(p.photos); } catch { return []; } })() : [],
          }));

          const agentItems = (agentRes.data || []).map((a: any) => ({
            id: a.id,
            listing_type: "agent_listing" as const,
            name: a.name,
            subtitle: a.address || a.city || "Agent Listing",
            type: a.type || "property",
            categoryLabel: "Agent Listing",
            price: Number(a.price || 0),
            priceUnit: "/mo",
            city: a.city || "",
            country: a.country || "",
            photos: Array.isArray(a.photos) ? a.photos : typeof a.photos === "string" ? (() => { try { return JSON.parse(a.photos); } catch { return []; } })() : [],
          }));

          setPublishedListingsForBoost([...roomItems, ...propItems, ...agentItems]);

          if (propsRes.data) {
            setProperties(propsRes.data);
          }
          if (roomsRes.data) setRoomShowcases(roomsRes.data);
        }
      } catch (err) {
        console.warn("Could not load marketing data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id, reloadKey]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalImpressions = ads.reduce((sum, a) => sum + (a.impressions_count || 0), 0) +
      boostedListings.reduce((sum, b) => sum + (b.impressions_count || 0), 0);
    const totalClicks = ads.reduce((sum, a) => sum + (a.clicks_count || 0), 0) +
      boostedListings.reduce((sum, b) => sum + (b.clicks_count || 0), 0);
    const activeAdsCount = ads.filter((a) => a.is_active).length;
    const activeBoostedCount = boostedListings.filter((b) => b.is_active).length;
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0.0";

    return {
      totalImpressions,
      totalClicks,
      activeAdsCount,
      activeBoostedCount,
      ctr,
    };
  }, [ads, boostedListings]);

  // Handlers for Ad
  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adForm.title.trim()) {
      alert("Please provide an ad title.");
      return;
    }
    setSubmittingAd(true);
    try {
      const payload: any = {
        company_id: currentCompany.id,
        title: adForm.title.trim(),
        subtitle: adForm.subtitle?.trim() || null,
        placement: adForm.placement,
        image_url: adForm.image_url || null,
        cta_text: adForm.cta_text || "Explore Listing",
        link_url: adForm.link_url || (adForm.target_property_id ? `/listing/${adForm.target_property_id}` : "/"),
        target_property_id: adForm.target_property_id || null,
        badge_text: adForm.badge_text || "Featured Offer",
        is_active: adForm.is_active,
      };

      const { error } = await supabase.from("marketing_ads").insert(payload);
      if (error) throw error;

      setAdModalOpen(false);
      setAdForm({
        title: "",
        subtitle: "",
        placement: "hero_banner",
        image_url: "",
        cta_text: "Explore Listing",
        link_url: "",
        target_property_id: "",
        badge_text: "Special Promotion",
        is_active: true,
      });
      reload();
    } catch (err: any) {
      alert(err?.message || "Failed to create ad.");
    } finally {
      setSubmittingAd(false);
    }
  };

  const handleToggleAd = async (ad: MarketingAd) => {
    try {
      const nextActive = !ad.is_active;
      await supabase.from("marketing_ads").update({ is_active: nextActive }).eq("id", ad.id);
      setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, is_active: nextActive } : a)));
    } catch (err: any) {
      alert(err?.message || "Failed to toggle ad status.");
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!confirm("Are you sure you want to delete this marketing ad?")) return;
    try {
      await supabase.from("marketing_ads").delete().eq("id", id);
      setAds((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err?.message || "Failed to delete ad.");
    }
  };

  // Handlers for Boost (Stripe Card & Digital Checkout Gateway)
  const handleSaveBoost = (e: React.FormEvent) => {
    e.preventDefault();
    if (boostSelectedIds.length === 0) {
      alert("Please select at least one published listing to boost.");
      return;
    }
    const geoPayload = {
      global: boostGeoGlobal,
      countries: boostGeoGlobal ? [] : boostGeoCountries,
      cities: boostGeoGlobal ? [] : boostGeoCities,
    };

    const rows = boostSelectedIds.map((lid) => {
      const selectedItem = publishedListingsForBoost.find((p) => p.id === lid);
      return {
        company_id: currentCompany.id,
        listing_type: (selectedItem?.listing_type || "property") as "property" | "room_type" | "agent_listing",
        listing_id: lid,
        boost_tier: boostForm.boost_tier,
        badge_label: boostForm.badge_label || "Sponsored",
        priority_score: boostForm.boost_tier === "premium_sponsor" ? 30 : boostForm.boost_tier === "featured" ? 20 : 10,
        starts_at: boostForm.boost_start_date ? new Date(boostForm.boost_start_date).toISOString() : new Date().toISOString(),
        expires_at: boostForm.boost_end_date ? new Date(boostForm.boost_end_date).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString(),
        is_active: true,
        target_geo: geoPayload,
        budget: boostForm.budget ? Number(boostForm.budget) : 0,
        boost_start_date: boostForm.boost_start_date || null,
        boost_end_date: boostForm.boost_end_date || null,
      };
    });

    setPendingBoostPayload(rows);
    setBoostModalOpen(false);
    setStripePaymentOpen(true);
  };

  const handleBoostPaymentSuccess = async () => {
    if (!pendingBoostPayload || pendingBoostPayload.length === 0) return;
    setSubmittingBoost(true);
    try {
      const { error } = await supabase.from("marketing_boosted_listings").insert(pendingBoostPayload);
      if (error) {
        if (error.message?.includes("row-level security")) {
          alert("Database Row-Level Security Notice:\nPlease execute the SQL migration in 'docs/fix-all-rls-and-pop.sql' in your Supabase SQL Editor to enable public & staff permissions on marketing_boosted_listings.");
        }
        throw error;
      }

      setPendingBoostPayload(null);
      setStripePaymentOpen(false);
      setBoostSelectedIds([]);
      setBoostGeoGlobal(true);
      setBoostGeoCountries([]);
      setBoostGeoCities([]);
      setBoostForm(prev => ({
        ...prev,
        budget: "",
        boost_start_date: new Date().toISOString().slice(0, 10),
        boost_end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      }));
      setBoostPaymentNotice(`Boost payment of $${boostAmountUsd.toFixed(2)} USD received successfully! Your boosted listings are now live on the front portal.`);
      setTimeout(() => setBoostPaymentNotice(null), 8000);
      reload();
    } catch (err: any) {
      if (!err?.message?.includes("row-level security")) {
        alert(err?.message || "Failed to activate boosted listing.");
      }
    } finally {
      setSubmittingBoost(false);
    }
  };

  const handleToggleBoost = async (boost: MarketingBoostedListing) => {
    try {
      const nextActive = !boost.is_active;
      await supabase.from("marketing_boosted_listings").update({ is_active: nextActive }).eq("id", boost.id);
      setBoostedListings((prev) => prev.map((b) => (b.id === boost.id ? { ...b, is_active: nextActive } : b)));
    } catch (err: any) {
      alert(err?.message || "Failed to toggle boost.");
    }
  };

  const handleDeleteBoost = async (id: string) => {
    if (!confirm("Remove this listing boost?")) return;
    try {
      await supabase.from("marketing_boosted_listings").delete().eq("id", id);
      setBoostedListings((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(err?.message || "Failed to delete boost.");
    }
  };

  return (
    <ModulePage
      title="Marketing & Growth Department"
      description="Campaign management, front portal banner ads, featured listing boosting, and advertising performance analytics."
    >
      <div className="space-y-6">
        {/* KPI Performance Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Active Portal Ads</span>
              <Megaphone size={16} className="text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">{metrics.activeAdsCount}</p>
            <p className="text-[11px] text-muted mt-1">{ads.length} total banner assets</p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Boosted Listings</span>
              <Flame size={16} className="text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-500">{metrics.activeBoostedCount}</p>
            <p className="text-[11px] text-muted mt-1">Priority on front portal</p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Ad Impressions</span>
              <Eye size={16} className="text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">{metrics.totalImpressions.toLocaleString()}</p>
            <p className="text-[11px] text-muted mt-1">Portal views generated</p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Total Clicks</span>
              <MousePointerClick size={16} className="text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-500">{metrics.totalClicks.toLocaleString()}</p>
            <p className="text-[11px] text-muted mt-1">Direct listing click-throughs</p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Average CTR</span>
              <Percent size={16} className="text-purple-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-purple-500">{metrics.ctr}%</p>
            <p className="text-[11px] text-muted mt-1">Visitor engagement rate</p>
          </div>
        </div>

        {boostPaymentNotice && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-600 flex items-center justify-between">
            <span>{boostPaymentNotice}</span>
            <button onClick={() => setBoostPaymentNotice(null)} className="text-emerald-700 font-bold hover:underline">Dismiss</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "overview", label: "Overview & Analytics", icon: TrendingUp },
              { id: "ads", label: "Ads", icon: Megaphone, count: ads.length },
              { id: "boost", label: "Boost Listings", icon: Flame, count: boostedListings.length },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-surface text-muted hover:bg-surface-elevated hover:text-foreground border border-border-color"
                  }`}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                  {t.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isActive ? "bg-white/20 text-white" : "bg-surface-elevated text-muted"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={reload}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            {activeTab === "ads" && (
              <button
                onClick={() => setAdModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition"
              >
                <Plus size={14} /> Create Portal Ad
              </button>
            )}
            {activeTab === "boost" && (
              <button
                onClick={() => setBoostModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shadow-xs transition"
              >
                <Flame size={14} /> Boost a Listing
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-xs">
              <h3 className="font-bold text-foreground text-base mb-1 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                Portal Advertising &amp; Conversion Performance
              </h3>
              <p className="text-xs text-muted mb-4">
                Real-time tracking of visitor traffic, impressions, and click conversions on <a href="https://paimbabook.com" target="_blank" rel="noreferrer" className="text-blue-500 underline">paimbabook.com</a>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase text-muted">Hero Carousel Ads</span>
                  <p className="text-xl font-black text-foreground">
                    {ads.filter((a) => a.placement === "hero_banner").length} Active
                  </p>
                  <p className="text-xs text-muted">Primary visual banner at the top of the homepage</p>
                </div>
                <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase text-muted">Announcement Ticker</span>
                  <p className="text-xl font-black text-foreground">
                    {ads.filter((a) => a.placement === "ticker").length} Active
                  </p>
                  <p className="text-xs text-muted">Urgent alerts and promotional ticker across listings</p>
                </div>
                <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase text-muted">In-Feed Native Ads</span>
                  <p className="text-xl font-black text-foreground">
                    {ads.filter((a) => a.placement === "in_feed").length} Active
                  </p>
                  <p className="text-xs text-muted">Native cards blended between property listings</p>
                </div>
              </div>

              {/* Table of performance per asset */}
              <h4 className="text-sm font-bold text-foreground mb-3">Live Ad &amp; Boost Campaign Assets</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-color bg-surface-elevated text-muted">
                    <tr>
                      <th className="py-2.5 px-3">Asset Title</th>
                      <th className="py-2.5 px-3">Type / Placement</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Impressions</th>
                      <th className="py-2.5 px-3">Clicks</th>
                      <th className="py-2.5 px-3">CTR</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {ads.length === 0 && boostedListings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted italic">
                          No advertising assets created yet. Create a portal ad or boost a listing to begin tracking performance.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {ads.map((a) => {
                          const adCtr = a.impressions_count > 0 ? ((a.clicks_count / a.impressions_count) * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={a.id} className="hover:bg-surface-elevated/30">
                              <td className="py-3 px-3 font-semibold text-foreground">{a.title}</td>
                              <td className="py-3 px-3 capitalize text-muted">{a.placement.replace(/_/g, " ")}</td>
                              <td className="py-3 px-3">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${a.is_active ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-400"}`}>
                                  {a.is_active ? "Live on Portal" : "Paused"}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono">{a.impressions_count || 0}</td>
                              <td className="py-3 px-3 font-mono">{a.clicks_count || 0}</td>
                              <td className="py-3 px-3 font-bold text-purple-500">{adCtr}%</td>
                              <td className="py-3 px-3 text-right">
                                <button onClick={() => handleToggleAd(a)} className="text-xs font-semibold text-blue-500 hover:underline mr-2">
                                  {a.is_active ? "Pause" : "Resume"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {boostedListings.map((b) => {
                          const matchedProp = properties.find((p) => p.id === b.listing_id);
                          return (
                            <tr key={b.id} className="hover:bg-surface-elevated/30">
                              <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-1.5">
                                <Flame size={13} className="text-amber-500" />
                                <span>{matchedProp?.name || "Boosted Item"}</span>
                              </td>
                              <td className="py-3 px-3 capitalize text-muted">Boosted Listing ({b.boost_tier})</td>
                              <td className="py-3 px-3">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${b.is_active ? "bg-amber-500/10 text-amber-500" : "bg-gray-500/10 text-gray-400"}`}>
                                  {b.is_active ? "Priority Boosted" : "Inactive"}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono">{b.impressions_count || 0}</td>
                              <td className="py-3 px-3 font-mono">{b.clicks_count || 0}</td>
                              <td className="py-3 px-3 font-bold text-amber-500">
                                {b.impressions_count > 0 ? ((b.clicks_count / b.impressions_count) * 100).toFixed(1) : "0.0"}%
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button onClick={() => handleToggleBoost(b)} className="text-xs font-semibold text-amber-500 hover:underline">
                                  {b.is_active ? "Deactivate" : "Activate"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PORTAL ADS MANAGEMENT */}
        {activeTab === "ads" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-base">Front Portal Banner Advertisements</h3>
                <p className="text-xs text-muted">Manage promotions, announcement tickers, and banners displayed to public visitors.</p>
              </div>
              <button onClick={() => setAdModalOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition">
                <Plus size={14} /> New Ad Submission
              </button>
            </div>

            {ads.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-border-color bg-surface/50 p-8 text-muted">
                <Megaphone size={40} className="mx-auto mb-2 opacity-30 text-blue-500" />
                <p className="font-semibold text-foreground">No banner ads active</p>
                <p className="text-xs mt-1">Submit your first promotion banner to be shown on the front index portal.</p>
                <button onClick={() => setAdModalOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs">
                  <Plus size={14} /> Create Advertisement
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ads.map((ad) => (
                  <div key={ad.id} className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-xs flex flex-col justify-between">
                    <div>
                      {ad.image_url ? (
                        <div className="relative aspect-video w-full overflow-hidden bg-surface-elevated">
                          <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
                          <span className="absolute top-2 left-2 rounded-lg bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                            {ad.placement.replace(/_/g, " ")}
                          </span>
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex flex-col items-center justify-center p-4 text-center">
                          <Megaphone size={28} className="text-blue-500 mb-1" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{ad.placement.replace(/_/g, " ")}</span>
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-foreground text-sm leading-tight">{ad.title}</h4>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${ad.is_active ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-400"}`}>
                            {ad.is_active ? "Active" : "Paused"}
                          </span>
                        </div>
                        {ad.subtitle && <p className="text-xs text-muted leading-relaxed line-clamp-2">{ad.subtitle}</p>}

                        <div className="flex items-center gap-4 text-xs font-mono pt-1 text-muted border-t border-border-color">
                          <span>{ad.impressions_count || 0} views</span>
                          <span>{ad.clicks_count || 0} clicks</span>
                          <span className="text-purple-500 font-bold">
                            {ad.impressions_count > 0 ? ((ad.clicks_count / ad.impressions_count) * 100).toFixed(1) : "0"}% CTR
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t border-border-color bg-surface-elevated/30 flex items-center justify-between">
                      <button onClick={() => handleToggleAd(ad)} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground">
                        {ad.is_active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-gray-400" />}
                        <span>{ad.is_active ? "Active" : "Paused"}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {ad.link_url && (
                          <a href={ad.link_url} target="_blank" rel="noreferrer" className="p-1.5 text-muted hover:text-blue-500" title="Open Link">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => handleDeleteAd(ad.id)} className="p-1.5 text-muted hover:text-red-500" title="Delete Ad">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BOOST LISTINGS */}
        {activeTab === "boost" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <Flame size={18} className="text-amber-500" />
                  Boost Showcased &amp; Agent Published Content
                </h3>
                <p className="text-xs text-muted">
                  Boosted properties rank with top priority on the public portal and feature high-visibility badges and golden highlight borders.
                </p>
              </div>
              <button onClick={() => setBoostModalOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs transition">
                <Flame size={14} /> Boost a Listing
              </button>
            </div>

            {boostedListings.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-border-color bg-surface/50 p-8 text-muted">
                <Flame size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
                <p className="font-semibold text-foreground">No listings boosted currently</p>
                <p className="text-xs mt-1">Elevate any of your rental properties or hotel rooms to the very top of search results.</p>
                <button onClick={() => setBoostModalOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs">
                  <Flame size={14} /> Select Listing to Boost
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {boostedListings.map((b) => {
                  const matchedProp = properties.find((p) => p.id === b.listing_id);
                  const daysLeft = b.expires_at ? Math.max(0, Math.ceil((new Date(b.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
                  return (
                    <div key={b.id} className="rounded-2xl border-2 border-amber-500/40 bg-surface p-4 shadow-sm space-y-3 relative overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500 text-white font-black text-[11px] uppercase tracking-wider mb-1 shadow-xs">
                            {b.badge_label || "Featured"}
                          </span>
                          <h4 className="font-bold text-foreground text-sm mt-1">{matchedProp?.name || "Target Listing"}</h4>
                          <p className="text-xs text-muted">{matchedProp?.address || matchedProp?.city || "Property Location"}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.is_active ? "bg-amber-500/10 text-amber-500" : "bg-gray-500/10 text-gray-400"}`}>
                          {b.is_active ? "Active Boost" : "Paused"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-surface-elevated/40 p-2.5 rounded-xl text-center text-xs">
                        <div>
                          <span className="text-[10px] text-muted block uppercase">Tier</span>
                          <span className="font-bold capitalize">{b.boost_tier}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted block uppercase">Days Left</span>
                          <span className="font-bold text-amber-500">{daysLeft} days</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted block uppercase">Priority</span>
                          <span className="font-bold">+{b.priority_score}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border-color">
                        <button onClick={() => handleToggleBoost(b)} className="text-xs font-semibold text-amber-600 hover:underline">
                          {b.is_active ? "Pause Boost" : "Resume Boost"}
                        </button>
                        <button onClick={() => handleDeleteBoost(b.id)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL: SUBMIT NEW PORTAL AD */}
      <Modal open={adModalOpen} onClose={() => setAdModalOpen(false)} title="Create Front Portal Advertisement">
        <form onSubmit={handleSaveAd} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Ad Headline / Title *</label>
            <input
              required
              placeholder="e.g. Winter Holiday Special - Save 15% on Luxury Stays"
              value={adForm.title}
              onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Subtitle / Description</label>
            <textarea
              rows={2}
              placeholder="e.g. Book 3 nights or more this season and enjoy complimentary breakfast and late checkout."
              value={adForm.subtitle || ""}
              onChange={(e) => setAdForm({ ...adForm, subtitle: e.target.value })}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Ad Placement *</label>
              <select
                value={adForm.placement}
                onChange={(e) => setAdForm({ ...adForm, placement: e.target.value as any })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
              >
                <option value="hero_banner">Hero Visual Carousel Banner</option>
                <option value="ticker">Top Announcement Ticker</option>
                <option value="in_feed">Native In-Feed Sponsored Card</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Badge Label</label>
              <input
                placeholder="e.g. Limited Offer"
                value={adForm.badge_text || ""}
                onChange={(e) => setAdForm({ ...adForm, badge_text: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
              />
            </div>
          </div>

          {/* Banner Image Graphic Upload & Preview */}
          <div className="space-y-2 rounded-xl border border-border-color bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileImage size={14} className="text-purple-600" />
                <span>Banner Graphic / Visual Creative</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={adImageInputRef}
                  onChange={handleAdImageUpload}
                  accept="image/*"
                  className="hidden"
                  id="ad-banner-file-upload"
                />
                <label
                  htmlFor="ad-banner-file-upload"
                  className={`inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-surface border border-border-color px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated transition ${
                    uploadingImage ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  <span>{uploadingImage ? "Uploading..." : "Upload File"}</span>
                </label>
              </div>
            </div>

            <div>
              <input
                placeholder="Or paste direct image link (https://...)"
                value={adForm.image_url || ""}
                onChange={(e) => setAdForm({ ...adForm, image_url: e.target.value })}
                className="w-full rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-purple-500"
              />
            </div>

            {/* Live Preview */}
            {adForm.image_url ? (
              <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden border border-border-color bg-black/20 group">
                <img
                  src={adForm.image_url}
                  alt="Ad Preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 text-white">
                  <span className="rounded-md bg-purple-600 px-2 py-0.5 text-[9px] font-bold w-fit uppercase mb-1">
                    {adForm.badge_text || "Featured"}
                  </span>
                  <p className="text-sm font-bold truncate">{adForm.title || "Headline preview"}</p>
                  <p className="text-[11px] text-white/80 truncate">{adForm.subtitle || "Subtitle preview"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdForm({ ...adForm, image_url: "" })}
                  className="absolute top-2 right-2 rounded-md bg-black/70 p-1 text-white hover:bg-red-600 transition"
                  title="Remove image"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border-color py-4 text-center text-xs text-muted">
                No image uploaded yet. Click <b>Upload File</b> or paste a URL above to preview your ad banner.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Link Target Property</label>
              <select
                value={adForm.target_property_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  setAdForm({
                    ...adForm,
                    target_property_id: pid,
                    link_url: pid ? `/listing/${pid}` : adForm.link_url,
                  });
                }}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
              >
                <option value="">-- Custom Link or General --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Call to Action (CTA)</label>
              <input
                placeholder="e.g. Book Now"
                value={adForm.cta_text}
                onChange={(e) => setAdForm({ ...adForm, cta_text: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-color">
            <button
              type="button"
              onClick={() => setAdModalOpen(false)}
              className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAd}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
            >
              <Plus size={14} />
              {submittingAd ? "Publishing..." : "Publish to Portal"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: BOOST A LISTING (Redesigned - Visual Picker + Geo Targeting) */}
      <Modal open={boostModalOpen} onClose={() => setBoostModalOpen(false)} title="Boost Published Listings">
        <form onSubmit={handleSaveBoost} className="space-y-5">
          {/* Step 1: Visual listing picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase text-muted tracking-wide">Select Listings to Boost *</label>
              {boostSelectedIds.length > 0 && (
                <span className="text-xs font-bold text-amber-600">{boostSelectedIds.length} selected</span>
              )}
            </div>
            {publishedListingsForBoost.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-color p-6 text-center text-xs text-muted">
                No published listings found. Publish a room showcase or property first to boost it.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollSnapType: "x mandatory" }}>
                {publishedListingsForBoost.map((p) => {
                  const isSelected = boostSelectedIds.includes(p.id);
                  const photos = Array.isArray(p.photos) ? p.photos : (typeof p.photos === "string" ? (() => { try { return JSON.parse(p.photos); } catch { return []; } })() : []);
                  const thumb = photos[0] || null;
                  const price = Number(p.price || 0);
                  return (
                    <button
                      key={`${p.listing_type}-${p.id}`}
                      type="button"
                      onClick={() => setBoostSelectedIds(prev =>
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      )}
                      className={`relative flex-none w-56 rounded-2xl overflow-hidden text-left transition-all focus:outline-none shrink-0 ${
                        isSelected
                          ? "ring-2 ring-amber-500 shadow-xl scale-[1.02]"
                          : "ring-1 ring-border-color hover:ring-amber-400/60 hover:shadow-md"
                      }`}
                      style={{ scrollSnapAlign: "start" }}
                    >
                      {/* Full image card */}
                      <div className="relative h-44 w-full bg-gradient-to-br from-amber-500/20 to-orange-600/20">
                        {/* Fallback always rendered behind */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Flame size={36} className="text-amber-500 opacity-40" />
                        </div>
                        {thumb && (
                          <img
                            src={thumb}
                            alt={p.name}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).remove();
                            }}
                          />
                        )}
                        {/* Dark gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                        
                        {/* Type & Category badge top-left */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                          <span className="rounded-md bg-amber-500 text-black font-black px-1.5 py-0.5 text-[8px] uppercase tracking-wider shadow-sm">
                            {p.categoryLabel || "Published Post"}
                          </span>
                          <span className="rounded-md bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wide">
                            {p.type?.replace(/_/g, " ") || "Property"}
                          </span>
                        </div>

                        {/* Selection tick */}
                        <div className={`absolute top-2 right-2 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? "border-amber-400 bg-amber-500" : "border-white/70 bg-black/40"
                        }`}>
                          {isSelected && <Check size={13} className="text-white" />}
                        </div>

                        {/* Name + price at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-white font-bold text-xs truncate leading-tight">{p.name}</p>
                          {p.subtitle && (
                            <p className="text-white/70 text-[10px] truncate mt-0.5">{p.subtitle}</p>
                          )}
                          {(p.city || p.country) && (
                            <p className="text-white/60 text-[9px] truncate mt-0.5">{p.city || p.country}</p>
                          )}
                          {price > 0 && (
                            <p className="text-amber-300 font-black text-xs mt-1">
                              NAD {price.toLocaleString()}<span className="text-white/60 font-normal text-[10px]">{p.priceUnit || "/mo"}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Sponsored label at bottom of card */}
                      {isSelected && (
                        <div className="bg-amber-500 px-3 py-1 text-center">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Sponsored</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Boost Tier */}
          <div>
            <label className="text-xs font-semibold text-muted mb-2 block">Boost Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "standard", label: "Standard", rank: "+10", color: "blue" },
                { value: "featured", label: "Featured", rank: "+20", color: "amber" },
                { value: "premium_sponsor", label: "Premium", rank: "+30", color: "purple" },
              ].map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  onClick={() => setBoostForm({ ...boostForm, boost_tier: tier.value as any })}
                  className={`rounded-xl border-2 p-2.5 text-center transition-all ${
                    boostForm.boost_tier === tier.value
                      ? tier.color === "amber"
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : tier.color === "purple"
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        : "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-border-color bg-surface text-muted hover:border-amber-400/50"
                  }`}
                >
                  <p className="text-xs font-black">{tier.label}</p>
                  <p className="text-[10px] font-semibold opacity-70">{tier.rank} Ranking</p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Facebook-style Budget */}
          <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-emerald-500" />
              <span className="text-xs font-bold uppercase text-muted tracking-wide">Daily Budget</span>
            </div>
            {/* Preset chips */}
            <div className="flex flex-wrap gap-2">
              {[50, 100, 200, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBoostForm({ ...boostForm, budget: String(preset) })}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                    boostForm.budget === String(preset)
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : "border-border-color bg-surface text-muted hover:border-emerald-500 hover:text-emerald-600"
                  }`}
                >
                  NAD {preset.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setBoostForm({ ...boostForm, budget: "" })}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                  !["50", "100", "200", "500", "1000"].includes(boostForm.budget) && boostForm.budget !== ""
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                    : "border-border-color bg-surface text-muted hover:border-emerald-500 hover:text-emerald-600"
                }`}
              >
                Custom
              </button>
            </div>
            {/* Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="10"
                max="5000"
                step="10"
                value={Number(boostForm.budget) || 100}
                onChange={(e) => setBoostForm({ ...boostForm, budget: e.target.value })}
                className="w-full h-2 rounded-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>NAD 10</span>
                <span>NAD 5,000</span>
              </div>
            </div>
            {/* Custom input + total summary */}
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-border-color bg-surface px-3 py-2">
                <span className="text-xs font-semibold text-muted">NAD</span>
                <input
                  type="number"
                  min="10"
                  max="99999"
                  placeholder="Custom amount"
                  value={boostForm.budget}
                  onChange={(e) => setBoostForm({ ...boostForm, budget: e.target.value })}
                  className="flex-1 bg-transparent text-xs font-bold text-foreground outline-none"
                />
                <span className="text-[10px] text-muted font-semibold">/day</span>
              </div>
              {boostForm.budget && boostForm.boost_start_date && boostForm.boost_end_date && (() => {
                const days = Math.max(1, Math.ceil((new Date(boostForm.boost_end_date).getTime() - new Date(boostForm.boost_start_date).getTime()) / 86400000));
                const total = Number(boostForm.budget) * days;
                return (
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted">Est. Total</p>
                    <p className="text-sm font-black text-emerald-600">NAD {total.toLocaleString()}</p>
                    <p className="text-[9px] text-muted">{days} day{days !== 1 ? "s" : ""}</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Step 4: Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Start Date</label>
              <input
                type="date"
                value={boostForm.boost_start_date}
                onChange={(e) => setBoostForm({ ...boostForm, boost_start_date: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">End Date</label>
              <input
                type="date"
                value={boostForm.boost_end_date}
                onChange={(e) => setBoostForm({ ...boostForm, boost_end_date: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Sponsored Label</label>
            <div className="flex flex-wrap gap-2">
              {["Sponsored", "Hot Deal", "Top Pick", "Quick Move-In", "Special Offer"].map(badge => (
                <button
                  key={badge}
                  type="button"
                  onClick={() => setBoostForm({ ...boostForm, badge_label: badge })}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                    boostForm.badge_label === badge
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "border-border-color bg-surface text-muted hover:border-amber-500 hover:text-amber-600"
                  }`}
                >
                  {badge}
                </button>
              ))}
            </div>
            <input
              placeholder="Or type custom label..."
              value={boostForm.badge_label}
              onChange={(e) => setBoostForm({ ...boostForm, badge_label: e.target.value })}
              className="mt-2 w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
            />
          </div>

          {/* Step 5: Geo Targeting */}
          <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-blue-500" />
              <span className="text-xs font-bold uppercase text-muted tracking-wide">Geo Targeting</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={boostGeoGlobal}
                onChange={(e) => setBoostGeoGlobal(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-semibold text-foreground">Target Globally (All Countries & Cities)</span>
            </label>
            {!boostGeoGlobal && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Target Countries (select multiple)</label>
                  <input
                    placeholder="Filter countries..."
                    value={boostGeoCountryFilter}
                    onChange={(e) => setBoostGeoCountryFilter(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none mb-1.5"
                  />
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border-color bg-surface divide-y divide-border-color/40">
                    {[
                      "Namibia","South Africa","Botswana","Zimbabwe","Zambia","Angola","Mozambique",
                      "Tanzania","Kenya","Uganda","Nigeria","Ghana","Ethiopia","Egypt","Morocco",
                      "United Kingdom","United States","Germany","France","Australia","Canada","India","China","Brazil"
                    ].filter(c => !boostGeoCountryFilter || c.toLowerCase().includes(boostGeoCountryFilter.toLowerCase()))
                    .map(country => (
                      <label key={country} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-elevated">
                        <input
                          type="checkbox"
                          checked={boostGeoCountries.includes(country)}
                          onChange={(e) => setBoostGeoCountries(prev =>
                            e.target.checked ? [...prev, country] : prev.filter(c => c !== country)
                          )}
                          className="rounded"
                        />
                        <span className="text-xs">{country}</span>
                      </label>
                    ))}
                  </div>
                  {boostGeoCountries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {boostGeoCountries.map(c => (
                        <span key={c} className="flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 px-2 py-0.5 text-[10px] font-bold">
                          {c}
                          <button type="button" onClick={() => setBoostGeoCountries(prev => prev.filter(x => x !== c))} className="hover:text-red-500"><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Target Cities</label>
                  <select
                    value=""
                    onChange={(e) => {
                      const city = e.target.value;
                      if (city && !boostGeoCities.includes(city)) {
                        setBoostGeoCities(prev => [...prev, city]);
                      }
                    }}
                    className="w-full rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none mb-1.5"
                  >
                    <option value="">- Select a city to add -</option>
                    {[
                      "Windhoek","Swakopmund","Walvis Bay","Lüderitz","Oshakati","Rundu","Katima Mulilo",
                      "Cape Town","Johannesburg","Durban","Pretoria","Port Elizabeth",
                      "Gaborone","Harare","Lusaka","Luanda","Maputo",
                      "Nairobi","Lagos","Accra","Dar es Salaam","Kampala","Addis Ababa",
                      "London","New York","Dubai","Sydney","Toronto"
                    ].filter(c => !boostGeoCities.includes(c)).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  {boostGeoCities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {boostGeoCities.map(c => (
                        <span key={c} className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                          {c}
                          <button type="button" onClick={() => setBoostGeoCities(prev => prev.filter(x => x !== c))} className="hover:text-red-500"><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border-color">
            <div>
              <span className="text-xs text-muted block">
                {boostSelectedIds.length} listing{boostSelectedIds.length !== 1 ? "s" : ""} selected
              </span>
              <span className="text-xs font-black text-emerald-600">
                Total: ${boostAmountUsd.toFixed(2)} USD
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setBoostModalOpen(false); setBoostSelectedIds([]); }}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingBoost || boostSelectedIds.length === 0}
                className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
              >
                <CreditCard size={14} />
                <span>Pay ${boostAmountUsd.toFixed(2)} USD &amp; Boost</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* STRIPE PAYMENT MODAL FOR AD BOOSTING */}
      <StripePaymentModal
        open={stripePaymentOpen}
        onClose={() => setStripePaymentOpen(false)}
        companyId={currentCompany.id}
        amountUsd={boostAmountUsd}
        packageTitle={`Listing Boost (${boostForm.boost_tier.toUpperCase()})`}
        isSubscriptionPayment={false}
        onSuccess={handleBoostPaymentSuccess}
      />
    </ModulePage>
  );
}
