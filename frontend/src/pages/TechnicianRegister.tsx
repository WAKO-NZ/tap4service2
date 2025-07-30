/**
 * TechnicianRegister.tsx - Version V1.4
 * - Updated to handle verification email success: displays message and redirects to /technician-login.
 * - Modified to scroll to top on duplicate email (409 status) instead of redirecting to /technician-login.
 * - Updated styling to match CustomerRegister.tsx (dark theme, gradient background, gray-800 form container).
 * - Removed page number from top-right corner.
 * - Split name into Name and Surname fields, both required.
 * - Added frontend email validation to check for duplicates before submission.
 * - Made all fields compulsory except NZBN Number (optional).
 * - Updated Back to Login button to navigate to /technician-login.
 * - Sends POST request to /api/technicians-register.php.
 * - Redirects to /technician-login on success.
 */
import { useState, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaWrench } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface RegisterResponse {
  message?: string;
  technicianId?: number;
  error?: string;
}

const regions = [
  'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay',
  'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
  'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast',
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
    console.error('Error in TechnicianRegister:', error, errorInfo);
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

export default function TechnicianRegister() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [psplaNumber, setPsplaNumber] = useState('');
  const [nzbnNumber, setNzbnNumber] = useState('');
  const [publicLiabilityInsurance, setPublicLiabilityInsurance] = useState<boolean | null>(null);
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [serviceRegions, setServiceRegions] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const handleCheckboxChange = (reg: string) => {
    setServiceRegions((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    // Validate required fields
    if (!name || !surname || !email || !password || !confirmPassword || !address || !phoneNumber || !psplaNumber || !city || !postalCode || publicLiabilityInsurance === null || serviceRegions.length === 0) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    // Check for duplicate email
    try {
      const checkResponse = await fetch(`${API_URL}/api/technicians-register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, checkOnly: true }),
      });
      const checkTextData = await checkResponse.text();
      let checkData: RegisterResponse;
      try {
        checkData = JSON.parse(checkTextData);
      } catch (parseError) {
        console.error('Email check response is not JSON:', checkTextData);
        setMessage({ text: 'Network error during email check.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      if (checkResponse.status === 409) {
        setMessage({ text: 'Email already exists. Please use a different email.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
    } catch (error) {
      console.error('Email check error:', error);
      setMessage({ text: 'Network error during email check.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    // Submit registration
    try {
      const response = await fetch(`${API_URL}/api/technicians-register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: `${name} ${surname}`,
          address,
          phone_number: phoneNumber,
          pspla_number: psplaNumber,
          nzbn_number: nzbnNumber || undefined,
          public_liability_insurance: publicLiabilityInsurance,
          city,
          postal_code: postalCode,
          service_regions: serviceRegions,
        }),
      });
      const textData = await response.text();
      let data: RegisterResponse;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Registration response is not JSON:', textData);
        setMessage({ text: `Network error: Invalid server response - ${textData.substring(0, 100)}...`, type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      console.log('Registration response:', { status: response.status, data });

      if (response.ok) {
        setMessage({ text: data.message || 'Verification email sent. Please check your inbox to complete registration.', type: 'success' });
        setTimeout(() => navigate('/technician-login'), 3000);
      } else {
        setMessage({ text: `Registration failed: ${data.error || 'Unknown error'}`, type: 'error' });
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  const handleButtonClick = () => {
    if (formRef.current) {
      const formEvent = new Event('submit', { bubbles: true, cancelable: true });
      formRef.current.dispatchEvent(formEvent);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center mb-6 bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent">
            Technician Registration
          </h2>
          {message.text && (
            <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Name"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="surname" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Surname
              </label>
              <input
                type="text"
                id="surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Surname"
                autoComplete="family-name"
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
                autoComplete="username"
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
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Confirm Password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Address
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Address"
                autoComplete="address-line1"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                City
              </label>
              <input
                type="text"
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="City"
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label htmlFor="postalCode" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Postal Code
              </label>
              <input
                type="text"
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                placeholder="e.g., 1010"
                aria-label="Postal Code"
                autoComplete="postal-code"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                placeholder="+64 123 456 789"
                aria-label="Phone Number"
                autoComplete="tel"
              />
            </div>
            <div>
              <label htmlFor="psplaNumber" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                PSPLA Number
              </label>
              <input
                type="text"
                id="psplaNumber"
                value={psplaNumber}
                onChange={(e) => setPsplaNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                placeholder="e.g., 123456"
                aria-label="PSPLA Number"
              />
            </div>
            <div>
              <label htmlFor="nzbnNumber" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                NZBN Number (optional)
              </label>
              <input
                type="text"
                id="nzbnNumber"
                value={nzbnNumber}
                onChange={(e) => setNzbnNumber(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                placeholder="e.g., 9429041234567"
                aria-label="NZBN Number"
              />
            </div>
            <div>
              <label htmlFor="publicLiabilityInsurance" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Public Liability Insurance
              </label>
              <select
                id="publicLiabilityInsurance"
                value={publicLiabilityInsurance == null ? '' : publicLiabilityInsurance.toString()}
                onChange={(e) => setPublicLiabilityInsurance(e.target.value === '' ? null : e.target.value === 'true')}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Public Liability Insurance"
              >
                <option value="">Select an option</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Service Regions (Select at least one)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-gray-700 border border-gray-600 rounded-md">
                {regions.map((reg) => (
                  <label key={reg} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={serviceRegions.includes(reg)}
                      onChange={() => handleCheckboxChange(reg)}
                      className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-white text-[clamp(1rem,2.5vw,1.125rem)]">{reg}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Submit Technician Registration"
              >
                <div className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4" />
                <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Register
                </div>
              </button>
              <Link
                to="/technician-login"
                className="flex-1 relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                role="button"
                aria-label="Back to Technician Login"
              >
                <div className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4" />
                <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Back to Login
                </div>
              </Link>
            </div>
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