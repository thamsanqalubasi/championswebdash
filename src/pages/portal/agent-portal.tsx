import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { uploadFileToBucket } from '@/lib/storage';
import { useAuth } from '@/lib/auth';
import { useCurrency } from '@/lib/currency';
import { 
  Plus, Edit, Trash, Eye, EyeOff, Upload, X, Save, User, Building2, 
  ChevronLeft, ChevronRight, MapPin, Phone, Mail, Camera, Home, 
  DollarSign, Image as ImageIcon, CheckCircle2, Globe, Search, Filter,
  Sparkles, Loader2, RefreshCw, AlertTriangle
} from 'lucide-react';

type AgentListing = {
  id: string;
  companyId: string;
  agentUserId: string;
  name: string;
  type: string;
  listingType: 'rent' | 'sale';
  address: string;
  city: string;
  country: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  price: number;
  photos: string[];
  amenities: string[];
  isPublished: boolean;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  agentWhatsapp: string;
  agentPhotoUrl: string;
  agentGender: string;
  createdAt: string;
  updatedAt: string;
};

type OrgResidentialProperty = {
  id: string;
  name: string;
  type: string;
  address?: string;
  city?: string;
  country?: string;
  monthly_rent?: number;
  photos?: string[];
  description?: string;
  is_published?: boolean;
  company_id?: string;
};

const AMENITIES_OPTIONS = [
  'wifi', 'parking', 'pool', 'garden', 'security', 
  'ac', 'gym', 'balcony', 'furnished', 'pet_friendly'
];

const TABS = ['Published Residential Properties', 'My Custom Listings', 'Add / Edit Listing', 'My Profile'];

