// File: src/components/TechnicianEditProfile.tsx
/**
 * TechnicianEditProfile.tsx - Version V1.4
 * - Allows technicians to edit their profile details.
 * - Optionally allows changing the password with confirmation.
 * - Submits updates to /api/technicians-update.php.
 * - Fetches profile from /api/technician-profile.php.
 * - Improved error handling for API fetch with specific 403/500 messages.
 * - Added autocomplete attributes for accessibility.
 * - Removed required attribute from read-only email input to avoid validation conflicts.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserEdit, FaLock } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface ProfileData {
  id: number;
  email: string;
  name: string;
  address?: string;
  phone_number?: string;
  city?: string;
  postal_code?: string;
  pspla_number?: string;
  nzbn_number?: string;
  public_liability_insurance: boolean;
  service_regions?: string[];
}

interface UpdateResponse {
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
    console.error('Error in TechnicianEditProfile:', error, errorInfo);
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

export default function TechnicianEditProfile() {
  const [profile, setProfile] = useState<ProfileData>({
    id: parseInt(localStorage.getItem('userId') || '0'),
    email: '',
    name: '',
    address: '',
    phone_number: '',
    city: '',
    postal_code: '',
    pspla_number: '',
    nzbn_number: '',
    public_liability_insurance: false,
    service_regions: [],
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!profile.id) {
      setMessage({ text: 'Please log in to edit your profile.', type: 'error' });
      navigate('/technician-login');
      return;
    }

    fetch(`${API_URL}/api/technician-profile.php`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Unauthorized: Please log in again.');
          } else if (response.status === 500) {
            throw new Error('Server error: Unable to fetch profile. Please try again or contact support.');
          }
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProfile((prev) => ({ ...prev, ...data.profile }));
      })
      .catch((error) => {
        console.error('Error fetching profile:', error);
        setMessage({ text: error.message || 'Failed to load profile. Please try again or contact support.', type: 'error' });
      });
  }, [profile.id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    const updateData = {
      ...profile,
      ...(newPassword && { password: newPassword }),
    };

    try {
      const response = await fetch(`${API_URL}/api/technicians-update.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        credentials: 'include',
      });
      const textData = await response.text();
      let data: UpdateResponse;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Update response is not JSON:', textData);
        setMessage({ text: `Network error: ${textData.substring(0, 100)}...`, type: 'error' });
        return;
      }

      if (response.ok) {
        setMessage({ text: data.message || 'Profile updated successfully!', type: 'success' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => navigate('/technician-dashboard'), 2000);
      } else {
        setMessage({ text: data.error || 'Failed to update profile.', type: 'error' });
      }
    } catch (error: unknown) {
      console.error('Update error:', error);
      setMessage({ text: 'Network error. Please try again or contact support.', type: 'error' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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
            Edit Technician Profile
          </h2>
          {message.text && (
            <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={profile.email}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Email"
                autoComplete="username"
                readOnly
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={profile.name}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Name"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={profile.address || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Address"
                autoComplete="address-line1"
              />
            </div>
            <div>
              <label htmlFor="phone_number" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={profile.phone_number || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Phone Number"
                autoComplete="tel"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={profile.city || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="City"
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label htmlFor="postal_code" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Postal Code
              </label>
              <input
                type="text"
                id="postal_code"
                name="postal_code"
                value={profile.postal_code || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Postal Code"
                autoComplete="postal-code"
              />
            </div>
            <div>
              <label htmlFor="pspla_number" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                PSPLA Number
              </label>
              <input
                type="text"
                id="pspla_number"
                name="pspla_number"
                value={profile.pspla_number || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="PSPLA Number"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="nzbn_number" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                NZBN Number
              </label>
              <input
                type="text"
                id="nzbn_number"
                name="nzbn_number"
                value={profile.nzbn_number || ''}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="NZBN Number"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="public_liability_insurance"
                name="public_liability_insurance"
                checked={profile.public_liability_insurance || false}
                onChange={handleChange}
                className="mr-2"
              />
              <label htmlFor="public_liability_insurance" className="text-[clamp(1rem,2.5vw,1.125rem)]">
                Public Liability Insurance
              </label>
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                New Password (Optional)
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="New Password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                aria-label="Confirm New Password"
                autoComplete="new-password"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Submit Profile Update"
                onClick={handleButtonClick}
              >
                <div className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4" />
                <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaUserEdit className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Update Profile
                </div>
              </button>
              <Link
                to="/technician-dashboard"
                className="flex-1 relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Back to Technician Dashboard"
              >
                <div className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4" />
                <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaLock className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Back to Dashboard
                </div>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}