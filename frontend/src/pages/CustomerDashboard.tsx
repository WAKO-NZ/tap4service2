/**
 * CustomerDashboard.tsx - Version V1.40
 * - Located in /frontend/src/pages/
 * - Fetches and displays data from Customer_Request table via /api/customer_request.php?path=requests.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, customer_id, region, system_types, technician_id, technician_name, technician_surname, technician_email, technician_phone, technician_note.
 * - Supports canceling requests and confirming job completion.
 * - Reschedule navigates to /log-technical-callout?requestId={requestId}.
 * - Cancel navigates to /cancel-request?requestId={requestId}.
 * - Polls every 1 minute (60,000 ms).
 * - Logout redirects to landing page (/).
 * - Uses date-fns-tz for date formatting.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text.
 * - Added Edit Profile button to navigate to /customer-edit-profile.
 * - Added Log a Callout button (larger, vibrant gradient, animated, full-width, at top) to navigate to /log-technical-callout.
 * - Fixed TypeScript errors in Dialog components (rows, sx, InputProps).
 * - Added Confirm Job Complete button for status='completed_technician', sending PUT /api/requests/confirm-complete/{requestId}.
 * - Job History button navigates to /customer-job-history.
 * - Added dialog to confirm technician_note before completing job - REMOVED in V1.36.
 * - Updated welcome section to display name, surname, email, address (address, suburb, city, postal_code), and phone number via GET /api/customer_request.php.
 * - Added error handling for undefined requests in fetchData.
 * - Added sound playback (customer_update.mp3) on status updates.
 * - Added technician phone number display.
 * - Fixed TypeScript error for implicit 'any' type in fetchData map function.
 * - Fixed dialog not closing after confirming job completion by adding key prop and setTimeout in V1.35.
 * - Added 404 error handling for profile and requests fetch in V1.35.
 * - Removed cancelled and completed jobs (shown in /customer-job-history), sorted by latest created_at, added full technician info (name, surname, email, phone), removed confirmation dialog in V1.36.
 * - Fixed TypeScript errors for implicit 'any' types in map and sort functions in fetchData in V1.37.
 * - Added technician_note display, expanded view by default with collapse option, removed Edit Description, renamed Reschedule to Reschedule & Edit in V1.38.
 * - Fixed TypeScript errors for implicit 'any' types in reduce function for expandedRequests in V1.39.
 * - Fixed technician_note and technician_email display, ensured full technician name and surname rendering in V1.40.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import deepEqual from 'deep-equal';
import { Box, Button, Card, CardContent, Typography, Container } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FaSignOutAlt, FaHistory, FaTimes, FaUserEdit, FaPlus, FaCheck } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';
const SOUND_URL = 'https://tap4service.co.nz/sounds/customer_update.mp3';

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
  technician_surname: string | null;
  technician_email: string | null;
  technician_phone: string | null;
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
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const prevRequestsRef = useRef<Request[]>([]);
  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);

  const playUpdateSound = () => {
    const audio = new Audio(SOUND_URL);
    audio.play().catch(err => console.error('Error playing sound:', err));
  };

  const fetchData = async () => {
    try {
      const profileResponse = await fetch(`${API_URL}/api/customer_request.php?path=profile&customerId=${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!profileResponse.ok) {
        console.warn(`Profile fetch failed with status: ${profileResponse.status}`);
        setProfile(null); // Fallback to null to prevent dashboard crash
      } else {
        const profileData = await profileResponse.json();
        if (profileData.error) {
          console.warn('Profile fetch error:', profileData.error);
          setProfile(null);
        } else {
          console.log('Fetching customer profile for customerId:', customerId);
          setProfile(profileData);
        }
      }

      const requestsResponse = await fetch(`${API_URL}/api/customer_request.php?path=requests&customerId=${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!requestsResponse.ok) {
        throw new Error(`HTTP error! Status: ${requestsResponse.status}`);
      }
      const requestsData = await requestsResponse.json();
      if (requestsData.error) throw new Error(requestsData.error);
      console.log('Raw response data:', requestsData);

      const sanitizedRequests = Array.isArray(requestsData.requests)
        ? requestsData.requests
            .map((req: Request) => {
              console.log(`Request ID ${req.id}: technician_email=${req.technician_email}, technician_note=${req.technician_note}`);
              return {
                ...req,
                system_types: Array.isArray(req.system_types) ? req.system_types : JSON.parse(req.system_types || '[]'),
                lastUpdated: req.lastUpdated || new Date().getTime(),
              };
            })
            .filter((req: Request) => !['cancelled', 'completed'].includes(req.status)) // Filter out cancelled and completed jobs
            .sort((a: Request, b: Request) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()) // Sort by latest created_at
        : [];
      console.log('Sanitized requests:', sanitizedRequests);

      if (!deepEqual(prevRequestsRef.current, sanitizedRequests)) {
        setRequests(sanitizedRequests);
        prevRequestsRef.current = sanitizedRequests;
        if (sanitizedRequests.length > 0 && prevRequestsRef.current.length > 0) {
          playUpdateSound();
        }
        // Initialize all requests as expanded
        setExpandedRequests(
          sanitizedRequests.reduce((acc: ExpandedRequests, req: Request) => ({ ...acc, [req.id]: true }), {} as ExpandedRequests)
        );
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      setMessage({ text: error.message || 'Failed to fetch data.', type: 'error' });
    }
  };

  useEffect(() => {
    if (!customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      navigate('/');
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [navigate, customerId]);

  const handleToggleExpand = (requestId: number) => {
    setExpandedRequests(prev => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/requests/cancel/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: 'cancelled', lastUpdated: Date.now() } : req
        )
      );
      setMessage({ text: 'Request cancelled successfully.', type: 'success' });
      playUpdateSound();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error cancelling request:', error);
      setMessage({ text: error.message || 'Failed to cancel request.', type: 'error' });
    }
  };

  const handleConfirmCompleteRequest = async (requestId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/requests/confirm-complete/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const responseText = await response.text();
      console.log('Confirm complete API response status:', response.status, 'Response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      if (data.error) throw new Error(data.error);

      setRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: 'completed', lastUpdated: Date.now() } : req
        )
      );
      setMessage({ text: 'Job confirmed as completed.', type: 'success' });
      setTimeout(() => {
        console.log('Job confirmed for requestId:', requestId);
      }, 0);
      playUpdateSound();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error confirming job completion:', error);
      setMessage({ text: error.message || 'Failed to confirm job completion.', type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="lg" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Welcome, {profile ? `${profile.name} ${profile.surname}` : 'Customer'}
            </Typography>
            {profile && (
              <Box sx={{ mt: 2, color: '#ffffff', textAlign: 'left', maxWidth: '600px', mx: 'auto' }}>
                <Typography sx={{ color: '#ffffff' }}><strong>Email:</strong> {profile.email}</Typography>
                <Typography sx={{ color: '#ffffff' }}><strong>Address:</strong> {profile.address || 'Not specified'}, {profile.suburb || 'Not specified'}, {profile.city || 'Not specified'}, {profile.postal_code || 'Not specified'}</Typography>
                <Typography sx={{ color: '#ffffff' }}><strong>Phone:</strong> {profile.phone_number || 'Not specified'}</Typography>
                <Typography sx={{ color: '#ffffff' }}><strong>Alternate Phone:</strong> {profile.alternate_phone_number || 'Not specified'}</Typography>
                <Typography sx={{ color: '#ffffff' }}><strong>Region:</strong> {profile.region || 'Not specified'}</Typography>
              </Box>
            )}
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Button
              variant="contained"
              onClick={() => navigate('/log-technical-callout')}
              sx={{
                width: '100%',
                maxWidth: '600px',
                background: 'linear-gradient(to right, #10b981, #047857, #10b981)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '16px 24px',
                fontSize: '1.25rem',
                boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.5)' },
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)', boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)' },
                  '50%': { transform: 'scale(1.03)', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.4)' },
                  '100%': { transform: 'scale(1)', boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)' },
                },
              }}
            >
              <FaPlus style={{ marginRight: '8px' }} />
              Log a Callout
            </Button>
          </Box>

          <Box sx={{ mb: 4, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/customer-edit-profile')}
              sx={{
                color: '#ffffff',
                borderColor: '#ffffff',
                '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
              }}
            >
              <FaUserEdit style={{ marginRight: '8px' }} />
              Edit Profile
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/customer-job-history')}
              sx={{
                color: '#ffffff',
                borderColor: '#ffffff',
                '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
              }}
            >
              <FaHistory style={{ marginRight: '8px' }} />
              Job History
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                localStorage.removeItem('userId');
                localStorage.removeItem('role');
                navigate('/');
              }}
              sx={{
                color: '#ffffff',
                borderColor: '#ffffff',
                '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
              }}
            >
              <FaSignOutAlt style={{ marginRight: '8px' }} />
              Log Out
            </Button>
          </Box>

          <Typography variant="h5" sx={{ color: '#ffffff', mb: 2, fontWeight: 'bold', textAlign: 'center' }}>
            Your Service Requests
          </Typography>

          {requests.length === 0 ? (
            <Typography sx={{ color: '#ffffff', textAlign: 'center' }}>
              No active service requests found.
            </Typography>
          ) : (
            <>
              {requests.map((request) => (
                <Card key={request.id} sx={{ mb: 2, backgroundColor: '#374151', color: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                        Request #{request.id} - {request.status}
                      </Typography>
                      <Button
                        onClick={() => handleToggleExpand(request.id)}
                        sx={{ color: '#3b82f6' }}
                      >
                        {expandedRequests[request.id] ? 'Collapse' : 'Expand'}
                      </Button>
                    </Box>
                    {expandedRequests[request.id] && (
                      <Box sx={{ mt: 2 }}>
                        <Typography sx={{ color: '#ffffff' }}><strong>Description:</strong> {request.repair_description || 'Not specified'}</Typography>
                        <Typography sx={{ color: '#ffffff' }}><strong>Created:</strong> {request.created_at ? formatInTimeZone(new Date(request.created_at), 'Pacific/Auckland', 'yyyy-MM-dd HH:mm:ss') : 'Not specified'}</Typography>
                        <Typography sx={{ color: '#ffffff' }}><strong>Availability 1:</strong> {request.customer_availability_1 || 'Not specified'}</Typography>
                        <Typography sx={{ color: '#ffffff' }}><strong>Availability 2:</strong> {request.customer_availability_2 || 'Not specified'}</Typography>
                        <Typography sx={{ color: '#ffffff' }}><strong>Region:</strong> {request.region || 'Not specified'}</Typography>
                        <Typography sx={{ color: '#ffffff' }}><strong>System Types:</strong> {request.system_types.join(', ') || 'Not specified'}</Typography>
                        {(request.technician_name || request.technician_surname) && (
                          <Typography sx={{ color: '#ffffff' }}>
                            <strong>Technician:</strong> {request.technician_name || ''} {request.technician_surname || ''}
                          </Typography>
                        )}
                        {request.technician_email ? (
                          <Typography sx={{ color: '#ffffff' }}>
                            <strong>Technician Email:</strong>{' '}
                            <a href={`mailto:${request.technician_email}`} style={{ color: '#3b82f6' }}>{request.technician_email}</a>
                          </Typography>
                        ) : (
                          <Typography sx={{ color: '#ffffff' }}><strong>Technician Email:</strong> Not specified</Typography>
                        )}
                        {request.technician_phone ? (
                          <Typography sx={{ color: '#ffffff' }}>
                            <strong>Technician Phone:</strong>{' '}
                            <a href={`tel:${request.technician_phone}`} style={{ color: '#3b82f6' }}>{request.technician_phone}</a>
                          </Typography>
                        ) : (
                          <Typography sx={{ color: '#ffffff' }}><strong>Technician Phone:</strong> Not specified</Typography>
                        )}
                        <Typography sx={{ color: '#ffffff' }}>
                          <strong>Technician Note:</strong> {request.technician_note || 'Not specified'}
                        </Typography>
                        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                          {['pending', 'assigned'].includes(request.status) && (
                            <>
                              <Button
                                variant="contained"
                                onClick={() => navigate(`/log-technical-callout?requestId=${request.id}`)}
                                sx={{
                                  background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                                  color: '#ffffff',
                                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                }}
                              >
                                Reschedule & Edit
                              </Button>
                              <Button
                                variant="contained"
                                onClick={() => handleCancelRequest(request.id)}
                                sx={{
                                  background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                                  color: '#ffffff',
                                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                }}
                              >
                                <FaTimes style={{ marginRight: '8px' }} />
                                Cancel
                              </Button>
                            </>
                          )}
                          {request.status === 'completed_technician' && (
                            <Button
                              variant="contained"
                              onClick={() => handleConfirmCompleteRequest(request.id)}
                              sx={{
                                background: 'linear-gradient(to right, #22c55e, #15803d)',
                                color: '#ffffff',
                                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                              }}
                            >
                              <FaCheck style={{ marginRight: '8px' }} />
                              Confirm Job Complete
                            </Button>
                          )}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CustomerDashboard;