export default function AgentPortalPage() {
  const { user, currentCompany } = useAuth();
  const { currency, symbol, formatWhole } = useCurrency();
  const [activeTab, setActiveTab] = useState(0);
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Org residential properties state
  const [orgProperties, setOrgProperties] = useState<OrgResidentialProperty[]>([]);
  const [loadingOrgProps, setLoadingOrgProps] = useState(false);
  const [togglingPropId, setTogglingPropId] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgTypeFilter, setOrgTypeFilter] = useState('all');
  const [orgStatusFilter, setOrgStatusFilter] = useState<'all' | 'published' | 'hidden'>('all');
  const [showProfileWarningModal, setShowProfileWarningModal] = useState(false);

  const defaultFormData = {
    name: '',
    type: 'house',
    listingType: 'sale' as 'rent' | 'sale',
    price: 0,
    address: '',
    city: '',
    country: '',
    description: '',
    bedrooms: 0,
    bathrooms: 0,
    areaSqm: 0,
    amenities: [] as string[],
    photos: [] as string[],
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [formSaving, setFormSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    gender: 'other',
    email: '',
    phone: '',
    whatsapp: '',
    photoUrl: '',
  });

  const isProfileComplete = Boolean(
    (profile.firstName?.trim() && profile.lastName?.trim()) ||
    user?.user_metadata?.full_name?.trim()
  ) && Boolean(
    profile.phone?.trim() || profile.whatsapp?.trim()
  ) && Boolean(
    profile.email?.trim() || user?.email?.trim()
  );

  const livePropsCount = orgProperties.filter(prop => {
    const matched = listings.find(l => l.name.trim().toLowerCase() === prop.name.trim().toLowerCase());
    return Boolean(matched && matched.isPublished) || Boolean(prop.is_published);
  }).length;

  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('agent_listings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setListings(data.map((row: any) => ({
          id: row.id,
          companyId: row.company_id,
          agentUserId: row.agent_user_id,
          name: row.name,
          type: row.type,
          listingType: row.listing_type,
          address: row.address,
          city: row.city,
          country: row.country,
          description: row.description,
          bedrooms: row.bedrooms,
          bathrooms: row.bathrooms,
          areaSqm: row.area_sqm,
          price: row.price,
          photos: row.photos || [],
          amenities: row.amenities || [],
          isPublished: row.is_published,
          agentName: row.agent_name,
          agentEmail: row.agent_email,
          agentPhone: row.agent_phone,
          agentWhatsapp: row.agent_whatsapp,
          agentPhotoUrl: row.agent_photo_url,
          agentGender: row.agent_gender,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })));
      }
    } catch (e) {
      console.error(e);
      setListings([]);
    }
    setLoading(false);
  };

  const fetchOrgProperties = async () => {
    setLoadingOrgProps(true);
    try {
      let query = supabase
        .from('properties')
        .select('id, name, type, address, city, country, monthly_rent, photos, description, is_published, company_id')
        .in('type', ['house', 'apartment', 'storage', 'room', 'flat', 'residential', 'commercial', 'townhouse', 'lodge']);
      
      const compId = currentCompany?.id;
      if (compId) {
        query = query.or(`company_id.eq.${compId},company_id.is.null`);
      }

      const { data, error } = await query.order('name');
      if (error) {
        // Fallback without company filter
        const { data: fallbackData } = await supabase
          .from('properties')
          .select('id, name, type, address, city, country, monthly_rent, photos, description, is_published')
          .in('type', ['house', 'apartment', 'storage', 'room', 'flat', 'residential', 'commercial', 'townhouse', 'lodge'])
          .order('name');
        if (fallbackData) {
          setOrgProperties(fallbackData.map((p: any) => ({
            ...p,
            photos: Array.isArray(p.photos) ? p.photos : typeof p.photos === 'string' ? (() => { try { return JSON.parse(p.photos); } catch { return []; } })() : [],
          })));
        }
      } else if (data) {
        setOrgProperties(data.map((p: any) => ({
          ...p,
          photos: Array.isArray(p.photos) ? p.photos : typeof p.photos === 'string' ? (() => { try { return JSON.parse(p.photos); } catch { return []; } })() : [],
        })));
      }
    } catch (err) {
      console.error('Error fetching org properties:', err);
    } finally {
      setLoadingOrgProps(false);
    }
  };

  const handleTogglePublishOrgProperty = async (prop: OrgResidentialProperty) => {
    setTogglingPropId(prop.id);
    try {
      const existing = listings.find(l => l.name.trim().toLowerCase() === prop.name.trim().toLowerCase());
      const isCurrentlyLive = existing ? existing.isPublished : Boolean(prop.is_published);

      // STRICT VALIDATION: Agent details must be entered before a property can be shown on the front page index
      if (!isCurrentlyLive) {
        if (!isProfileComplete) {
          setShowProfileWarningModal(true);
          setTogglingPropId(null);
          return;
        }
      }

      const agentName = `${profile.firstName} ${profile.lastName}`.trim() || user?.user_metadata?.full_name || 'Property Agent';
      const agentPhone = profile.phone || profile.whatsapp || '';
      const agentWhatsapp = profile.whatsapp || profile.phone || '';
      const agentEmail = profile.email || user?.email || '';
      const agentPhotoUrl = profile.photoUrl || '';

      if (isCurrentlyLive && existing) {
        // Hide from Agent Index
        await supabase.from('agent_listings').update({ is_published: false }).eq('id', existing.id);
        await supabase.from('properties').update({ is_published: false }).eq('id', prop.id);
        setListings(prev => prev.map(l => l.id === existing.id ? { ...l, isPublished: false } : l));
        setOrgProperties(prev => prev.map(p => p.id === prop.id ? { ...p, is_published: false } : p));
      } else if (existing) {
        // Reactivate on Agent Index with latest agent contact details
        const updatePayload = {
          is_published: true,
          agent_name: agentName,
          agent_email: agentEmail,
          agent_phone: agentPhone,
          agent_whatsapp: agentWhatsapp,
          agent_photo_url: agentPhotoUrl,
          agent_gender: profile.gender || 'other',
          agent_user_id: user?.id,
        };
        await supabase.from('agent_listings').update(updatePayload).eq('id', existing.id);
        await supabase.from('properties').update({ is_published: true }).eq('id', prop.id);
        setListings(prev => prev.map(l => l.id === existing.id ? { ...l, ...updatePayload, isPublished: true } : l));
        setOrgProperties(prev => prev.map(p => p.id === prop.id ? { ...p, is_published: true } : p));
      } else {
        // Publish new to Agent Index
        const propPhotos = prop.photos || [];
        const payload = {
          name: prop.name,
          type: prop.type || 'house',
          listing_type: 'rent' as const,
          price: prop.monthly_rent || 0,
          address: prop.address || '',
          city: prop.city || '',
          country: prop.country || '',
          description: prop.description || `${prop.name} - managed residential property ready for leasing.`,
          bedrooms: 1,
          bathrooms: 1,
          area_sqm: 0,
          amenities: ['wifi', 'parking', 'security'],
          photos: propPhotos,
          is_published: true,
          agent_name: agentName,
          agent_email: agentEmail,
          agent_phone: agentPhone,
          agent_whatsapp: agentWhatsapp,
          agent_photo_url: agentPhotoUrl,
          agent_gender: profile.gender || 'other',
          agent_user_id: user?.id,
          company_id: prop.company_id || currentCompany?.id,
        };

        const { error } = await supabase.from('agent_listings').insert(payload);
        if (error) throw error;
        await supabase.from('properties').update({ is_published: true }).eq('id', prop.id);
        await fetchListings();
        setOrgProperties(prev => prev.map(p => p.id === prop.id ? { ...p, is_published: true } : p));
      }
    } catch (err) {
      console.error('Error toggling listing on agent index:', err);
      alert('Error updating agent index status.');
    } finally {
      setTogglingPropId(null);
    }
  };

  useEffect(() => {
    fetchListings();
    fetchOrgProperties();
    const savedProfile = localStorage.getItem('agent_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile(prev => ({
          ...prev,
          ...parsed,
          email: parsed.email || user?.email || '',
          firstName: parsed.firstName || user?.user_metadata?.full_name?.split(' ')[0] || '',
          lastName: parsed.lastName || user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        }));
      } catch (e) {}
    } else if (user) {
      setProfile(prev => ({
        ...prev,
        email: user.email || '',
        firstName: user.user_metadata?.full_name?.split(' ')[0] || '',
        lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
      }));
    }
  }, [user]);

  const saveProfile = async () => {
    localStorage.setItem('agent_profile', JSON.stringify(profile));
    try {
      if (user?.id) {
        await supabase.from('agent_listings').update({
          agent_name: `${profile.firstName} ${profile.lastName}`.trim(),
          agent_email: profile.email,
          agent_phone: profile.phone,
          agent_whatsapp: profile.whatsapp,
          agent_photo_url: profile.photoUrl,
          agent_gender: profile.gender,
        }).eq('agent_user_id', user.id);
      }
    } catch (e) {
      console.warn("Could not sync agent profile to agent_listings", e);
    }
    alert('Agent profile saved successfully!');
  };

  const handleEdit = (listing: AgentListing) => {
    setEditingId(listing.id);
    setFormData({
      name: listing.name,
      type: listing.type,
      listingType: listing.listingType,
      price: listing.price,
      address: listing.address,
      city: listing.city,
      country: listing.country,
      description: listing.description,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      areaSqm: listing.areaSqm,
      amenities: listing.amenities,
      photos: listing.photos,
    });
    setActiveTab(2);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await supabase.from('agent_listings').delete().eq('id', id);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error deleting listing');
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean, photosCount: number) => {
    if (!currentStatus) {
      if (!isProfileComplete) {
        setShowProfileWarningModal(true);
        return;
      }
      if (photosCount < 4) {
        alert('You need at least 4 photos to publish a listing.');
        return;
      }
    }
    try {
      const updateData: any = { is_published: !currentStatus };
      if (!currentStatus) {
        updateData.agent_name = `${profile.firstName} ${profile.lastName}`.trim() || user?.user_metadata?.full_name || 'Property Agent';
        updateData.agent_email = profile.email || user?.email || '';
        updateData.agent_phone = profile.phone || profile.whatsapp || '';
        updateData.agent_whatsapp = profile.whatsapp || profile.phone || '';
        updateData.agent_photo_url = profile.photoUrl || '';
      }
      await supabase.from('agent_listings').update(updateData).eq('id', id);
      setListings(prev => prev.map(l => l.id === id ? { ...l, ...updateData, isPublished: !currentStatus } : l));
    } catch (e) {
      console.error(e);
      alert('Error updating status');
    }
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadingPhotos(true);
    const newPhotos = [...formData.photos];
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await uploadFileToBucket('agent-listings', 'photos', files[i]);
        if (url) newPhotos.push(url);
      } catch (error) {
        console.error('Error uploading photo', error);
      }
    }
    setFormData(prev => ({ ...prev, photos: newPhotos }));
    setUploadingPhotos(false);
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfilePic(true);
    try {
      const url = await uploadFileToBucket('agent-listings', 'profiles', file);
      if (url) setProfile(prev => ({ ...prev, photoUrl: url }));
    } catch (error) {
      console.error('Error uploading profile pic', error);
    }
    setUploadingProfilePic(false);
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const saveListing = async () => {
    setFormSaving(true);
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        listing_type: formData.listingType,
        price: formData.price,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        description: formData.description,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        area_sqm: formData.areaSqm,
        amenities: formData.amenities,
        photos: formData.photos,
        is_published: editingId ? undefined : false, // Keep existing status if editing
        agent_name: `${profile.firstName} ${profile.lastName}`.trim(),
        agent_email: profile.email,
        agent_phone: profile.phone,
        agent_whatsapp: profile.whatsapp,
        agent_photo_url: profile.photoUrl,
        agent_gender: profile.gender,
        agent_user_id: user?.id,
      };

      if (editingId) {
        await supabase.from('agent_listings').update(payload).eq('id', editingId);
      } else {
        await supabase.from('agent_listings').insert(payload);
      }
      
      await fetchListings();
      setFormData(defaultFormData);
      setEditingId(null);
      setActiveTab(0);
    } catch (e) {
      console.error(e);
      alert('Error saving listing');
    }
    setFormSaving(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Portal — Property Listings</h1>
          <p className="text-xs text-muted mt-1">
            Manage published residential properties and control their visibility on the public front page index.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            type="button"
            onClick={() => { setActiveTab(0); setOrgStatusFilter('published'); }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 border shadow-xs ${
              activeTab === 0 && orgStatusFilter === 'published'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-surface-elevated border-border-color text-foreground hover:bg-surface'
            }`}
          >
            <Home size={15} className={activeTab === 0 && orgStatusFilter === 'published' ? 'text-white' : 'text-emerald-500'} />
            <span>Published Residential Properties ({livePropsCount})</span>
          </button>

          <button 
            type="button"
            onClick={() => { setEditingId(null); setFormData(defaultFormData); setActiveTab(2); }}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-blue-700 flex items-center gap-2 shadow-xs"
          >
            <Plus size={15} /> Add Custom Listing
          </button>
        </div>
      </div>

      <div className="flex gap-4 sm:gap-6 border-b border-border-color overflow-x-auto">
        {TABS.map((tab, idx) => (
          <button
            key={tab}
            onClick={() => setActiveTab(idx)}
            className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === idx ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {idx === 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {livePropsCount} Live
              </span>
            )}
            {idx === 1 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {listings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
        {/* Tab 0: Published Residential Properties */}
        {activeTab === 0 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-color pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Building2 size={20} className="text-blue-600" />
                  <span>Residential Portfolio Properties — Front Page Visibility</span>
                </h2>
                <p className="text-xs text-muted mt-1">
                  Control which residential properties appear on the public front page index for prospective customers. Click "Show" or "Hide" to toggle visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchOrgProperties}
                disabled={loadingOrgProps}
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface transition self-start md:self-auto"
              >
                <RefreshCw size={13} className={loadingOrgProps ? "animate-spin" : ""} />
                <span>Refresh Portfolio</span>
              </button>
            </div>

            {/* Agent Profile Status Banner */}
            {!isProfileComplete ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shrink-0 shadow-xs">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Agent Profile Incomplete — Contact Details Required</p>
                    <p className="text-[11px] text-muted">Properties cannot be shown on the public front page index until your agent profile has a contact phone number and name.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <User size={13} />
                  <span>Complete Profile</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Agent Profile Active: {`${profile.firstName} ${profile.lastName}`.trim() || user?.user_metadata?.full_name || 'Verified Agent'}
                    </p>
                    <p className="text-[11px] text-muted">
                      📞 {profile.phone || profile.whatsapp || 'Phone active'} · ✉️ {profile.email || user?.email} · Ready to show properties on public front page.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className="px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/20 transition"
                >
                  Edit Profile
                </button>
              </div>
            )}

            {/* Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-2.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search properties by name, city, address..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-3 py-2 text-xs text-foreground outline-none focus:border-blue-600"
                />
              </div>

              {/* Status Tabs: All, Showing, Hidden */}
              <div className="flex items-center gap-1 rounded-xl border border-border-color bg-surface-elevated p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setOrgStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    orgStatusFilter === 'all' ? 'bg-surface shadow-xs text-foreground font-bold' : 'text-muted hover:text-foreground'
                  }`}
                >
                  All ({orgProperties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrgStatusFilter('published')}
                  className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                    orgStatusFilter === 'published' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-600 hover:bg-emerald-50/50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Showing ({livePropsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrgStatusFilter('hidden')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    orgStatusFilter === 'hidden' ? 'bg-surface shadow-xs text-foreground font-bold' : 'text-muted hover:text-foreground'
                  }`}
                >
                  Hidden ({orgProperties.length - livePropsCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted" />
                <select
                  value={orgTypeFilter}
                  onChange={(e) => setOrgTypeFilter(e.target.value)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-blue-600"
                >
                  <option value="all">All Types</option>
                  <option value="house">Houses</option>
                  <option value="apartment">Apartments</option>
                  <option value="storage">Storage</option>
                  <option value="room">Rooms</option>
                </select>
              </div>
            </div>

            {loadingOrgProps ? (
              <div className="text-center py-16 text-muted">
                <Loader2 size={32} className="mx-auto mb-3 animate-spin text-blue-600" />
                <p className="text-sm">Loading portfolio properties...</p>
              </div>
            ) : orgProperties.length === 0 ? (
              <div className="text-center py-16 text-muted bg-surface-elevated/40 rounded-2xl border border-dashed border-border-color">
                <Building2 size={44} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold text-foreground">No residential portfolio properties found</p>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Add residential properties (houses, apartments, storage units) in Property Management to toggle them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {orgProperties
                  .filter((prop) => {
                    const q = orgSearch.toLowerCase();
                    const matchesSearch = !q ||
                      prop.name.toLowerCase().includes(q) ||
                      (prop.address || "").toLowerCase().includes(q) ||
                      (prop.city || "").toLowerCase().includes(q);
                    const matchesType = orgTypeFilter === "all" || prop.type === orgTypeFilter;
                    
                    const matchedListing = listings.find(
                      (l) => l.name.trim().toLowerCase() === prop.name.trim().toLowerCase()
                    );
                    const isLive = Boolean(matchedListing && matchedListing.isPublished) || Boolean(prop.is_published);
                    
                    const matchesStatus = 
                      orgStatusFilter === "all" ||
                      (orgStatusFilter === "published" && isLive) ||
                      (orgStatusFilter === "hidden" && !isLive);

                    return matchesSearch && matchesType && matchesStatus;
                  })
                  .map((prop) => {
                    const matchedListing = listings.find(
                      (l) => l.name.trim().toLowerCase() === prop.name.trim().toLowerCase()
                    );
                    const isLive = Boolean(matchedListing && matchedListing.isPublished) || Boolean(prop.is_published);
                    const isToggling = togglingPropId === prop.id;
                    const primaryPhoto = prop.photos?.[0];

                    return (
                      <div
                        key={prop.id}
                        className={`group relative rounded-2xl border bg-surface overflow-hidden shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                          isLive ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-border-color"
                        }`}
                      >
                        <div>
                          {/* Image Container */}
                          <div className="relative h-44 w-full bg-surface-elevated overflow-hidden">
                            {primaryPhoto ? (
                              <img
                                src={primaryPhoto}
                                alt={prop.name}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="h-full w-full flex flex-col items-center justify-center text-muted bg-surface-elevated">
                                <Building2 size={36} className="opacity-30 mb-1" />
                                <span className="text-[11px]">No Photo</span>
                              </div>
                            )}

                            {/* Top Badges */}
                            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                              <span className="capitalize px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/70 text-white backdrop-blur-xs">
                                {prop.type}
                              </span>

                              {isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                  <span>Showing on Index</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs">
                                  <span>Hidden</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-4 space-y-2">
                            <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-blue-600 transition">
                              {prop.name}
                            </h3>
                            <p className="text-xs text-muted flex items-center gap-1 line-clamp-1">
                              <MapPin size={12} className="shrink-0 text-muted" />
                              <span>{prop.address ? `${prop.address}, ${prop.city || ""}` : prop.city || "Location not listed"}</span>
                            </p>
                            <div className="pt-2 flex items-baseline justify-between border-t border-border-color/60">
                              <span className="text-xs text-muted">Monthly Rent:</span>
                              <span className="text-sm font-black text-emerald-600">
                                {formatWhole(prop.monthly_rent || 0)} / mo
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 pt-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePublishOrgProperty(prop)}
                            disabled={isToggling}
                            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 ${
                              isLive
                                ? "border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isLive ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                            <span>{isLive ? "Hide from Front Page Index" : "Show on Front Page Index"}</span>
                          </button>

                          <Link
                            to="/marketing"
                            title="Boost this property on marketing portal"
                            className="py-2 px-3 text-xs font-bold rounded-xl border border-border-color bg-surface-elevated hover:bg-surface text-foreground flex items-center gap-1 transition"
                          >
                            <Sparkles size={13} className="text-amber-500" />
                            <span>Boost</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: My Custom Listings */}
        {activeTab === 1 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold">My Custom Listings</h2>
                <p className="text-xs text-muted">Custom listings created manually under your agent profile.</p>
              </div>
              <button 
                onClick={() => { setEditingId(null); setFormData(defaultFormData); setActiveTab(2); }}
                className="bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-blue-700 flex items-center gap-2 shadow-xs"
              >
                <Plus size={15} /> Add Custom Listing
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-500">Loading custom listings...</div>
            ) : listings.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                <p>No custom listings found. Click "+ Add Custom Listing" to create one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-gray-500">
                      <th className="pb-3 font-medium">Photo</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Listing Type</th>
                      <th className="pb-3 font-medium">City</th>
                      <th className="pb-3 font-medium">Price</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {listings.map(listing => (
                      <tr key={listing.id}>
                        <td className="py-3">
                          {listing.photos?.[0] ? (
                            <img src={listing.photos[0]} alt="thumbnail" className="w-16 h-12 object-cover rounded-lg" />
                          ) : (
                            <div className="w-16 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </td>
                        <td className="py-3 font-medium">{listing.name}</td>
                        <td className="py-3 capitalize">{listing.type}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${listing.listingType === 'sale' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                            For {listing.listingType}
                          </span>
                        </td>
                        <td className="py-3">{listing.city}</td>
                        <td className="py-3">{formatWhole(listing.price)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${listing.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {listing.isPublished ? 'Live' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button onClick={() => handleTogglePublish(listing.id, listing.isPublished, listing.photos?.length || 0)} className={`p-1.5 rounded-lg border ${listing.isPublished ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`} title={listing.isPublished ? "Hide from Front Page" : "Show on Front Page"}>
                            {listing.isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button onClick={() => handleEdit(listing)} className="p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50" title="Edit">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDelete(listing.id)} className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50" title="Delete">
                            <Trash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Add / Edit Listing */}
        {activeTab === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold">{editingId ? 'Edit Listing' : 'Add New Listing'}</h2>

            {!editingId && (
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Select from Existing Residential Properties</p>
                    <p className="text-[11px] text-muted">Autofill details, photos, and rent price directly from your company portfolio</p>
                  </div>
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const selectedProp = orgProperties.find(p => p.id === e.target.value);
                    if (selectedProp) {
                      setFormData({
                        ...defaultFormData,
                        name: selectedProp.name || "",
                        type: selectedProp.type || "house",
                        listingType: "rent",
                        price: Number(selectedProp.monthly_rent || 0),
                        address: selectedProp.address || "",
                        city: selectedProp.city || "",
                        country: selectedProp.country || "",
                        description: selectedProp.description || `${selectedProp.name} - managed residential property ready for leasing.`,
                        photos: Array.isArray(selectedProp.photos) ? selectedProp.photos : [],
                        amenities: ["wifi", "parking", "security"],
                      });
                    }
                  }}
                  className="rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-blue-500 min-w-[220px]"
                >
                  <option value="">-- Autofill from Portfolio --</option>
                  {orgProperties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type}) — {formatWhole(p.monthly_rent || 0)}/mo
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Property Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" placeholder="e.g. Modern Apartment in Sandton" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500">
                      <option value="house">House</option>
                      <option value="apartment">Apartment</option>
                      <option value="lodge">Lodge</option>
                      <option value="room">Room</option>
                      <option value="storage">Storage</option>
                      <option value="land">Land</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Listing Type</label>
                    <select value={formData.listingType} onChange={e => setFormData({...formData, listingType: e.target.value as 'rent'|'sale'})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500">
                      <option value="rent">For Rent</option>
                      <option value="sale">For Sale</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {formData.listingType === 'rent' ? `Monthly Rent (${currency})` : `Sale Price (${currency})`}
                  </label>
                  <input type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Country</label>
                    <input type="text" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Bedrooms</label>
                    <input type="number" min="0" value={formData.bedrooms} onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bathrooms</label>
                    <input type="number" min="0" value={formData.bathrooms} onChange={e => setFormData({...formData, bathrooms: Number(e.target.value)})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Area (sqm)</label>
                    <input type="number" min="0" value={formData.areaSqm} onChange={e => setFormData({...formData, areaSqm: Number(e.target.value)})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500 resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Amenities</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AMENITIES_OPTIONS.map(amenity => (
                      <label key={amenity} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={formData.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} className="rounded border-gray-300" />
                        <span className="capitalize">{amenity.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border-color">
                  <label className="block text-sm font-medium mb-2">Photos (Minimum 4 for publishing)</label>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <label className="cursor-pointer bg-blue-50 text-blue-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-100 flex items-center gap-2 transition">
                      <Upload size={16} /> {uploadingPhotos ? 'Uploading...' : 'Upload Photos'}
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotosUpload} disabled={uploadingPhotos} />
                    </label>
                    <span className="text-sm text-gray-500">{formData.photos.length} of 4 minimum photos uploaded</span>
                  </div>

                  {formData.photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {formData.photos.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border-color group">
                          <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                          <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition hover:bg-black">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-color mt-6">
              <button onClick={() => { setActiveTab(0); setEditingId(null); setFormData(defaultFormData); }} className="px-4 py-2 text-sm font-medium border border-border-color rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveListing} disabled={!formData.name || formData.photos.length < 4 || formSaving} className="bg-blue-600 text-white rounded-xl px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <Save size={16} /> {formSaving ? 'Saving...' : 'Save Listing'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-gray-100 border border-border-color overflow-hidden flex items-center justify-center relative group">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
                <label className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                  <Camera size={20} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} disabled={uploadingProfilePic} />
                </label>
              </div>
              <div>
                <h2 className="text-lg font-bold">Agent Profile Info</h2>
                <p className="text-sm text-gray-500">This information will be displayed on your property listings.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input type="text" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input type="text" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <input type="text" placeholder="+27 XX XXX XXXX" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                <input type="text" placeholder="+27 XX XXX XXXX" value={profile.whatsapp} onChange={e => setProfile({...profile, whatsapp: e.target.value})} className="w-full bg-surface-elevated rounded-xl px-3 py-2 text-sm border border-border-color outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={saveProfile} className="bg-blue-600 text-white rounded-xl px-6 py-2 text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                <Save size={16} /> Save Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Agent Details Required Warning Modal */}
      {showProfileWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-2xl border border-border-color p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Agent Details Required</h3>
                <p className="text-xs text-muted">Profile details needed before showing property</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              To show properties on the public front page index for potential customers, your agent details (<strong className="text-foreground">Full Name, Phone Number/WhatsApp, and Email</strong>) must be entered. This allows interested tenants and buyers to contact you directly.
            </p>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={((profile.firstName && profile.lastName) || user?.user_metadata?.full_name) ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {((profile.firstName && profile.lastName) || user?.user_metadata?.full_name) ? "✓" : "✗"} Agent Name:
                </span>
                <span className="text-foreground">{`${profile.firstName} ${profile.lastName}`.trim() || user?.user_metadata?.full_name || 'Missing (Required)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={(profile.phone || profile.whatsapp) ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {(profile.phone || profile.whatsapp) ? "✓" : "✗"} Phone / WhatsApp:
                </span>
                <span className="text-foreground">{profile.phone || profile.whatsapp || 'Missing (Required)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={(profile.email || user?.email) ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {(profile.email || user?.email) ? "✓" : "✗"} Email:
                </span>
                <span className="text-foreground">{profile.email || user?.email || 'Missing (Required)'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProfileWarningModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border-color hover:bg-surface-elevated text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileWarningModal(false);
                  setActiveTab(3); // Switch to My Profile tab
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
              >
                <User size={14} />
                <span>Complete Agent Profile Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
