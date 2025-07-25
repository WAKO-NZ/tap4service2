import { useState, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaUser } from 'react-icons/fa';
import { SapphireSecurityButton } from '../components/ButtonStyles';

interface RegisterResponse {
  message?: string;
  customerId?: number;
  error?: string;
}

const regions = [
  'Auckland',
  'Bay of Plenty',
  'Canterbury',
  'Gisborne',
  'Hawke’s Bay',
  'Manawatū-Whanganui',
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

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error in CustomerRegister:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-red-500 p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please try refreshing the page or contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline">
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4 flex space-x-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              Reload Page
            </button>
            <Link
              to="/"
              className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CustomerRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [alternatePhoneNumber, setAlternatePhoneNumber] = useState('');
  const [region, setRegion] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    if (!email || !password || !name || !region) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          address: address || undefined,
          city: city || undefined,
          postal_code: postalCode || undefined,
          phone_number: phoneNumber || undefined,
          alternate_phone_number: alternatePhoneNumber || undefined,
          region,
        }),
      });
      const data: RegisterResponse = await response.json();
      console.log('Registration response:', { status: response.status, data });

      if (response.ok) {
        setMessage({ text: 'Registration successful! Redirecting to login...', type: 'success' });
        setTimeout(() => navigate('/login'), 2000);
      } else if (response.status === 409) {
        setMessage({ text: 'Email already exists. Please log in.', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage({ text: `Registration failed: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="absolute top-4 right-4 text-yellow-400 font-bold text-[clamp(1.5rem,3vw,2rem)] z-20">2</div>
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center mb-6 bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent">
            Customer Registration
          </h2>
          {message.text && (
            <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Full Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Password"
              />
            </div>
            <div>
              <label htmlFor="region" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Your Region
              </label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Select Your Region"
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
              <label htmlFor="address" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Address (optional)
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Address"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                City (optional)
              </label>
              <input
                type="text"
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="City"
              />
            </div>
            <div>
              <label htmlFor="postalCode" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Postal Code (optional)
              </label>
              <input
                type="text"
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                placeholder="e.g., 1010"
                aria-label="Postal Code"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Phone Number (optional)
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                placeholder="+64 123 456 789"
                aria-label="Phone Number"
              />
            </div>
            <div>
              <label htmlFor="alternatePhoneNumber" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Alternate Phone Number (optional)
              </label>
              <input
                type="tel"
                id="alternatePhoneNumber"
                value={alternatePhoneNumber}
                onChange={(e) => setAlternatePhoneNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                placeholder="+64 987 654 321"
                aria-label="Alternate Phone Number"
              />
            </div>
            <SapphireSecurityButton
              to="#"
              icon={FaUser}
              ariaLabel="Submit Customer Registration"
              onClick={handleSubmit}
            >
              Register
            </SapphireSecurityButton>
          </form>
          <Link
            to="/"
            className="block text-center mt-6 text-[clamp(0.875rem,2vw,1rem)] text-blue-400 hover:underline"
            aria-label="Back to Home"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </ErrorBoundary>
  );
}