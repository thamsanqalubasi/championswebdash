import { useState, useEffect, useMemo, useRef } from "react";
import { ModulePage } from "@/components/module-page";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { isValidUuid } from "@/lib/data";
import { Modal } from "@/components/modal";
import { uploadFileToBucket } from "@/lib/storage";
import type { MarketingAd, MarketingBoostedListing, MarketingCampaign, BoostTier, MarketingAdPlacement } from "@/lib/types";
import {
  Megaphone,
  TrendingUp,
  Sparkles,
  Printer,
  Plus,
  Eye,
  MousePointerClick,
  Percent,
  Flame,
  FileImage,
  Share2,
  Copy,
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
} from "lucide-react";

export default function MarketingPage() {
  const { currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<"overview" | "ads" | "boost" | "flyers" | "copy">("overview");

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
    badge_label: "🔥 Featured",
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

  // Flyer Studio State
  const [selectedFlyerPropId, setSelectedFlyerPropId] = useState<string>("");
  const [flyerLayout, setFlyerLayout] = useState<"portrait" | "square" | "story">("portrait");
  const [flyerCustomHeadline, setFlyerCustomHeadline] = useState("Exclusive Modern Living");
  const flyerPrintRef = useRef<HTMLDivElement>(null);

  // Social Copy State
  const [copyPropId, setCopyPropId] = useState<string>("");
  const [generatedCopy, setGeneratedCopy] = useState<string>("");
  const [copiedSuccess, setCopiedSuccess] = useState(false);

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
        const [adsRes, boostRes, propsRes, roomsRes, pubPropsRes] = await Promise.all([
          supabase.from("marketing_ads").select("*").eq("company_id", compId).order("created_at", { ascending: false }),
          supabase.from("marketing_boosted_listings").select("*").eq("company_id", compId).order("created_at", { ascending: false }),
          supabase.from("properties").select("id, name, type, address, city, country, status, monthly_rent, photos, available_from").eq("company_id", compId).order("name"),
          supabase.from("room_type_listings").select("id, property_id, display_name, property_name, price_room_only, price_bed_breakfast, photos, amenities").order("created_at", { ascending: false }),
          supabase.from("properties").select("id, name, type, address, city, country, monthly_rent, photos, is_published").eq("company_id", compId).eq("is_published", true).order("name"),
        ]);

        if (!cancelled) {
          if (adsRes.data) setAds(adsRes.data as MarketingAd[]);
          if (boostRes.data) setBoostedListings(boostRes.data as MarketingBoostedListing[]);
          if (pubPropsRes.data) setPublishedListingsForBoost(pubPropsRes.data);
          if (propsRes.data) {
            setProperties(propsRes.data);
            if (propsRes.data.length > 0 && !selectedFlyerPropId) {
              setSelectedFlyerPropId(propsRes.data[0].id);
              setCopyPropId(propsRes.data[0].id);
            }
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

  // Handlers for Boost (redesigned - multi-select listings with geo targeting)
  const handleSaveBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (boostSelectedIds.length === 0) {
      alert("Please select at least one published listing to boost.");
      return;
    }
    setSubmittingBoost(true);
    try {
      const geoPayload = {
        global: boostGeoGlobal,
        countries: boostGeoGlobal ? [] : boostGeoCountries,
        cities: boostGeoGlobal ? [] : boostGeoCities,
      };

      const rows = boostSelectedIds.map((lid) => ({
        company_id: currentCompany.id,
        listing_type: "property" as const,
        listing_id: lid,
        boost_tier: boostForm.boost_tier,
        badge_label: boostForm.badge_label || "🔥 Featured",
        priority_score: boostForm.boost_tier === "premium_sponsor" ? 30 : boostForm.boost_tier === "featured" ? 20 : 10,
        starts_at: boostForm.boost_start_date ? new Date(boostForm.boost_start_date).toISOString() : new Date().toISOString(),
        expires_at: boostForm.boost_end_date ? new Date(boostForm.boost_end_date).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString(),
        is_active: true,
        target_geo: geoPayload,
        budget: boostForm.budget ? Number(boostForm.budget) : 0,
        boost_start_date: boostForm.boost_start_date || null,
        boost_end_date: boostForm.boost_end_date || null,
      }));

      const { error } = await supabase.from("marketing_boosted_listings").insert(rows);
      if (error) throw error;

      setBoostModalOpen(false);
      setBoostSelectedIds([]);
      setBoostGeoGlobal(true);
      setBoostGeoCountries([]);
      setBoostGeoCities([]);
      setBoostForm(prev => ({ ...prev, budget: "", boost_start_date: new Date().toISOString().slice(0, 10), boost_end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) }));
      reload();
    } catch (err: any) {
      alert(err?.message || "Failed to boost listing.");
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

  // Selected Flyer Property details
  const selectedFlyerProp = useMemo(() => {
    return properties.find((p) => p.id === selectedFlyerPropId) || properties[0] || null;
  }, [properties, selectedFlyerPropId]);

  // Handle Flyer Print
  const handlePrintFlyer = () => {
    window.print();
  };

  // Generate Social Copy
  const handleGenerateCopy = () => {
    const target = properties.find((p) => p.id === copyPropId);
    if (!target) return;

    const rentFormatted = `R${Number(target.monthly_rent || 0).toLocaleString()}/month`;
    const copy = `🏡 ✨ FEATURED LISTING: ${target.name.toUpperCase()} ✨

📍 Location: ${target.address || target.city || "Prime Location"}
💰 Rental: ${rentFormatted}
🔑 Status: ${target.status === "vacant" ? "Vacant & Ready for Immediate Tenancy" : "Available Soon"}

Highlights:
✅ Spacious & secure accommodation
✅ Convenient access to transport & amenities
✅ Professionally managed by ${currentCompany.name}

📲 Schedule your viewing today or send an enquiry directly online:
🔗 https://paimbabook.com/listing/${target.id}

For direct inquiries, DM us or reply to this message! #RealEstate #PropertyRental #${(target.city || "SouthAfrica").replace(/\s+/g, "")} #Paimbabook`;

    setGeneratedCopy(copy);
  };

  const handleCopyText = () => {
    if (!generatedCopy) return;
    navigator.clipboard.writeText(generatedCopy);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <ModulePage
      title="Marketing & Growth Department"
      description="Campaign management, front portal banner ads, featured content boosting, flyers, and advertising performance analytics."
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

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "overview", label: "Overview & Analytics", icon: TrendingUp },
              { id: "ads", label: "Front Portal Ads", icon: Megaphone, count: ads.length },
              { id: "boost", label: "Boost Listings", icon: Flame, count: boostedListings.length },
              { id: "flyers", label: "Posters & Flyers Studio", icon: FileImage },
              { id: "copy", label: "Social Media Ad Copy", icon: Sparkles },
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
                          <span>👁️ {ad.impressions_count || 0} views</span>
                          <span>🖱️ {ad.clicks_count || 0} clicks</span>
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
                            {b.badge_label || "🔥 Featured"}
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

        {/* TAB 4: POSTERS & FLYERS STUDIO */}
        {activeTab === "flyers" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <FileImage size={18} className="text-blue-500" />
                  Printable Promotional Posters &amp; Flyers Studio
                </h3>
                <p className="text-xs text-muted">Generate high-converting property flyers with scannable QR codes, live pricing, and company contact details.</p>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handlePrintFlyer} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition">
                  <Printer size={14} /> Print / Save as PDF
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-border-color bg-surface p-4">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Select Property</label>
                <select
                  value={selectedFlyerPropId}
                  onChange={(e) => setSelectedFlyerPropId(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-medium text-foreground outline-none"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R{Number(p.monthly_rent || 0).toLocaleString()}/mo
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Flyer Format</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: "portrait", label: "A4 Portrait" },
                    { id: "square", label: "Square (1:1)" },
                    { id: "story", label: "Story (9:16)" },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setFlyerLayout(fmt.id as any)}
                      className={`text-xs py-2 rounded-xl font-bold border transition ${
                        flyerLayout === fmt.id ? "bg-blue-600 text-white border-blue-600" : "border-border-color bg-surface-elevated text-muted"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Headline Text</label>
                <input
                  type="text"
                  value={flyerCustomHeadline}
                  onChange={(e) => setFlyerCustomHeadline(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
                  placeholder="e.g. Luxurious 2-Bedroom Haven"
                />
              </div>
            </div>

            {/* Flyer Preview Card (Printable) */}
            {selectedFlyerProp && (
              <div className="flex justify-center p-4 bg-muted/5 rounded-2xl border border-border-color overflow-hidden">
                <div
                  ref={flyerPrintRef}
                  className={`bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 transition-all ${
                    flyerLayout === "portrait"
                      ? "w-full max-w-[560px] min-h-[750px]"
                      : flyerLayout === "square"
                      ? "w-full max-w-[500px] aspect-square"
                      : "w-full max-w-[420px] min-h-[740px]"
                  }`}
                  style={{ printColorAdjust: "exact" }}
                >
                  {/* Top Branding Banner */}
                  <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b-4 border-blue-600">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base">
                        {currentCompany.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm tracking-wide">{currentCompany.name}</h4>
                        <p className="text-[10px] text-slate-400">Exclusive Real Estate &amp; Properties</p>
                      </div>
                    </div>
                    <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                      FOR LEASE
                    </span>
                  </div>

                  {/* Main Hero Photo */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                    {selectedFlyerProp.photos && selectedFlyerProp.photos[0] ? (
                      <img src={selectedFlyerProp.photos[0]} alt={selectedFlyerProp.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-slate-200 text-slate-400">
                        <Building2 size={48} />
                      </div>
                    )}
                    <div className="absolute bottom-3 right-3 rounded-2xl bg-slate-900/90 backdrop-blur-md px-4 py-2 text-white border border-white/20 shadow-lg">
                      <p className="text-[10px] text-slate-300 uppercase font-semibold">Monthly Rental</p>
                      <p className="text-xl font-black text-blue-400">
                        R{Number(selectedFlyerProp.monthly_rent || 0).toLocaleString()}
                        <span className="text-xs font-normal text-slate-300">/mo</span>
                      </p>
                    </div>
                  </div>

                  {/* Content & Details */}
                  <div className="p-6 space-y-4">
                    <div>
                      <span className="text-xs font-black tracking-wider uppercase text-blue-600 block mb-1">
                        {flyerCustomHeadline}
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedFlyerProp.name}</h3>
                      <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                        <MapPin size={14} className="text-blue-600 shrink-0" />
                        {selectedFlyerProp.address || selectedFlyerProp.city || "Prime Location"}, {selectedFlyerProp.country || ""}
                      </p>
                    </div>

                    {/* Features grid */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-200 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase">Property Type</span>
                        <span className="font-bold text-slate-800 capitalize">{selectedFlyerProp.type}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase">Occupancy Ready</span>
                        <span className="font-bold text-slate-800 capitalize">{selectedFlyerProp.status}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase">Utilities</span>
                        <span className="font-bold text-slate-800">Managed</span>
                      </div>
                    </div>

                    {/* QR Code & Contact Footer */}
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <div className="space-y-1 text-xs">
                        <p className="font-black text-slate-900 text-sm">Schedule a Viewing Today</p>
                        <p className="text-slate-600">Scan the QR code to view high-res photos and enquire directly on our portal.</p>
                        <p className="text-[11px] font-bold text-blue-600 pt-1">
                          🌐 paimbabook.com/listing/{selectedFlyerProp.id}
                        </p>
                      </div>

                      <div className="shrink-0 text-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                            `https://paimbabook.com/listing/${selectedFlyerProp.id}`
                          )}`}
                          alt="QR Code"
                          className="h-20 w-20 rounded-xl border border-slate-300 p-1 bg-white shadow-xs"
                        />
                        <span className="text-[9px] font-bold text-slate-500 mt-1 block uppercase">Scan to View</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SOCIAL MEDIA AD COPY */}
        {activeTab === "copy" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <Sparkles size={18} className="text-purple-500" />
                Social Media &amp; Advertising Copy Generator
              </h3>
              <p className="text-xs text-muted">Instantly generate tailored marketing captions for Instagram, Facebook, and WhatsApp campaigns.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border-color bg-surface p-5 space-y-4 shadow-xs">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Choose Property</label>
                  <select
                    value={copyPropId}
                    onChange={(e) => setCopyPropId(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-medium text-foreground outline-none"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.city || "Area"}) — R{Number(p.monthly_rent || 0).toLocaleString()}/mo
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleGenerateCopy}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs transition"
                >
                  <Sparkles size={14} /> Generate High-Converting Ad Copy
                </button>
              </div>

              <div className="rounded-2xl border border-border-color bg-surface p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Ready-to-Post Copy</h4>
                  {generatedCopy && (
                    <button onClick={handleCopyText} className="flex items-center gap-1 text-xs font-bold text-purple-500 hover:underline">
                      {copiedSuccess ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                      {copiedSuccess ? "Copied!" : "Copy to Clipboard"}
                    </button>
                  )}
                </div>

                <textarea
                  rows={9}
                  readOnly
                  value={generatedCopy || "Select a property on the left and click 'Generate High-Converting Ad Copy'..."}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated p-3 text-xs text-foreground font-mono leading-relaxed outline-none resize-none"
                />
              </div>
            </div>
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
      <Modal open={boostModalOpen} onClose={() => setBoostModalOpen(false)} title="🔥 Boost Published Listings">
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
                No published listings found. Publish a property first to boost it.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {publishedListingsForBoost.map((p) => {
                  const isSelected = boostSelectedIds.includes(p.id);
                  const photos = Array.isArray(p.photos) ? p.photos : [];
                  const thumb = photos[0];
                  const rent = Number(p.monthly_rent || 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBoostSelectedIds(prev =>
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      )}
                      className={`relative rounded-xl overflow-hidden text-left transition-all focus:outline-none ${
                        isSelected
                          ? "ring-2 ring-amber-500 shadow-lg scale-[1.02]"
                          : "ring-1 ring-border-color hover:ring-amber-400/60 hover:shadow-md"
                      }`}
                    >
                      {/* Property photo as card background */}
                      <div className="relative h-28 w-full bg-surface-elevated">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-600/20">
                            <Flame size={28} className="text-amber-500 opacity-60" />
                          </div>
                        )}
                        {/* Dark overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {/* Type badge top-left */}
                        <span className="absolute top-1.5 left-1.5 rounded-md bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">
                          {p.type?.replace(/_/g, " ") || "Property"}
                        </span>
                        {/* Selection tick top-right */}
                        <div className={`absolute top-1.5 right-1.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? "border-amber-400 bg-amber-500" : "border-white/60 bg-black/40"
                        }`}>
                          {isSelected && <Check size={11} className="text-white" />}
                        </div>
                        {/* Price + name at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white font-bold text-[11px] truncate leading-tight">{p.name}</p>
                          {rent > 0 && (
                            <p className="text-amber-300 font-black text-[10px] mt-0.5">
                              NAD {rent.toLocaleString()}<span className="text-white/70 font-normal">/mo</span>
                            </p>
                          )}
                          {(p.city || p.country) && (
                            <p className="text-white/60 text-[9px] truncate">{p.city || p.country}</p>
                          )}
                        </div>
                      </div>
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
            <label className="text-xs font-semibold text-muted mb-1 block">Badge Text</label>
            <input
              placeholder="e.g. 🔥 Hot Deal, ⭐ Top Pick, ⚡ Quick Move-In"
              value={boostForm.badge_label}
              onChange={(e) => setBoostForm({ ...boostForm, badge_label: e.target.value })}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none"
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
              <span className="text-xs font-semibold text-foreground">🌐 Target Globally (All Countries & Cities)</span>
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
                  <label className="text-xs font-semibold text-muted mb-1 block">Target Cities (type and press Enter)</label>
                  <div className="flex gap-1.5">
                    <input
                      placeholder="e.g. Windhoek, Cape Town..."
                      value={boostGeoCityInput}
                      onChange={(e) => setBoostGeoCityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const city = boostGeoCityInput.trim();
                          if (city && !boostGeoCities.includes(city)) {
                            setBoostGeoCities(prev => [...prev, city]);
                          }
                          setBoostGeoCityInput("");
                        }
                      }}
                      className="flex-1 rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const city = boostGeoCityInput.trim();
                        if (city && !boostGeoCities.includes(city)) setBoostGeoCities(prev => [...prev, city]);
                        setBoostGeoCityInput("");
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
                    >Add</button>
                  </div>
                  {boostGeoCities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
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
            <span className="text-xs text-muted">
              {boostSelectedIds.length} listing{boostSelectedIds.length !== 1 ? "s" : ""} selected
            </span>
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
                <Flame size={14} />
                {submittingBoost ? "Activating..." : `Boost ${boostSelectedIds.length || ""} Listing${boostSelectedIds.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </ModulePage>
  );
}
