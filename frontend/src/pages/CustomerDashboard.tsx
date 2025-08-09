/**
 * CustomerDashboard.tsx - Version V1.36
 * - Located in /frontend/src/pages/
 * - Fetches and displays data from Customer_Request table via /api/customer_request.php?path=requests.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, customer_id, region, system_types, technician_id, technician_name.
 * - Supports updating descriptions, canceling requests, and confirming job completion.
 * - Reschedule navigates to /log-technical-callout?requestId={requestId}.
 * - Polls every 1 minute (60,000 ms).
 * - Logout redirects to landing page (/).
 * - Uses date-fns-tz for date formatting.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text.
 * - Added Edit Profile button to navigate to /customer-edit-profile.
 * - Added Log a Callout button (double-sized, full-width, at top) to navigate to /log-technical-callout.
 * - Fixed TypeScript errors in Dialog components (rows, sx, InputProps).
 * - Updated Active Service Requests to stack buttons vertically.
 * - Added Confirm Job Complete button for status='completed_technician', sending PUT /api/requests/confirm-complete/{requestId}.
 * - Job History button navigates to /customer-job-history.
 * - Removed dialog to confirm technician_note before completing job; now directly marks as complete on button press.
 * - Updated welcome section to display name, surname, email, address (address, suburb, city, postal_code), and phone number via GET /api/customer_request.php.
 * - Added error handling for undefined requests in fetchData.
 * - Fixed TypeScript error for implicit 'any' type in fetchData map function.
 * - Improved error handling in handleConfirmComplete to use response.text() and attempt JSON parse, to handle non-JSON 500 errors gracefully.
 * - Filtered requests to show only active ones (pending, assigned, completed_technician) under Active Service Requests; completed and cancelled are shown in Job History.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, type MouseEventHandler, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import deepEqual from 'deep-equal';
import { Box, Button, Card, CardContent, Typography, Container, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FaSignOutAlt, FaHistory, FaEdit, FaTimes, FaUserEdit, FaPlus, FaCheck } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface Request {
  id: number;
  repair_description: string | null;
  created_at: string | null;
  status: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  region: string | null;
  system_types: string[];
  technician_id: number | null;
  technician_name: string | null;
  customer_id: number | null;
  technician_note: string | null;
  lastUpdated?: number;
}

interface CustomerProfile {
  id: number;
  email: string;
  name: string;
  surname: string;
  region: string | null;
  address: string | null;
  suburb: string | null;
  phone_number: string | null;
  alternate_phone_number: string | null;
  city: string | null;
  postal_code: string | null;
}

interface ExpandedRequests {
  [key: number]: boolean;
}

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
      return (
        <div className="text-center text-[#ffffff] p-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#ffffff' }}>Something went wrong</h2>
          <p style={{ color: '#ffffff' }}>
            Please try refreshing the page or contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline" style={{ color: '#3b82f6' }}>
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4 flex space-x-2 justify-center">
            <Button
              onClick={() => window.location.reload()}
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CustomerDashboard: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState<string>('');
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const prevRequests = useRef<Request[]>([]);
  const hasFetched = useRef(false);

  const sortRequests = (requests: Request[]): Request[] => {
    return [...requests].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA; // Latest first
    });
  };

  async function retryFetch<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        console.error(`Retry attempt ${attempt} failed:`, err);
        if (attempt === retries) throw err;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error('Retry limit reached');
  }

  const fetchCustomerProfile = async () => {
    try {
      console.log('Fetching customer profile for customerId:', customerId);
      const response = await retryFetch(() =>
        fetch(`${API_URL}/api/customer_request.php`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );
      if (!response.ok) {
        const text = await response.text();
        console.error('Fetch profile failed:', text, 'Status:', response.status);
        if (response.status === 403) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! Status: ${response.status} Response: ${text}`);
      }
      const data: { customer: CustomerProfile } = await response.json();
      setCustomerProfile(data.customer);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching customer profile:', error);
      if (error.message.includes('Unauthorized')) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/customer-login');
      } else {
        setMessage({ text: error.message || 'Error fetching profile data. Please try again or contact support at support@tap4service.co.nz.', type: 'error' });
      }
    }
  };

  const fetchData = async () => {
    if (!customerId || role !== 'customer') {
      console.error('Invalid session: customerId or role missing', { customerId, role });
      setMessage({ text: 'Please log in as a customer to view your dashboard.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Fetching requests for customerId:', customerId);
      const response = await retryFetch(() =>
        fetch(`${API_URL}/api/customer_request.php?path=requests`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );
      if (!response.ok) {
        const text = await response.text();
        console.error('Fetch requests failed:', text, 'Status:', response.status);
        if (response.status === 403) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! Status: ${response.status} Response: ${text}`);
      }
      const data: { requests: Request[] } = await response.json();
      console.log('Raw response data:', data);
      const sanitizedRequests = (data.requests || [])
        .filter(req => req.customer_id === parseInt(customerId ?? '0'))
        .map(req => ({
          id: req.id ?? 0,
          repair_description: req.repair_description ?? 'Unknown',
          created_at: req.created_at ?? null,
          status: req.status ?? 'pending',
          customer_availability_1: req.customer_availability_1 ?? null,
          customer_availability_2: req.customer_availability_2 ?? null,
          region: req.region ?? null,
          system_types: req.system_types ?? [],
          technician_id: req.technician_id ?? null,
          technician_name: req.technician_name ?? null,
          customer_id: req.customer_id ?? null,
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));
      console.log('Sanitized requests:', sanitizedRequests);

      const activeRequests = sanitizedRequests.filter(req => ['pending', 'assigned', 'completed_technician'].includes(req.status));

      if (!deepEqual(activeRequests, prevRequests.current)) {
        setRequests(sortRequests(activeRequests));
        prevRequests.current = activeRequests;
      }
      setMessage({ text: `Found ${activeRequests.length} active request(s).`, type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching requests:', error);
      if (error.message.includes('Unauthorized')) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/customer-login');
      } else {
        setMessage({ text: error.message || 'Error fetching request data. Please try again or contact support at support@tap4service.co.nz.', type: 'error' });
      }
      setRequests([]);
    } finally {
      setIsLoading(false);
      hasFetched.current = true;
    }
  };

  useEffect(() => {
    if (!customerId || role !== 'customer') {
      console.error('Invalid session on mount: customerId or role missing', { customerId, role });
      setMessage({ text: 'Please log in as a customer to view your dashboard.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    fetchCustomerProfile();
    fetchData();
    const intervalId = setInterval(fetchData, 60000); // 1 minute
    return () => clearInterval(intervalId);
  }, [customerId, role, navigate]);

  const handleLogout = () => {
    localStorage.clear();
    setMessage({ text: 'Logged out successfully.', type: 'success' });
    navigate('/');
  };

  const handleEditProfile = () => {
    navigate('/customer-edit-profile');
  };

  const handleJobHistory = () => {
    navigate('/customer-job-history');
  };

  const handleLogCallout = () => {
    navigate('/log-technical-callout');
  };

  const toggleExpand = (requestId: number) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const handleEditDescription = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = parseInt(e.currentTarget.dataset.id ?? '0');
    const request = requests.find(req => req.id === id);
    if (request) {
      setEditingRequestId(id);
      setNewDescription(request.repair_description ?? '');
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingRequestId || !newDescription.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/${editingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_description: newDescription.trim() }),
        credentials: 'include',
      });
      if (!response.ok) {
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
          throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        } catch {
          throw new Error(text || `HTTP error! Status: ${response.status}`);
        }
      }
      setMessage({ text: 'Description updated successfully.', type: 'success' });
      setEditingRequestId(null);
      setNewDescription('');
      fetchData(); // Refresh
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error updating description:', error);
      setMessage({ text: error.message || 'Failed to update description.', type: 'error' });
    }
  };

  const handleCancelEdit = () => {
    setEditingRequestId(null);
    setNewDescription('');
  };

  const handleReschedule = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = parseInt(e.currentTarget.dataset.id ?? '0');
    navigate(`/log-technical-callout?requestId=${id}`);
  };

  const handleCancelRequest = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = parseInt(e.currentTarget.dataset.id ?? '0');
    navigate(`/cancel-request?requestId=${id}`);
  };

  const handleConfirmComplete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = parseInt(e.currentTarget.dataset.id ?? '0');
    try {
      const response = await fetch(`${API_URL}/api/requests/confirm-complete/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
          throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        } catch {
          throw new Error(text || `HTTP error! Status: ${response.status}`);
        }
      }
      setMessage({ text: 'Job confirmed as complete.', type: 'success' });
      fetchData(); // Refresh
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error confirming job complete:', error);
      setMessage({ text: error.message || 'Failed to confirm job complete.', type: 'error' });
    }
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Not specified';
    try {
      return formatInTimeZone(new Date(dateStr), 'Pacific/Auckland', 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return 'Invalid date';
    }
  };

  const DESCRIPTION_LIMIT = 100;

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="md" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Welcome, {customerProfile ? `${customerProfile.name} ${customerProfile.surname || ''}` : 'Customer'}
            </Typography>
          </Box>

          {customerProfile && (
            <Box sx={{ mb: 4, backgroundColor: '#1f2937', p: 4, borderRadius: '12px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Your Profile
              </Typography>
              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                <strong>Email:</strong> {customerProfile.email}
              </Typography>
              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                <strong>Address:</strong> {customerProfile.address || ''}, {customerProfile.suburb || ''}, {customerProfile.city || ''}, {customerProfile.postal_code || ''}
              </Typography>
              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                <strong>Phone:</strong> {customerProfile.phone_number || 'Not provided'}
              </Typography>
              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                <strong>Alternate Phone:</strong> {customerProfile.alternate_phone_number || 'Not provided'}
              </Typography>
            </Box>
          )}

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : message.type === 'info' ? '#3b82f6' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <Button
              variant="contained"
              onClick={handleLogCallout}
              sx={{
                width: '100%',
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '16px 32px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              <FaPlus style={{ marginRight: '8px' }} />
              Log a Callout
            </Button>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={handleEditProfile}
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              <FaUserEdit style={{ marginRight: '8px' }} />
              Edit Profile
            </Button>
            <Button
              variant="contained"
              onClick={handleJobHistory}
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              <FaHistory style={{ marginRight: '8px' }} />
              Job History
            </Button>
            <Button
              variant="contained"
              onClick={handleLogout}
              sx={{
                background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              <FaSignOutAlt style={{ marginRight: '8px' }} />
              Logout
            </Button>
          </Box>

          {isLoading && !hasFetched.current ? (
            <Typography sx={{ textAlign: 'center', color: '#ffffff' }}>
              Loading service requests...
            </Typography>
          ) : (
            <>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Active Service Requests
              </Typography>
              {requests.length === 0 ? (
                <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                  <CardContent>
                    <Typography sx={{ color: '#ffffff' }}>No active service requests.</Typography>
                  </CardContent>
                </Card>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {requests.map(request => {
                    const isExpanded = expandedRequests[request.id] || false;
                    const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                    const displayDescription = isExpanded || !isLong
                      ? request.repair_description ?? 'Unknown'
                      : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                    const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                    return (
                      <Card
                        key={request.id}
                        sx={{
                          backgroundColor: '#1f2937',
                          color: '#ffffff',
                          p: 2,
                          borderRadius: '12px',
                          border: isRecentlyUpdated ? '2px solid #3b82f6' : 'none'
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', color: '#ffffff' }}>
                            Request #{request.id}
                          </Typography>
                          <Typography sx={{ mb: 1, wordBreak: 'break-word', color: '#ffffff' }}>
                            <strong>Repair Description:</strong> {displayDescription}
                            {isLong && (
                              <Button
                                onClick={() => toggleExpand(request.id)}
                                sx={{ ml: 2, color: '#3b82f6' }}
                              >
                                {isExpanded ? 'Show Less' : 'Show More'}
                              </Button>
                            )}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Created At:</strong> {formatDateTime(request.created_at)}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Region:</strong> {request.region ?? 'Not provided'}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>System Types:</strong> {request.system_types.length > 0 ? request.system_types.join(', ') : 'None'}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Technician:</strong> {request.technician_name ?? 'Not assigned'}
                          </Typography>
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Technician Note:</strong> {request.technician_note ?? 'No note provided'}
                          </Typography>
                          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {(request.status === 'pending' || request.status === 'assigned') && (
                              <>
                                <Button
                                  data-id={request.id}
                                  onClick={handleEditDescription}
                                  variant="contained"
                                  sx={{
                                    background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    borderRadius: '24px',
                                    padding: '12px 24px',
                                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                  }}
                                >
                                  <FaEdit style={{ marginRight: '8px' }} />
                                  Edit Description
                                </Button>
                                <Button
                                  data-id={request.id}
                                  onClick={handleReschedule}
                                  variant="contained"
                                  sx={{
                                    background: 'linear-gradient(to right, #eab308, #ca8a04)',
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    borderRadius: '24px',
                                    padding: '12px 24px',
                                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                  }}
                                >
                                  <FaEdit style={{ marginRight: '8px' }} />
                                  Reschedule
                                </Button>
                                <Button
                                  data-id={request.id}
                                  onClick={handleCancelRequest}
                                  variant="contained"
                                  sx={{
                                    background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    borderRadius: '24px',
                                    padding: '12px 24px',
                                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                  }}
                                >
                                  <FaTimes style={{ marginRight: '8px' }} />
                                  Cancel Request
                                </Button>
                              </>
                            )}
                            {request.status === 'completed_technician' && (
                              <Button
                                data-id={request.id}
                                onClick={handleConfirmComplete}
                                variant="contained"
                                sx={{
                                  background: 'linear-gradient(to right, #22c55e, #15803d)',
                                  color: '#ffffff',
                                  fontWeight: 'bold',
                                  borderRadius: '24px',
                                  padding: '12px 24px',
                                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                }}
                              >
                                <FaCheck style={{ marginRight: '8px' }} />
                                Confirm Job Complete
                              </Button>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </>
          )}

          <Dialog open={!!editingRequestId} onClose={handleCancelEdit}>
            <DialogTitle sx={{ backgroundColor: '#1f2937', color: '#ffffff' }}>Edit Description</DialogTitle>
            <DialogContent sx={{ backgroundColor: '#1f2937', color: '#ffffff', pt: 2 }}>
              <TextField
                label="New Description"
                value={newDescription}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDescription(e.target.value)}
                fullWidth
                multiline
                rows={4}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& textarea': { color: '#ffffff' }
                  }
                }}
                InputProps={{
                  sx: { backgroundColor: '#374151', borderRadius: '8px' }
                }}
              />
            </DialogContent>
            <DialogActions sx={{ backgroundColor: '#1f2937' }}>
              <Button
                onClick={handleConfirmEdit}
                variant="contained"
                sx={{
                  background: 'linear-gradient(to right, #22c55e, #15803d)',
                  color: '#ffffff',
                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                }}
              >
                Save
              </Button>
              <Button
                onClick={handleCancelEdit}
                variant="outlined"
                sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
              >
                Cancel
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CustomerDashboard;