import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadFileToBucket } from '@/lib/storage';
import { useAuth } from '@/lib/auth';
import { 
  Plus, Edit, Trash, Eye, EyeOff, Upload, X, Save, User, Building2, 
  ChevronLeft, ChevronRight, MapPin, Phone, Mail, Camera, Home, 
  DollarSign, Image as ImageIcon 
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

const AMENITIES_OPTIONS = [
  'wifi', 'parking', 'pool', 'garden', 'security', 
  'ac', 'gym', 'balcony', 'furnished', 'pet_friendly'
];

export default function AgentPortalPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchListings();
    const savedProfile = localStorage.getItem('agent_profile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {}
    }
  }, []);

  const saveProfile = () => {
    localStorage.setItem('agent_profile', JSON.stringify(profile));
    alert('Profile saved!');
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
    setActiveTab(1);
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
    if (!currentStatus && photosCount < 4) {
      alert('You need at least 4 photos to publish a listing.');
      return;
    }
    try {
      await supabase.from('agent_listings').update({ is_published: !currentStatus }).eq('id', id);
      setListings(prev => prev.map(l => l.id === id ? { ...l, isPublished: !currentStatus } : l));
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Agent Portal — Property Listings</h1>
        {activeTab === 0 && (
          <button 
            onClick={() => { setEditingId(null); setFormData(defaultFormData); setActiveTab(1); }}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} /> Add Listing
          </button>
        )}
      </div>

      <div className="flex gap-6 border-b border-border-color">
        {['My Listings', 'Add / Edit Listing', 'My Profile'].map((tab, idx) => (
          <button
            key={tab}
            onClick={() => setActiveTab(idx)}
            className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === idx ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
        {activeTab === 0 && (
          <div>
            {loading ? (
              <div className="text-center py-10 text-gray-500">Loading listings...</div>
            ) : listings.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                <p>No listings found. Click "+ Add Listing" to create one.</p>
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
                        <td className="py-3">ZAR {listing.price.toLocaleString()}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${listing.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {listing.isPublished ? 'Live' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button onClick={() => handleTogglePublish(listing.id, listing.isPublished, listing.photos?.length || 0)} className={`p-1.5 rounded-lg border ${listing.isPublished ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`} title={listing.isPublished ? "Unpublish" : "Publish"}>
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

        {activeTab === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold">{editingId ? 'Edit Listing' : 'Add New Listing'}</h2>
            
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
                    {formData.listingType === 'rent' ? 'Monthly Rent (ZAR)' : 'Sale Price (ZAR)'}
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

        {activeTab === 2 && (
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
    </div>
  );
}
