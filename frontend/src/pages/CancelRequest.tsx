/**
 * CancelRequest.tsx - Version V1.0
 * - Located in /frontend/src/pages/
 * - Displays a confirmation page for cancelling a service request.
 * - Warns about a $45.00 cancellation fee that will be processed.
 * - Fetches request details from /api/requests/customer/:customerId.
 * - Submits cancellation to /api/requests/cancel/:requestId.
 * - Includes Back to Dashboard button to navigate to /customer-dashboard.
 * - Styled with dark gradient background, gray card, blue/red gradient buttons, white text.
 * - Uses date-fns-tz for date formatting.
 */
import { useState, useEffect, Component, type ErrorInfo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { Box, Button, Card, CardContent, Typography, Container } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';

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
  technician_name: string | null;
  technician_phone: string | null;
  customer_id: number | null;
  technician_note: string | null;
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
    console.error('Error in CancelRequest:', error, errorInfo);
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

const CancelRequest: React.FC = () => {
  const [request, setRequest] = useState<Request | null>(null);
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Customer';
  const query = new URLSearchParams(location.search);
  const requestId = query.get('requestId');

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

  const fetchRequest = async () => {
    if (!customerId || role !== 'customer') {
      console.error('Invalid session: customerId or role missing', { customerId, role });
      setMessage({ text: 'Please log in as a customer to cancel a request.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    if (!requestId) {
      setMessage({ text: 'No request ID provided.', type: 'error' });
      navigate('/customer-dashboard');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Fetching request details for requestId:', requestId);
      const response = await retryFetch(() =>
        fetch(`${API_URL}/api/requests/customer/${customerId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );
      if (!response.ok) {
        const text = await response.text();
        console.error('Fetch failed:', { status: response.status, response: text });
        if (response.status === 403) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! Status: ${response.status} Response: ${text}`);
      }
      const data: { requests: Request[] } = await response.json();
      console.log('Raw response data:', data);
      const selectedRequest = data.requests.find(req => req.id === Number(requestId));
      if (!selectedRequest) {
        throw new Error('Request not found.');
      }
      setRequest(selectedRequest);
      setMessage({ text: '', type: '' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching request:', error);
      if (error.message.includes('Unauthorized')) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/customer-login');
      } else {
        setMessage({ text: error.message || 'Failed to load request details. Please try again.', type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [customerId, role, requestId, navigate]);

  const handleConfirmCancel = async () => {
    if (!requestId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/cancel/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      setMessage({ text: 'Request cancelled successfully. A $45.00 cancellation fee will be processed.', type: 'success' });
      setTimeout(() => navigate('/customer-dashboard'), 2000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error cancelling request:', error);
      setMessage({ text: error.message || 'Failed to cancel request.', type: 'error' });
    }
  };

  const handleBackToDashboard = () => {
    navigate('/customer-dashboard');
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Not specified';
    try {
      return formatInTimeZone(new Date(dateStr), 'Pacific/Auckland', 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="md" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Cancel Service Request for {userName}
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          {isLoading ? (
            <Typography sx={{ textAlign: 'center', color: '#ffffff' }}>
              Loading request details...
            </Typography>
          ) : request ? (
            <>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Confirm Cancellation
              </Typography>
              <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                <CardContent>
                  <Typography sx={{ mb: 1, color: '#ffffff' }}>
                    <strong>Request ID:</strong> {request.id}
                  </Typography>
                  <Typography sx={{ mb: 1, wordBreak: 'break-word', color: '#ffffff' }}>
                    <strong>Repair Description:</strong> {request.repair_description ?? 'Unknown'}
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
                  {request.technician_phone && (
                    <Typography sx={{ mb: 1, color: '#ffffff' }}>
                      <strong>Technician Phone:</strong> {request.technician_phone}
                    </Typography>
                  )}
                  <Typography sx={{ mb: 1, color: '#ffffff' }}>
                    <strong>Technician Note:</strong> {request.technician_note ?? 'No note provided'}
                  </Typography>
                  <Typography sx={{ mt: 2, color: '#ef4444', fontWeight: 'bold' }}>
                    Warning: Cancelling this request will incur a $45.00 cancellation fee, which will be processed to your registered payment method. This fee covers administrative costs and technician scheduling adjustments. Please confirm to proceed.
                  </Typography>
                </CardContent>
              </Card>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 4, flexWrap: 'wrap' }}>
                <Button
                  onClick={handleConfirmCancel}
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
                  Confirm Cancellation
                </Button>
                <Button
                  onClick={handleBackToDashboard}
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
                  <FaArrowLeft style={{ marginRight: '8px' }} />
                  Back to Dashboard
                </Button>
              </Box>
            </>
          ) : (
            <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
              <CardContent>
                <Typography sx={{ color: '#ffffff' }}>Request not found.</Typography>
              </CardContent>
            </Card>
          )}
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CancelRequest;