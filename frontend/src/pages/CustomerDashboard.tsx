/**
 * CustomerDashboard.tsx - Version V6.115
 * - Fetches service requests via GET /api/requests?path=customer/:customerId.
 * - Displays job status, technician name, notes, and timestamp.
 * - Styled to match CustomerRegister.tsx with white card, purple gradient buttons, and gray background.
 * - Full-width "Log a Technical Callout" button at the top, navigating to /log-technical-callout.
 * - Top-right Edit Profile and Logout buttons.
 * - Logout clears localStorage, calls /api/logout, and redirects to / (LandingPage.tsx).
 * - Improved logout handling with fallback redirect and error logging.
 */
import { useState, useEffect, Component, type ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment-timezone';

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
      return <div className="text-center text-red-600 text-lg font-medium">Something went wrong. Please try again later.</div>;
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
      navigate('/login', { replace: true });
      return;
    }

    const fetchRequests = async () => {
      try {
        const url = `${API_URL}/api/requests?path=customer/${customerId}`;
        console.log('Fetching requests from:', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched requests:', data);
        setRequests(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Network error');
        console.error('Error fetching data:', error);
        setError(`Failed to fetch requests: ${error.message}`);
      }
    };

    fetchRequests();
  }, [customerId, role, navigate]);

  const handleLogout = async () => {
    console.log('handleLogout triggered');
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
        setError(`Logout failed: ${textData || 'Server error'}`);
        // Proceed with client-side cleanup and redirect
      }
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Logout failed: Network error');
    }
    // Clear localStorage
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    console.log('localStorage cleared, redirecting to /');
    setError('Logged out successfully!');
    navigate('/', { replace: true });
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr || !moment(dateStr, moment.ISO_8601, true).isValid()) return 'Not specified';
    return moment.tz(dateStr, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Welcome, {userName}</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/customer-edit-profile')}
                className="bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Edit Profile
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate('/log-technical-callout')}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200 mb-6"
          >
            Log a Technical Callout to Attend to Your Problem
          </button>
          {error && (
            <p className="text-center mb-6 text-lg font-medium text-red-600">{error}</p>
          )}
          {requests.length === 0 && !error && (
            <p className="text-center text-lg font-medium text-gray-600">No service requests found.</p>
          )}
          {requests.length > 0 && (
            <div className="space-y-6">
              {requests.map((request) => (
                <div key={request.id} className="border border-gray-300 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800">Request #{request.id}</h3>
                  <p className="text-gray-600"><strong>Description:</strong> {request.repair_description || 'Unknown'}</p>
                  <p className="text-gray-600"><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                  <p className="text-gray-600"><strong>Region:</strong> {request.region || 'Not provided'}</p>
                  <p className="text-gray-600"><strong>Created At:</strong> {formatDateTime(request.created_at)}</p>
                  <p className="text-gray-600"><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                  <p className="text-gray-600"><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                  <p className="text-gray-600"><strong>Technician:</strong> {request.technician_name || 'Not assigned'}</p>
                  <p className="text-gray-600"><strong>Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                  <p className="text-gray-600"><strong>Technician Note:</strong> {request.technician_note || 'None'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}