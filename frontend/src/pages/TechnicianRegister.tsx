/**
 * TechnicianRegister.tsx - Version V1.1
 * - Updated regions to use curly apostrophe for Hawke’s Bay.
 * - Technician registration form with fields for name, email, password, address, phone, etc.
 * - Sends POST request to /api/technicians-register.php.
 * - Redirects to technician dashboard on success.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz/api';

interface TechnicianDetails {
  email: string;
  name: string;
  password: string;
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

export default function TechnicianRegister() {
  const [technicianDetails, setTechnicianDetails] = useState<TechnicianDetails>({
    email: '',
    name: '',
    password: '',
    address: null,
    phone_number: null,
    pspla_number: null,
    nzbn_number: null,
    public_liability_insurance: null,
    city: null,
    postal_code: null,
    service_regions: [],
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (technicianDetails.password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    if (!technicianDetails.service_regions || technicianDetails.service_regions.length === 0) {
      setMessage({ text: 'Please select at least one service region.', type: 'error' });
      return;
    }

    try {
      setMessage({ text: 'Registering...', type: 'error' });
      const response = await fetch(`${API_URL}/technicians-register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...technicianDetails,
          public_liability_insurance: technicianDetails.public_liability_insurance === null || technicianDetails.public_liability_insurance === undefined 
            ? null 
            : technicianDetails.public_liability_insurance.toString(),
        }),
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Registration response is not JSON:', textData);
        setMessage({ text: 'Network error during registration. Invalid server response.', type: 'error' });
        return;
      }
      if (response.ok) {
        setMessage({ text: 'Registration successful! Redirecting...', type: 'success' });
        localStorage.setItem('userId', data.technicianId.toString());
        localStorage.setItem('role', 'technician');
        localStorage.setItem('userName', technicianDetails.name);
        setTimeout(() => navigate('/technician-dashboard'), 2000);
      } else {
        setMessage({ text: `Registration failed: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ text: 'Network error during registration.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">11</div>
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Technician Registration</h2>
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
            <label className="block text-gray-700 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={technicianDetails.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={technicianDetails.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
              autoComplete="new-password"
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
              Register
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex-1 bg-gray-600 text-white font-medium py-2 px-4 rounded-md hover:bg-gray-700 transition"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}