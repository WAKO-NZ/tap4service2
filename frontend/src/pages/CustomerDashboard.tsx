/**
 * CustomerDashboard.tsx - Version V1.24
 * - Located in /frontend/src/pages/
 * - Fetches and displays data from Customer_Request table via /api/customer_request.php?path=requests.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, customer_id, region, system_types, technician_id, technician_name.
 * - Supports rescheduling, updating descriptions, and canceling requests.
 * - Polls every 1 minute (60,000 ms).
 * - Logout redirects to landing page (/).
 * - Uses date-fns-tz for date formatting.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text.
 * - Added Edit Profile button to navigate to /customer-edit-profile.
 * - Explicitly typed as React.FC to fix TypeScript error in App.tsx.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, type MouseEventHandler, type ChangeEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import deepEqual from 'deep-equal';
import { Box, Button, Card, CardContent, Typography, Container, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { FaSignOutAlt, FaHistory, FaEdit, FaTimes, FaUserEdit } from 'react-icons/fa';

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
  lastUpdated?: number;
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
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [reschedulingRequestId, setReschedulingRequestId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState<string>('');
  const [availability1, setAvailability1] = useState<Date | null>(null);
  const [availability2, setAvailability2] = useState<Date | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Customer';
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
        console.error('Fetch failed:', text, 'Status:', response.status);
        if (response.status === 403) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! Status: ${response.status} Response: ${text}`);
      }
      const data: { requests: Request[] } = await response.json();
      const sanitizedRequests = data.requests.map(req => ({
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
        lastUpdated: req.lastUpdated ?? Date.now()
      }));

      if (!deepEqual(sanitizedRequests, prevRequests.current)) {
        setRequests(sortRequests(sanitizedRequests));
        prevRequests.current = sanitizedRequests;
      }
      setMessage({ text: `Found ${sanitizedRequests.length} service request(s).`, type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      if (error.message.includes('Unauthorized')) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/customer-login');
      } else {
        setMessage({ text: error.message || 'Error fetching data. Please try again or contact support at support@tap4service.co.nz.', type: 'error' });
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

    fetchData();
    const intervalId = setInterval(fetchData, 60000); // 1 minute
    return () => clearInterval(intervalId);
  }, [customerId, role, navigate]);

  const handleEditDescription: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    const request = requests.find(req => req.id === requestId);
    setEditingRequestId(requestId);
    setNewDescription(request?.repair_description ?? '');
    setMessage({ text: 'Edit the description.', type: 'info' });
  };

  const handleConfirmEdit = async () => {
    if (!editingRequestId || !customerId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/update-description/${editingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: parseInt(customerId), repair_description: newDescription }),
        credentials: 'include',
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        data = { error: 'Server error' };
      }
      if (response.ok) {
        setMessage({ text: 'Description updated successfully!', type: 'success' });
        setRequests(prev =>
          sortRequests(prev.map(req =>
            req.id === editingRequestId ? { ...req, repair_description: newDescription, lastUpdated: Date.now() } : req
          ))
        );
        setEditingRequestId(null);
        setNewDescription('');
      } else {
        setMessage({ text: `Failed to update description: ${data.error || 'Unknown error'}`, type: 'error' });
        if (response.status === 403) {
          navigate('/customer-login');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error updating description:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleCancelEdit = () => {
    setEditingRequestId(null);
    setNewDescription('');
    setMessage({ text: '', type: '' });
  };

  const handleReschedule: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    setReschedulingRequestId(requestId);
    setAvailability1(null);
    setAvailability2(null);
    setMessage({ text: 'Select new availability times.', type: 'info' });
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingRequestId || !customerId || !availability1) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/reschedule/${reschedulingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: parseInt(customerId),
          availability_1: availability1.toISOString(),
          availability_2: availability2 ? availability2.toISOString() : null
        }),
        credentials: 'include',
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        data = { error: 'Server error' };
      }
      if (response.ok) {
        setMessage({ text: 'Request rescheduled successfully!', type: 'success' });
        setRequests(prev =>
          sortRequests(prev.map(req =>
            req.id === reschedulingRequestId
              ? {
                  ...req,
                  customer_availability_1: availability1.toISOString(),
                  customer_availability_2: availability2 ? availability2.toISOString() : null,
                  status: 'pending' as const,
                  technician_id: null,
                  technician_name: null,
                  lastUpdated: Date.now()
                }
              : req
          ))
        );
        setReschedulingRequestId(null);
        setAvailability1(null);
        setAvailability2(null);
      } else {
        setMessage({ text: `Failed to reschedule: ${data.error || 'Unknown error'}`, type: 'error' });
        if (response.status === 403) {
          navigate('/customer-login');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error rescheduling request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleCancelReschedule = () => {
    setReschedulingRequestId(null);
    setAvailability1(null);
    setAvailability2(null);
    setMessage({ text: '', type: '' });
  };

  const handleCancelRequest: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    if (window.confirm('Are you sure you want to cancel this request?')) {
      if (!customerId) return;
      handleConfirmCancel(requestId);
    }
  };

  const handleConfirmCancel = async (requestId: number) => {
    if (!customerId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: parseInt(customerId) }),
        credentials: 'include',
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        data = { error: 'Server error' };
      }
      if (response.ok) {
        setMessage({ text: 'Request cancelled successfully!', type: 'success' });
        setRequests(prev => prev.filter(req => req.id !== requestId));
      } else {
        setMessage({ text: `Failed to cancel: ${data.error || 'Unknown error'}`, type: 'error' });
        if (response.status === 403) {
          navigate('/customer-login');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error cancelling request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleEditProfile = () => {
    navigate('/customer-edit-profile');
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    setMessage({ text: 'Logged out successfully!', type: 'success' });
    setTimeout(() => navigate('/'), 1000);
  };

  const toggleExpand = (requestId: number) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
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
              Welcome, {userName}
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : message.type === 'info' ? '#3b82f6' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={fetchData}
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
              Refresh Requests
            </Button>
            <Button
              variant="contained"
              onClick={() => setShowHistory(prev => !prev)}
              sx={{
                background: 'linear-gradient(to right, #6b7280, #4b5563)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              <FaHistory style={{ marginRight: '8px' }} />
              {showHistory ? 'Hide History' : 'Show Job History'}
            </Button>
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
              Loading requests...
            </Typography>
          ) : (
            <>
              {showHistory ? (
                <>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                    Job History
                  </Typography>
                  {requests.filter(req => req.status === 'completed' || req.status === 'cancelled').length === 0 ? (
                    <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                      <CardContent>
                        <Typography sx={{ color: '#ffffff' }}>No completed or cancelled jobs.</Typography>
                      </CardContent>
                    </Card>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {requests.filter(req => req.status === 'completed' || req.status === 'cancelled').map(request => {
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
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                    Active Service Requests
                  </Typography>
                  {requests.filter(req => req.status === 'pending' || req.status === 'assigned').length === 0 ? (
                    <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                      <CardContent>
                        <Typography sx={{ color: '#ffffff' }}>No active service requests.</Typography>
                      </CardContent>
                    </Card>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {requests.filter(req => req.status === 'pending' || req.status === 'assigned').map(request => {
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
                              {(request.status === 'pending' || request.status === 'assigned') && (
                                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
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
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  )}
                </>
              )}
            </>
          )}

          <Dialog open={!!editingRequestId} onClose={handleCancelEdit}>
            <DialogTitle sx={{ backgroundColor: '#1f2937', color: '#ffffff' }}>Edit Description</DialogTitle>
            <DialogContent sx={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
              <TextField
                label="New Description"
                value={newDescription}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDescription(e.target.value)}
                fullWidth
                multiline
                rows={4}
                sx={{
                  mt: 2,
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& textarea': { color: '#ffffff' }
                  }
                }}
                InputProps={{
                  className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md'
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

          <Dialog open={!!reschedulingRequestId} onClose={handleCancelReschedule}>
            <DialogTitle sx={{ backgroundColor: '#1f2937', color: '#ffffff' }}>Reschedule Request</DialogTitle>
            <DialogContent sx={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <DateTimePicker
                  label="Availability 1"
                  value={availability1}
                  onChange={(newValue) => setAvailability1(newValue)}
                  sx={{
                    '& .MuiInputLabel-root': { color: '#ffffff' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& input': { color: '#ffffff' }
                    }
                  }}
                />
                <DateTimePicker
                  label="Availability 2 (Optional)"
                  value={availability2}
                  onChange={(newValue) => setAvailability2(newValue)}
                  sx={{
                    '& .MuiInputLabel-root': { color: '#ffffff' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& input': { color: '#ffffff' }
                    }
                  }}
                />
              </Box>
            </DialogContent>
            <DialogActions sx={{ backgroundColor: '#1f2937' }}>
              <Button
                onClick={handleConfirmReschedule}
                variant="contained"
                disabled={!availability1}
                sx={{
                  background: 'linear-gradient(to right, #22c55e, #15803d)',
                  color: '#ffffff',
                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' },
                  '&.Mui-disabled': { opacity: 0.5 }
                }}
              >
                Save
              </Button>
              <Button
                onClick={handleCancelReschedule}
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