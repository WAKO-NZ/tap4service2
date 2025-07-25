import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CustomerDetails {
  email: string;
  name: string;
  address?: string | null;
  phone_number?: string | null;
  alternate_phone_number?: string | null;
  city?: string | null;
  postal_code?: string | null;
  region?: string;
}

const regions = [
  'Auckland',
  'Bay of Plenty',
  'Canterbury',
  'Gisborne',
  'Hawke’s Bay',
  'Manawatu-Whanganui',
  'Marlborough',
  'Nelson',
  'Northland',
  'Otago',
  'Southland',
  'Taranaki',
  'Tasman',
  'Waikato',
  'Wellington',
  'West Coast',
];

export default function CustomerEditProfile() {
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    email: '',
    name: '',
    address: null,
    phone_number: null,
    alternate_phone_number: null,
    city: null,
    postal_code: null,
    region: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!customerId || role !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      setTimeout(() => navigate('/login'), 1000);
      return;
    }

    fetch(`http://localhost:5000/api/customers/${customerId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data: CustomerDetails) => {
        setCustomerDetails({
          email: data.email,
          name: data.name,
          address: data.address || null,
          phone_number: data.phone_number || null,
          alternate_phone_number: data.alternate_phone_number || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          region: data.region || '',
        });
      })
      .catch((err: Error) => {
        setMessage({ text: `Error fetching customer details: ${err.message}`, type: 'error' });
      });
  }, [customerId, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ text: 'New passwords do not match.', type: 'error' });
      return;
    }
    if (!customerDetails.region) {
      setMessage({ text: 'Please select a region.', type: 'error' });
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/customers/update/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerDetails.email,
          name: customerDetails.name,
          newPassword: newPassword || undefined,
          confirmPassword: confirmPassword || undefined,
          address: customerDetails.address || undefined,
          phone_number: customerDetails.phone_number || undefined,
          alternate_phone_number: customerDetails.alternate_phone_number || undefined,
          city: customerDetails.city || undefined,
          postal_code: customerDetails.postal_code || undefined,
          region: customerDetails.region,
        }),
      });
      const data: { message?: string; error?: string } = await response.json();
      if (response.ok) {
        setMessage({ text: 'Profile updated successfully!', type: 'success' });
        localStorage.setItem('userName', customerDetails.name);
        setTimeout(() => navigate('/customer-dashboard'), 1000);
      } else {
        setMessage({ text: `Update failed: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (error: unknown) {
      const err = error as Error;
      setMessage({ text: `Error: ${err.message || 'Network error'}`, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">10</div>
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Edit Customer Profile</h2>
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
              value={customerDetails.name}
              onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Email</label>
            <input
              type="email"
              value={customerDetails.email}
              onChange={(e) => setCustomerDetails({ ...customerDetails, email: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Your Region</label>
            <select
              value={customerDetails.region || ''}
              onChange={(e) => setCustomerDetails({ ...customerDetails, region: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
            >
              <option value="">Select a region</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">New Password (optional)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Address (optional)</label>
            <input
              type="text"
              value={customerDetails.address || ''}
              onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value || null })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">City (optional)</label>
            <input
              type="text"
              value={customerDetails.city || ''}
              onChange={(e) => setCustomerDetails({ ...customerDetails, city: e.target.value || null })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Postal Code (optional)</label>
            <input
              type="text"
              value={customerDetails.postal_code || ''}
              onChange={(e) => setCustomerDetails({ ...customerDetails, postal_code: e.target.value || null })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="e.g., 1010"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Phone Number (optional)</label>
            <input
              type="tel"
              value={customerDetails.phone_number || ''}
              onChange={(e) => setCustomerDetails({ ...customerDetails, phone_number: e.target.value || null })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="+64 123 456 789"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Alternate Phone Number (optional)</label>
            <input
              type="tel"
              value={customerDetails.alternate_phone_number || ''}
              onChange={(e) => setCustomerDetails({ ...customerDetails, alternate_phone_number: e.target.value || null })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="+64 987 654 321"
            />
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
              onClick={() => navigate('/customer-dashboard')}
              className="flex-1 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      <button
        onClick={() => navigate('/customer-dashboard')}
        className="mt-6 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
      >
        Back
      </button>
    </div>
  );
}