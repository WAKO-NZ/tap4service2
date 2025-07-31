/**
 * RequestTechnician.tsx - Version V1.1
 * - Allows customers to request a technician with address details.
 * - Submits a new service request to /api/requests/create.php.
 * - Displays success or error messages with improved validation.
 * - Added console logging for debugging.
 */
import { useState, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserPlus } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface RequestData {
  customer_id: number;
  repair_description: string;
  customer_availability_1: string;
  customer_availability_2: string;
  region: string;
  customer_address?: string;
  customer_city?: string;
  customer_postal_code?: string;
}

interface Response {
  message?: string;
  error?: string;
}

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
    console.error('Error in RequestTechnician:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-red-500 p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline">
              support@tap4service.co.nz
            </a>.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RequestTechnician() {
  const [formData, setFormData] = useState<RequestData>({
    customer_id: parseInt(localStorage.getItem('userId') || '0'),
    repair_description: '',
    customer_availability_1: '',
    customer_availability_2: '',
    region: '',
    customer_address: '',
    customer_city: '',
    customer_postal_code: '',
  });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    console.log('Submitting form data:', formData); // Debug log
    if (!formData.customer_id || !formData.repair_description || !formData.customer_availability_1 || !formData.region) {
      setMessage({ text: 'All fields are required except secondary availability, address, city, and postal code.', type: 'error' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/requests/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const textData = await response.text();
      console.log('API response:', textData); // Debug log
      let data: Response;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Response is not JSON:', textData);
        setMessage({ text: `Network error: ${textData.substring(0, 100)}...`, type: 'error' });
        return;
      }

      if (response.ok) {
        setMessage({ text: data.message || 'Request submitted successfully!', type: 'success' });
        setFormData({
          ...formData,
          repair_description: '',
          customer_availability_1: '',
          customer_availability_2: '',
          region: '',
          customer_address: '',
          customer_city: '',
          customer_postal_code: '',
        });
        setTimeout(() => navigate('/'), 2000); // Redirect to landing page after success
      } else {
        setMessage({ text: data.error || 'Failed to submit request.', type: 'error' });
      }
    } catch (error: unknown) {
      console.error('Submit error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
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
            Request a Technician
          </h2>
          {message.text && (
            <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="repair_description" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Repair Description
              </label>
              <textarea
                id="repair_description"
                name="repair_description"
                value={formData.repair_description}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Repair Description"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="customer_availability_1" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Availability 1 (Required)
              </label>
              <input
                type="datetime-local"
                id="customer_availability_1"
                name="customer_availability_1"
                value={formData.customer_availability_1}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Availability 1"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="customer_availability_2" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Availability 2 (Optional)
              </label>
              <input
                type="datetime-local"
                id="customer_availability_2"
                name="customer_availability_2"
                value={formData.customer_availability_2}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Availability 2"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="region" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Region
              </label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Region"
              >
                <option value="">Select a region</option>
                <option value="Auckland">Auckland</option>
                <option value="Bay of Plenty">Bay of Plenty</option>
                <option value="Canterbury">Canterbury</option>
                <option value="Gisborne">Gisborne</option>
                <option value="Hawkes Bay">Hawkes Bay</option>
                <option value="Manawatu-Whanganui">Manawatu-Whanganui</option>
                <option value="Marlborough">Marlborough</option>
                <option value="Nelson">Nelson</option>
                <option value="Northland">Northland</option>
                <option value="Otago">Otago</option>
                <option value="Southland">Southland</option>
                <option value="Taranaki">Taranaki</option>
                <option value="Tasman">Tasman</option>
                <option value="Waikato">Waikato</option>
                <option value="Wellington">Wellington</option>
                <option value="West Coast">West Coast</option>
              </select>
            </div>
            <div>
              <label htmlFor="customer_address" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Address (Optional)
              </label>
              <input
                type="text"
                id="customer_address"
                name="customer_address"
                value={formData.customer_address || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Address"
                autoComplete="address-line1"
              />
            </div>
            <div>
              <label htmlFor="customer_city" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                City (Optional)
              </label>
              <input
                type="text"
                id="customer_city"
                name="customer_city"
                value={formData.customer_city || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="City"
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label htmlFor="customer_postal_code" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Postal Code (Optional)
              </label>
              <input
                type="text"
                id="customer_postal_code"
                name="customer_postal_code"
                value={formData.customer_postal_code || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Postal Code"
                autoComplete="postal-code"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Submit Technician Request"
                onClick={handleButtonClick}
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaUserPlus className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Submit Request
                </div>
              </button>
              <Link
                to="/"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Back to Landing Page"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaUserPlus className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Back to Home
                </div>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}