/**
 * CustomerRegister.tsx - Version V5.330
 * - Handles customer registration via POST /api/customers-register.php.
 * - Fields: email, password, confirmPassword, name, surname, phone_number, alternate_phone_number, address, suburb, city, postal_code, region.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text, and ripple effect.
 * - Generates verification token and sends email (handled by backend).
 * - Redirects to /customer-login on success.
 * - Fixed endpoint to /api/customers-register.php.
 */
import { useState, Component, type ErrorInfo, type FormEvent } from 'react';
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
    console.error('Error in CustomerRegister:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-center text-red-500 text-[clamp(1rem,2.5vw,1.125rem)] p-8">Something went wrong. Please try again later.</div>;
    }
    return this.props.children;
  }
}

export default function CustomerRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [alternatePhoneNumber, setAlternatePhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [region, setRegion] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!email || !password || !name || !phoneNumber || !address || !city || !postalCode || !region) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    try {
      const payload = {
        email,
        password,
        name,
        surname: surname || null,
        phone_number: phoneNumber,
        alternate_phone_number: alternatePhoneNumber || null,
        address,
        suburb: suburb || null,
        city,
        postal_code: postalCode,
        region
      };
      const url = `${API_URL}/api/customers-register.php`;
      console.log('Registering at:', url, 'Payload:', payload);
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
        console.warn('Registration failed:', data.error || 'Unknown error', 'Status:', response.status);
        setMessage({ text: `Registration failed: ${data.error || 'Server error'}`, type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      let data;
      try {
        data = textData ? JSON.parse(textData) : { message: 'Registration successful' };
      } catch (parseError) {
        console.error('Invalid response:', parseError, 'Raw data:', textData);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      setMessage({ text: data.message || 'Registration successful. Please verify your email.', type: 'success' });
      setTimeout(() => navigate('/customer-login'), 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error registering:', error);
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
            Register
          </h2>
          {message.text && (
            <p className={`text-center mb-6 text-[clamp(1rem,2.5vw,1.125rem)] ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Confirm Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                autoComplete="new-password"
              />
            </div>
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
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Region *</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
              >
                <option value="">Select a region</option>
                {['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawkes Bay', 'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'].map((reg) => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
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
                  Register
                </div>
              </button>
              <button
                onClick={() => navigate('/customer-login')}
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  Back to Login
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}