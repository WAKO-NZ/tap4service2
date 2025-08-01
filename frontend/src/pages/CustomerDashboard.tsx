/**
 * CustomerDashboard.tsx - Version V1.2
 * - Displays customer service requests fetched from POST /api/requests.
 * - Uses customerId and role from localStorage.
 * - Includes 'Log a Problem for Tech Assistance' button linking to /log-technical-callout.
 * - Shows empty block if no requests; displays new LogTechnicalCallout requests with text wrapping.
 * - Styled with dark gradient background, gray card, blue gradient buttons, and ripple effect.
 * - Handles errors gracefully and provides logout functionality.
 * - Uses date-fns instead of Moment.js to eliminate hooks.js interference.
 * - Compatible with requests.php (V1.49).
 */
import { useState, useEffect, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FaSignOutAlt, FaPlus } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface Request {
  id: number;
  repair_description: string;
  created_at: string;
  status: string;
  customer_availability_1: string;
  customer_availability_2?: string;
  region: string;
  system_types: string[];
  technician_id?: number;
  technician_scheduled_time?: string;
  technician_note?: string;
  payment_status: string;
  technician_name?: string;
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
    console.error('Error in CustomerDashboard:', error, errorInfo);
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
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CustomerDashboard() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRequest, setNewRequest] = useState<Request | null>(null);
  const navigate = useNavigate();

  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Customer';

  useEffect(() => {
    if (!customerId || role !== 'customer') {
      console.error('Unauthorized access: customerId or role missing/invalid', { customerId, role });
      navigate('/customer-login');
      return;
    }

    console.log('Component mounted, customerId:', customerId, 'role:', role);
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
        const textData = await response.text();
        console.log('API response status:', response.status, 'Response:', textData);

        if (!response.ok) {
          let data;
          try {
            data = JSON.parse(textData);
          } catch {
            throw new Error('Invalid server response format');
          }
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
        }

        const data = JSON.parse(textData);
        setRequests(data.requests || []);
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Network error');
        console.error('Error fetching data:', error);
        setError(`Failed to load requests: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [customerId, role, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    navigate('/customer-login');
  };

  // Listen for new request from LogTechnicalCallout
  useEffect(() => {
    const handleNewRequest = (event: CustomEvent) => {
      if (event.detail && event.detail.request) {
        setNewRequest(event.detail.request);
        setRequests((prev) => [...prev, event.detail.request]);
      }
    };

    window.addEventListener('newTechnicalCallout', handleNewRequest as EventListener);
    return () => window.removeEventListener('newTechnicalCallout', handleNewRequest as EventListener);
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative max-w-7xl mx-auto z-10">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-[clamp(2rem,5vw,2.5rem)] font-bold bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent">
              Welcome, {userName}!
            </h1>
            <div className="flex space-x-4">
              <Link
                to="/log-technical-callout"
                className="relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 px-4 z-10">
                  <FaPlus className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Log a Problem for Tech Assistance
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 px-4 z-10">
                  <FaSignOutAlt className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Logout
                </div>
              </button>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl shadow-lg p-8">
            <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-bold mb-6 bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent">
              Your Service Requests
            </h2>
            {loading && <p className="text-center text-[clamp(1rem,2.5vw,1.125rem)]">Loading...</p>}
            {error && <p className="text-center text-red-500 text-[clamp(1rem,2.5vw,1.125rem)]">{error}</p>}
            {!loading && !error && requests.length === 0 && (
              <div className="bg-gray-700 rounded-lg p-6 text-center">
                <p className="text-[clamp(1rem,2.5vw,1.125rem)]">No service requests found.</p>
              </div>
            )}
            {!loading && !error && requests.length > 0 && (
              <div className="grid gap-6">
                {requests.map((request) => (
                  <div key={request.id} className="bg-gray-700 rounded-lg p-6">
                    <h3 className="text-[clamp(1.25rem,3vw,1.5rem)] font-semibold mb-2">
                      Request #{request.id}
                    </h3>
                    <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                      <strong>Description:</strong> {request.repair_description}
                    </p>
                    <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                      <strong>Created:</strong> {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                    <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                      <strong>Status:</strong> {request.status}
                    </p>
                    <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                      <strong>Region:</strong> {request.region}
                    </p>
                    <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                      <strong>System Types:</strong> {request.system_types.join(', ')}
                    </p>
                    <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                      <strong>Availability:</strong> {request.customer_availability_1}
                      {request.customer_availability_2 && `, ${request.customer_availability_2}`}
                    </p>
                    {request.technician_name && (
                      <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                        <strong>Technician:</strong> {request.technician_name}
                      </p>
                    )}
                    {request.technician_scheduled_time && (
                      <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                        <strong>Scheduled Time:</strong> {request.technician_scheduled_time}
                      </p>
                    )}
                    {request.technician_note && (
                      <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                        <strong>Technician Note:</strong> {request.technician_note}
                      </p>
                    )}
                    <p className="text-[clamp(0.875rem,2vw,1rem)]">
                      <strong>Payment Status:</strong> {request.payment_status}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {newRequest && (
              <div className="mt-6 bg-gray-700 rounded-lg p-6 border-2 border-blue-500">
                <h3 className="text-[clamp(1.25rem,3vw,1.5rem)] font-semibold mb-2">
                  New Request #{newRequest.id}
                </h3>
                <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                  <strong>Description:</strong> {newRequest.repair_description}
                </p>
                <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                  <strong>Created:</strong> {format(new Date(newRequest.created_at), 'dd/MM/yyyy HH:mm')}
                </p>
                <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                  <strong>Status:</strong> {newRequest.status}
                </p>
                <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2">
                  <strong>Region:</strong> {newRequest.region}
                </p>
                <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                  <strong>System Types:</strong> {newRequest.system_types.join(', ')}
                </p>
                <p className="text-[clamp(0.875rem,2vw,1rem)] mb-2 break-words">
                  <strong>Availability:</strong> {newRequest.customer_availability_1}
                  {newRequest.customer_availability_2 && `, ${newRequest.customer_availability_2}`}
                </p>
                <p className="text-[clamp(0.875rem,2vw,1rem)]">
                  <strong>Payment Status:</strong> {newRequest.payment_status}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}