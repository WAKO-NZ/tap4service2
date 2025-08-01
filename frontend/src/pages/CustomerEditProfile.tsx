/**
 * CustomerEditProfile.tsx - Version V1.3
 * - Updates customer profile via POST /api/customer-edit-profile.php.
 * - Fields: name, surname, phone_number, alternate_phone_number, address, suburb, city, postal_code, password (optional).
 * - Styled to match CustomerRegister.tsx with dark gradient background, gray card, blue gradient buttons, white text.
 * - Adds autocomplete attributes for password fields.
 * - Redirects to /customer-dashboard on success.
 * - Fixed API endpoint to use /api/customer-edit-profile.php.
 * - Enhanced error handling for session validation and API errors.
 * - Fixed TypeScript error: corrected `the role` to `const role`.
 */
import { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser } from 'react-icons/fa';

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
      return <div className="text-center text-red-500 text-[clamp(1rem,2.5vw,1.125rem)] p-8">Something went wrong. Please try again later.</div>;
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  useEffect(() => {
    console.log('Component mounted, customerId:', customerId, 'role:', role);
    if (!customerId || role !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      setTimeout(() => navigate('/customer-login'), 1000);
      return;
    }

    const fetchProfile = async () => {
      try {
        const url = `${API_URL}/api/customer-edit-profile.php`;
        console.log('Fetching profile from:', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = { error: 'Server error' };
          }
          console.warn('Fetch failed:', data.error || 'Unknown error', 'Status:', response.status);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched profile:', data);
        setName(data.profile.name || '');
        setSurname(data.profile.surname || '');
        setPhoneNumber(data.profile.phone_number || '');
        setAlternatePhoneNumber(data.profile.alternate_phone_number || '');
        setAddress(data.profile.address || '');
        setSuburb(data.profile.suburb || '');
        setCity(data.profile.city || '');
        setPostalCode(data.profile.postal_code || '');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Network error');
        console.error('Error fetching profile:', error);
        setMessage({ text: `Failed to fetch profile: ${error.message}`, type: 'error' });
      }
    };

    fetchProfile();
  }, [customerId, role, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!name || !phoneNumber || !address || !city || !postalCode) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    if (password && password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    try {
      const payload = {
        name,
        surname: surname || null,
        phone_number: phoneNumber,
        alternate_phone_number: alternatePhoneNumber || null,
        address,
        suburb: suburb || null,
        city,
        postal_code: postalCode,
        password: password || null,
      };
      const url = `${API_URL}/api/customer-edit-profile.php`;
      console.log('Updating profile at:', url, 'Payload:', payload);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const textData = await response.text();
      console.log('API response status:', response.status, 'Response:', textData);

      if (!response.ok) {
        let data;
        try {
          data = textData ? JSON.parse(textData) : {};
        } catch {
          data = {};
        }
        console.warn('Profile update failed:', data.error || 'Unknown error', 'Status:', response.status);
        setMessage({ text: `Failed to update profile: ${data.error || 'Server error'}`, type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      let data;
      try {
        data = textData ? JSON.parse(textData) : { message: 'Profile updated successfully' };
      } catch (parseError) {
        console.error('Invalid response:', parseError, 'Raw data:', textData);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      setMessage({ text: data.message || 'Profile updated successfully', type: 'success' });
      setTimeout(() => navigate('/customer-dashboard'), 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error updating profile:', error);
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent mb-6">
            Edit Profile
          </h2>
          {message.text && (
            <p className={`text-center mb-6 text-[clamp(1rem,2.5vw,1.125rem)] ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Surname</label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                autoComplete="family-name"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Phone Number *</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Alternate Phone Number</label>
              <input
                type="tel"
                value={alternatePhoneNumber}
                onChange={(e) => setAlternatePhoneNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="address-line1"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Suburb</label>
              <input
                type="text"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                autoComplete="address-line2"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Postal Code *</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="postal-code"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">New Password (Optional)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaUser className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Update Profile
                </div>
              </button>
              <button
                onClick={() => navigate('/customer-dashboard')}
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  Back to Dashboard
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}