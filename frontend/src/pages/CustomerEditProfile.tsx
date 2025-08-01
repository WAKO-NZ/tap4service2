/**
 * CustomerEditProfile.tsx - Version V1.5
 * - Fetches and updates name, surname from customers; phone_number, alternate_phone_number, address, suburb, city, postal_code from customer_details.
 * - Email is read-only.
 * - Styled to match CustomerDashboard.tsx and RequestTechnician.tsx.
 * - Aligned with tapservi_tap4service schema.
 */
import { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error in CustomerEditProfile:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-center text-red-600 text-lg font-medium">Something went wrong. Please try again later.</div>;
    }
    return this.props.children;
  }
}

export default function CustomerEditProfile() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [alternatePhoneNumber, setAlternatePhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  useEffect(() => {
    console.log('Component mounted, customerId:', customerId, 'role:', role);
    if (!customerId || role !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      setTimeout(() => navigate('/login'), 1000);
      return;
    }

    const fetchProfile = async () => {
      try {
        const url = `${API_URL}/api/customers/${customerId}`;
        console.log('Fetching profile from:', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched profile:', data);
        setName(data.name || '');
        setSurname(data.surname || '');
        setPhoneNumber(data.phone_number || '');
        setAlternatePhoneNumber(data.alternate_phone_number || '');
        setAddress(data.address || '');
        setSuburb(data.suburb || '');
        setCity(data.city || '');
        setPostalCode(data.postal_code || '');
        setEmail(data.email || '');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Network error');
        console.error('Error fetching profile:', error);
        setMessage({ text: `Failed to load profile: ${error.message}`, type: 'error' });
      }
    };

    fetchProfile();
  }, [customerId, role, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!name.trim()) {
      setMessage({ text: 'Name is required.', type: 'error' });
      return;
    }
    if (!phoneNumber.trim()) {
      setMessage({ text: 'Phone number is required.', type: 'error' });
      return;
    }
    if (!/^\+?\d{7,15}$/.test(phoneNumber.trim())) {
      setMessage({ text: 'Invalid phone number format.', type: 'error' });
      return;
    }
    if (alternatePhoneNumber && !/^\+?\d{7,15}$/.test(alternatePhoneNumber.trim())) {
      setMessage({ text: 'Invalid alternate phone number format.', type: 'error' });
      return;
    }
    if (!address.trim()) {
      setMessage({ text: 'Address is required.', type: 'error' });
      return;
    }
    if (!city.trim()) {
      setMessage({ text: 'City is required.', type: 'error' });
      return;
    }
    if (!postalCode.trim()) {
      setMessage({ text: 'Postal code is required.', type: 'error' });
      return;
    }

    const payload = {
      name: name.trim(),
      surname: surname.trim() || null,
      phone_number: phoneNumber.trim(),
      alternate_phone_number: alternatePhoneNumber.trim() || null,
      address: address.trim(),
      suburb: suburb.trim() || null,
      city: city.trim(),
      postal_code: postalCode.trim(),
    };

    try {
      const url = `${API_URL}/api/customers/update/${customerId}`;
      console.log('Updating profile at:', url, 'Payload:', payload);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const textData = await response.text();
      console.log('API response status:', response.status, 'Response:', textData);
      if (textData.trim() === '') {
        console.warn('Empty response from server');
        setMessage({ text: 'Server returned an empty response.', type: 'error' });
        return;
      }
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Response is not valid JSON:', parseError, 'Raw data:', textData);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        return;
      }

      if (response.ok) {
        setMessage({ text: data.message || 'Profile updated successfully!', type: 'success' });
        setTimeout(() => navigate('/customer-dashboard'), 2000);
      } else {
        setMessage({ text: `Failed to update profile: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error updating profile:', error);
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Edit Profile</h2>
          {message.text && (
            <p className={`text-center mb-6 text-lg font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Surname (Optional)</label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your surname"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Email (Read-only)</label>
              <input
                type="email"
                value={email}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-lg transition duration-200"
                readOnly
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Phone Number *</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your phone number"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Alternate Phone Number (Optional)</label>
              <input
                type="text"
                value={alternatePhoneNumber}
                onChange={(e) => setAlternatePhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter alternate phone number"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your address"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Suburb (Optional)</label>
              <input
                type="text"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your suburb"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your city"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-lg font-medium mb-2">Postal Code *</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg transition duration-200"
                placeholder="Enter your postal code"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
            >
              Save Changes
            </button>
          </form>
          <button
            onClick={() => navigate('/customer-dashboard')}
            className="mt-6 w-full bg-gray-200 text-gray-800 text-xl font-semibold py-4 px-8 rounded-lg hover:bg-gray-300 hover:shadow-md transition duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}