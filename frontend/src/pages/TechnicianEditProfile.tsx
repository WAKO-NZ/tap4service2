/**
 * TechnicianEditProfile.tsx - Version V1.2
 * - Fixed region validation for Hawke’s Bay (curly apostrophe).
 * - Fixed TypeScript error for undefined public_liability_insurance.
 * - Allows technicians to edit their profile (name, address, phone, etc., and service regions).
 * - Sends PUT request to /api/technicians/update/:id.
 * - Fetches existing profile data on load.
 * - Redirects to technician dashboard on success.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz/api';

interface TechnicianDetails {
  email: string;
  name: string;
  address?: string | null;
  phone_number?: string | null;
  pspla_number?: string | null;
  nzbn_number?: string | null;
  public_liability_insurance?: boolean | null | undefined;
  city?: string | null;
  postal_code?: string | null;
  service_regions?: string[];
}

const regions = [
  'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay',
  'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
  'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast',
];

export default function TechnicianEditProfile() {
  const [technicianDetails, setTechnicianDetails] = useState<TechnicianDetails>({
    email: '',
    name: '',
    address: null,
    phone_number: null,
    pspla_number: null,
    nzbn_number: null,
    public_liability_insurance: null,
    city: null,
    postal_code: null,
    service_regions: [],
  });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const technicianId = localStorage.getItem('userId');

  useEffect(() => {
    if (!technicianId) {
      setMessage({ text: 'Please log in to edit your profile.', type: 'error' });
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/technicians/${technicianId}`);
        const textData = await response.text();
        let data;
        try {
          data = JSON.parse(textData);
        } catch (parseError) {
          console.error('Profile fetch response is not JSON:', textData);
          setMessage({ text: `Network error: Invalid server response - ${textData.substring(0, 100)}...`, type: 'error' });
          return;
        }
        if (response.ok) {
          setTechnicianDetails({
            email: data.email || '',
            name: data.name || '',
            address: data.address || null,
            phone_number: data.phone_number || null,
            pspla_number: data.pspla_number || null,
            nzbn_number: data.nzbn_number || null,
            public_liability_insurance: data.public_liability_insurance === null || data.public_liability_insurance === undefined ? null : data.public_liability_insurance === '1',
            city: data.city || null,
            postal_code: data.postal_code || null,
            service_regions: data.service_regions || [],
          });
        } else {
          setMessage({ text: `Failed to fetch profile: ${data.error || 'Unknown error'}`, type: 'error' });
        }
      } catch (error) {
        console.error('Profile fetch error:', error);
        setMessage({ text: 'Network error. Please try again later.', type: 'error' });
      }
    };

    fetchProfile();
  }, [technicianId, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTechnicianDetails((prev) => ({ ...prev, [name]: value || null }));
  };

  const handleCheckboxChange = (reg: string) => {
    setTechnicianDetails((prev) => ({
      ...prev,
      service_regions: prev.service_regions!.includes(reg)
        ? prev.service_regions!.filter((r) => r !== reg)
        : [...prev.service_regions!, reg],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!technicianId) return;
    if (!technicianDetails.service_regions || technicianDetails.service_regions.length === 0) {
      setMessage({ text: 'Please select at least one service region.', type: 'error' });
      return;
    }

    try {
      setMessage({ text: 'Updating profile...', type: 'error' });
      const response = await fetch(`${API_URL}/technicians/update/${technicianId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...technicianDetails,
          public_liability_insurance: technicianDetails.public_liability_insurance == null ? null : technicianDetails.public_liability_insurance.toString(),
        }),
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Update response is not JSON:', textData);
        setMessage({ text: `Network error: Invalid server response - ${textData.substring(0, 100)}...`, type: 'error' });
        return;
      }
      if (response.ok) {
        setMessage({ text: 'Profile updated successfully! Redirecting...', type: 'success' });
        localStorage.setItem('userName', technicianDetails.name);
        setTimeout(() => navigate('/technician-dashboard'), 2000);
      } else {
        setMessage({ text: `Update failed: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">11</div>
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Edit Technician Profile</h2>
        {message.text && (
          <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              name="name"
              value={technicianDetails.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Email (Read-only)</label>
            <input
              type="email"
              name="email"
              value={technicianDetails.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-sm"
              disabled
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Address (optional)</label>
            <input
              type="text"
              name="address"
              value={technicianDetails.address || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoComplete="address-line1"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">City (optional)</label>
            <input
              type="text"
              name="city"
              value={technicianDetails.city || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Postal Code (optional)</label>
            <input
              type="text"
              name="postal_code"
              value={technicianDetails.postal_code || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g., 1010"
              autoComplete="postal-code"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Phone Number (optional)</label>
            <input
              type="tel"
              name="phone_number"
              value={technicianDetails.phone_number || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="+64 123 456 789"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">PSPLA Number (optional)</label>
            <input
              type="text"
              name="pspla_number"
              value={technicianDetails.pspla_number || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g., 123456"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">NZBN Number (optional)</label>
            <input
              type="text"
              name="nzbn_number"
              value={technicianDetails.nzbn_number || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g., 9429041234567"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Public Liability Insurance</label>
            <select
              value={technicianDetails.public_liability_insurance == null ? '' : technicianDetails.public_liability_insurance.toString()}
              onChange={(e) => setTechnicianDetails({
                ...technicianDetails,
                public_liability_insurance: e.target.value === '' ? null : e.target.value === 'true',
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select an option</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Service Regions (Select at least one)</label>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-gray-50 border border-gray-300 rounded-md">
              {regions.map((reg) => (
                <label key={reg} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={technicianDetails.service_regions!.includes(reg)}
                    onChange={() => handleCheckboxChange(reg)}
                    className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700 text-sm">{reg}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              className="flex-1 bg-green-600 text-white font-medium py-2 px-4 rounded-md hover:bg-green-700 transition"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate('/technician-dashboard')}
              className="flex-1 bg-gray-600 text-white font-medium py-2 px-4 rounded-md hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}