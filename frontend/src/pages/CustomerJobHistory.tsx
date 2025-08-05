/**
 * CustomerJobHistory.tsx - Version V1.2
 * - Located in /frontend/src/pages/
 * - Displays completed and cancelled jobs from Customer_Request table via /api/customer_request.php?path=requests.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, region, system_types, technician_name, technician_note.
 * - Fetches data for customer_id matching userId.
 * - Includes Back to Dashboard button to navigate to /customer-dashboard.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text.
 * - Uses date-fns-tz for date formatting.
 * - Added technician_note display with fallback.
 * - Enhanced logging to debug no jobs displaying.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import deepEqual from 'deep-equal';
import { Box, Button, Card, CardContent, Typography, Container } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FaArrowLeft } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface Request {
  id: number;
  repair_description: string | null;
  created_at: string | null;
  status: 'completed' | 'cancelled';
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  region: string | null;
  system_types: string[];
  technician_name: string | null;
  customer_id: number | null;
  technician_note: string | null;
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
    console.error('Error in CustomerJobHistory:', error, errorInfo);
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

const CustomerJobHistory: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
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
      setMessage({ text: 'Please log in as a customer to view your job history.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Fetching job history for customerId:', customerId);
      const response = await retryFetch(() =>
        fetch(`${API_URL}/api/customer_request.php?path=requests`, {
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
      const sanitizedRequests = data.requests
        .filter(req => req.status === 'completed' || req.status === 'cancelled')
        .map(req => ({
          id: req.id ?? 0,
          repair_description: req.repair_description ?? 'Unknown',
          created_at: req.created_at ?? null,
          status: req.status ?? 'completed',
          customer_availability_1: req.customer_availability_1 ?? null,
          customer_availability_2: req.customer_availability_2 ?? null,
          region: req.region ?? null,
          system_types: req.system_types ?? [],
          technician_name: req.technician_name ?? null,
          customer_id: req.customer_id ?? null,
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));
      console.log('Sanitized requests:', sanitizedRequests);

      if (!deepEqual(sanitizedRequests, prevRequests.current)) {
        setRequests(sortRequests(sanitizedRequests));
        prevRequests.current = sanitizedRequests;
      }
      setMessage({ text: `Found ${sanitizedRequests.length} completed or cancelled job(s).`, type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching job history:', error);
      if (error.message.includes('Unauthorized')) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/customer-login');
      } else {
        setMessage({ text: error.message || 'Error fetching job history. Please try again or contact support at support@tap4service.co.nz.', type: 'error' });
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
      setMessage({ text: 'Please log in as a customer to view your job history.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    fetchData();
    const intervalId = setInterval(fetchData, 60000); // 1 minute
    return () => clearInterval(intervalId);
  }, [customerId, role, navigate]);

  const handleBackToDashboard = () => {
    navigate('/customer-dashboard');
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
              Job History for {userName}
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : message.type === 'info' ? '#3b82f6' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <Button
              variant="contained"
              onClick={handleBackToDashboard}
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

          {isLoading && !hasFetched.current ? (
            <Typography sx={{ textAlign: 'center', color: '#ffffff' }}>
              Loading job history...
            </Typography>
          ) : (
            <>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Job History
              </Typography>
              {requests.length === 0 ? (
                <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                  <CardContent>
                    <Typography sx={{ color: '#ffffff' }}>No completed or cancelled jobs.</Typography>
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
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CustomerJobHistory;