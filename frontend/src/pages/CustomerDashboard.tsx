/**
 * CustomerDashboard.tsx - Version V6.121
 * - Fetches customer service requests from the database via POST /api/requests with path=customer/:customerId.
 * - Displays job status, technician name, notes, and timestamps.
 * - Styled to match CustomerRegister.tsx with dark gradient background, gray card, blue gradient buttons, and ripple effect.
 * - Full-width "Log a Technical Callout" button at the top, navigating to /log-technical-callout.
 * - Top-right Edit Profile and Logout buttons with consistent blue gradient styling.
 * - Logout clears localStorage, calls /api/logout, and redirects to / (LandingPage.tsx).
 * - Enhanced error handling for session validation and API errors.
 * - Uses POST instead of GET to comply with MyHost deployment restrictions.
 */
import { useState, useEffect, Component, type ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment-timezone';
import { FaWrench } from 'react-icons/fa';

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
    console.error('Error in CustomerDashboard:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-center text-red-500 text-[clamp(1rem,2.5vw,1.125rem)] p-8">Something went wrong. Please try again later.</div>;
    }
    return this.props.children;
  }
}

interface ServiceRequest {
  id: number;
  repair_description: string | null;
  created_at: string | null;
  status: string;
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  technician_scheduled_time: string | null;
  technician_id: number | null;
  technician_name: string | null;
  region: string | null;
  technician_note: string | null;
  system_types: string[] | null;
}

export default function CustomerDashboard() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Customer';

  useEffect(() => {
    console.log('Component mounted, customerId:', customerId, 'role:', role);
    if (!customerId || role !== 'customer') {
      setError('Please log in as a customer.');
      setTimeout(() => navigate('/customer-login'), 1000);
      return;
    }

    const fetchRequests = async () => {
      try {
        const url = `${API_URL}/api/requests`;
        console.log('Fetching requests from:', url);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: `customer/${customerId}` }),
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
        console.log('Fetched requests:', data);
        if (data.requests) {
          setRequests(data.requests);
        } else {
          setRequests([]);
        }
        setError('');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Network error');
        console.error('Error fetching data:', error);
        setError(`Failed to fetch requests: ${error.message}`);
      }
    };

    fetchRequests();
  }, [customerId, role, navigate]);

  const handleLogout = async () => {
    console.log('Logout initiated');
    try {
      const response = await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const textData = await response.text();
      console.log('Logout response: Status:', response.status, 'Response:', textData);
      if (!response.ok) {
        console.warn('Logout request failed:', response.status, textData);
      } else {
        console.log('Logout successful:', textData);
      }
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      localStorage.removeItem('userId');
      localStorage.removeItem('role');
      localStorage.removeItem('userName');
      console.log('localStorage cleared, redirecting to /');
      navigate('/', { replace: true });
    }
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr || !moment(dateStr, moment.ISO_8601, true).isValid()) return 'Not specified';
    return moment.tz(dateStr, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent">
              Welcome, {userName}
            </h2>
            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/customer-edit-profile')}
                className="relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  Edit Profile
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  Logout
                </div>
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate('/log-technical-callout')}
            className="w-full relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white mb-6"
          >
            <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
            <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
            <div className="relative flex items-center justify-center h-12 z-10">
              <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
              Log a Technical Callout
            </div>
          </button>
          {error && (
            <p className="text-center mb-6 text-[clamp(1rem,2.5vw,1.125rem)] text-red-500">{error}</p>
          )}
          {requests.length === 0 && !error && (
            <p className="text-center text-[clamp(1rem,2.5vw,1.125rem)] text-gray-400">No service requests found.</p>
          )}
          {requests.length > 0 && (
            <div className="space-y-6">
              {requests.map((request) => (
                <div key={request.id} className="border border-gray-600 rounded-md p-6 bg-gray-700">
                  <h3 className="text-[clamp(1.25rem,3vw,1.5rem)] font-semibold text-white">Request #{request.id}</h3>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Description:</strong> {request.repair_description || 'Unknown'}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Region:</strong> {request.region || 'Not provided'}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>System Types:</strong> {request.system_types?.join(', ') || 'Not specified'}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Created At:</strong> {formatDateTime(request.created_at)}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Technician:</strong> {request.technician_name || 'Not assigned'}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                  <p className="text-gray-400 text-[clamp(1rem,2.5vw,1.125rem)]"><strong>Technician Note:</strong> {request.technician_note || 'None'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}