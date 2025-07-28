/**
     * TechnicianEditProfile.tsx - Version V6.102
     * - Validates technicianId against backend to prevent foreign key errors.
     * - Fetches technician details from /api/technicians/:technicianId.
     * - Updates profile via /api/technicians/update/:technicianId.
     * - Includes fields for name, email, password, address, city, postal code, phone, PSPLA/NZBN numbers, public liability insurance, service regions.
     * - Service regions are checkboxes for New Zealand regions.
     * - Redirects to dashboard on success.
     * - Uses environment variables for API URL.
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
      public_liability_insurance?: boolean | null;
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
      const [newPassword, setNewPassword] = useState('');
      const [confirmPassword, setConfirmPassword] = useState('');
      const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
      const [isLoading, setIsLoading] = useState(true);
      const navigate = useNavigate();
      const technicianId = localStorage.getItem('userId');
      const role = localStorage.getItem('role');

      useEffect(() => {
        if (!technicianId || role !== 'technician') {
          setMessage({ text: 'Please log in as a technician.', type: 'error' });
          setTimeout(() => navigate('/login'), 1000);
          return;
        }

        const validateTechnicianId = async () => {
          try {
            const response = await fetch(`${API_URL}/technicians/${technicianId}`);
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!data.valid) {
              throw new Error('Invalid technician ID');
            }
            setTechnicianDetails({
              email: data.email || '',
              name: data.name || '',
              address: data.address ?? null,
              phone_number: data.phone_number ?? null,
              pspla_number: data.pspla_number ?? null,
              nzbn_number: data.nzbn_number ?? null,
              public_liability_insurance: data.public_liability_insurance ?? null,
              city: data.city ?? null,
              postal_code: data.postal_code ?? null,
              service_regions: data.service_regions || [],
            });
            setMessage({ text: '', type: 'error' });
          } catch (error) {
            console.error('Error validating technician ID:', error);
            setMessage({ text: 'Invalid technician ID. Please log in again.', type: 'error' });
            localStorage.removeItem('userId');
            localStorage.removeItem('role');
            localStorage.removeItem('userName');
            setTimeout(() => navigate('/login'), 2000);
          } finally {
            setIsLoading(false);
          }
        };

        validateTechnicianId();
      }, [technicianId, role, navigate]);

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword && newPassword !== confirmPassword) {
          setMessage({ text: 'New passwords do not match.', type: 'error' });
          return;
        }
        if (!technicianDetails.service_regions || technicianDetails.service_regions.length === 0) {
          setMessage({ text: 'Please select at least one service region.', type: 'error' });
          return;
        }

        try {
          const response = await fetch(`${API_URL}/technicians/update/${technicianId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: technicianDetails.email,
              name: technicianDetails.name,
              newPassword: newPassword || undefined,
              confirmPassword: confirmPassword || undefined,
              address: technicianDetails.address || undefined,
              phone_number: technicianDetails.phone_number || undefined,
              pspla_number: technicianDetails.pspla_number || undefined,
              nzbn_number: technicianDetails.nzbn_number || undefined,
              public_liability_insurance:
                technicianDetails.public_liability_insurance !== null
                  ? technicianDetails.public_liability_insurance
                  : undefined,
              city: technicianDetails.city || undefined,
              postal_code: technicianDetails.postal_code || undefined,
              service_regions: technicianDetails.service_regions,
            }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Profile updated successfully! Affected jobs may require rescheduling.', type: 'success' });
            localStorage.setItem('userName', technicianDetails.name);
            setTimeout(() => navigate('/technician-dashboard'), 2000);
          } else {
            setMessage({ text: `Update failed: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (error: unknown) {
          const err = error as Error;
          setMessage({ text: `Error: ${err.message || 'Network error'}`, type: 'error' });
        }
      };

      const handleCheckboxChange = (reg: string) => {
        setTechnicianDetails((prev) => ({
          ...prev,
          service_regions: prev.service_regions!.includes(reg)
            ? prev.service_regions!.filter((r) => r !== reg)
            : [...prev.service_regions!, reg],
        }));
      };

      if (isLoading) {
        return <div className="text-center p-8">Loading profile...</div>;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
          
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Edit Technician Profile</h2>
            {message.text && (
              <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 text-lg mb-2">Name</label>
                <input
                  type="text"
                  value={technicianDetails.name}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, name: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Email</label>
                <input
                  type="email"
                  value={technicianDetails.email}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, email: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Service Regions (Select all that apply)</label>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-gray-50 rounded-md border border-gray-300">
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
              <div>
                <label className="block text-gray-700 text-lg mb-2">New Password (optional)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Address (optional)</label>
                <input
                  type="text"
                  value={technicianDetails.address || ''}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, address: e.target.value || null })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">City (optional)</label>
                <input
                  type="text"
                  value={technicianDetails.city || ''}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, city: e.target.value || null })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Postal Code (optional)</label>
                <input
                  type="text"
                  value={technicianDetails.postal_code || ''}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, postal_code: e.target.value || null })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="e.g., 1010"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Phone Number (optional)</label>
                <input
                  type="tel"
                  value={technicianDetails.phone_number || ''}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, phone_number: e.target.value || null })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="+64 123 456 789"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">PSPLA Number (optional)</label>
                <input
                  type="text"
                  value={technicianDetails.pspla_number || ''}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, pspla_number: e.target.value || null })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="e.g., 123456"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">NZBN Number (optional)</label>
                <input
                  type="text"
                  value={technicianDetails.nzbn_number || ''}
                  onChange={(e) => setTechnicianDetails({ ...technicianDetails, nzbn_number: e.target.value || null })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="e.g., 9429041234567"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Public Liability Insurance</label>
                <select
                  value={technicianDetails.public_liability_insurance == null ? '' : technicianDetails.public_liability_insurance.toString()}
                  onChange={(e) => setTechnicianDetails({
                    ...technicianDetails,
                    public_liability_insurance: e.target.value === '' ? null : e.target.value === 'true'
                  })}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                >
                  <option value="">Select an option</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/technician-dashboard')}
                  className="flex-1 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
          <button
            onClick={() => navigate('/technician-dashboard')}
            className="mt-6 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
          >
            Back
          </button>
        </div>
      );
    }