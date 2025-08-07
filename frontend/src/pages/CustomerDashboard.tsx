/**
 * CustomerDashboard.tsx - Version V1.36
 * - Located in /frontend/src/pages/
 * - Fetches and displays data from Customer_Request table via /api/customer_request.php?path=requests.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, customer_id, region, system_types, technician_id, technician_name, technician_phone.
 * - Supports updating descriptions, canceling requests, and confirming job completion.
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
 * - Added dialog to confirm technician_note before completing job.
 * - Updated welcome section to display name, surname, email, address (address, suburb, city, postal_code), and phone number via GET /api/customer_request.php.
 * - Added error handling for undefined requests in fetchData.
 * - Added sound playback (customer_update.mp3) on status updates.
 * - Added technician phone number display.
 * - Fixed TypeScript error for implicit 'any' type in fetchData map function.
 * - Fixed dialog not closing after confirming job completion by reinforcing state reset and adding useEffect in V1.36.
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
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const [confirmingRequestId, setConfirmingRequestId] = useState<number | null>(null);
  const prevRequestsRef = useRef<Request[]>([]);
  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);

  const playUpdateSound = () => {
    const audio = new Audio(SOUND_URL);
    audio.play().catch(err => console.error('Error playing sound:', err));
  };

  useEffect(() => {
    console.log('confirmingRequestId changed:', confirmingRequestId);
  }, [confirmingRequestId]);

  const fetchData = async () => {
    try {
      const profileResponse = await fetch(`${API_URL}/api/customer_request.php?path=profile&customerId=${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!profileResponse.ok) {
        throw new Error(`HTTP error! Status: ${profileResponse.status}`);
      }
      const profileData = await profileResponse.json();
      if (profileData.error) throw new Error(profileData.error);
      console.log('Fetching customer profile for customerId:', customerId);
      setProfile(profileData);

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
        ? requestsData.requests.map((req: Request) => ({
            ...req,
            system_types: Array.isArray(req.system_types) ? req.system_types : JSON.parse(req.system_types || '[]'),
            lastUpdated: req.lastUpdated || new Date().getTime(),
          }))
        : [];
      console.log('Sanitized requests:', sanitizedRequests);

      if (!deepEqual(prevRequestsRef.current, sanitizedRequests)) {
        setRequests(sanitizedRequests);
        prevRequestsRef.current = sanitizedRequests;
        if (sanitizedRequests.length > 0 && prevRequestsRef.current.length > 0) {
          playUpdateSound();
        }
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

  const handleEditRequest = (requestId: number, description: string | null) => {
    setEditingRequestId(requestId);
    setNewDescription(description || '');
  };

  const handleConfirmEdit = async () => {
    if (!editingRequestId || !newDescription || newDescription.length > 255) {
      setMessage({ text: 'Description is required and must not exceed 255 characters.', type: 'error' });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/requests/update-description/${editingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_description: newDescription }),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRequests(prev =>
        prev.map(req =>
          req.id === editingRequestId ? { ...req, repair_description: newDescription, lastUpdated: Date.now() } : req
        )
      );
      setMessage({ text: 'Description updated successfully.', type: 'success' });
      setEditingRequestId(null);
      setNewDescription('');
      playUpdateSound();
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

  const handleConfirmComplete = (event: React.MouseEvent<HTMLButtonElement>) => {
    const requestId = Number(event.currentTarget.getAttribute('data-id'));
    setConfirmingRequestId(requestId);
    console.log('Opening confirmation dialog for requestId:', requestId);
  };

  const handleConfirmCompleteRequest = async () => {
    if (!confirmingRequestId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/confirm-complete/${confirmingRequestId}`, {
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
          req.id === confirmingRequestId ? { ...req, status: 'completed', lastUpdated: Date.now() } : req
        )
      );
      setMessage({ text: 'Job confirmed as completed.', type: 'success' });
      setConfirmingRequestId(null); // Close dialog
      console.log('Closing confirmation dialog for requestId:', confirmingRequestId);
      playUpdateSound();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error confirming job completion:', error);
      setMessage({ text: error.message || 'Failed to confirm job completion.', type: 'error' });
      setConfirmingRequestId(null); // Close dialog on error
      console.log('Closing confirmation dialog on error for requestId:', confirmingRequestId);
    }
  };

  const handleCancelComplete = () => {
    setConfirmingRequestId(null);
    console.log('Closing confirmation dialog via cancel for requestId:', confirmingRequestId);
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
              No service requests found.
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
                        {request.technician_name && (
                          <Typography sx={{ color: '#ffffff' }}><strong>Technician:</strong> {request.technician_name}</Typography>
                        )}
                        {request.technician_phone && (
                          <Typography sx={{ color: '#ffffff' }}>
                            <strong>Technician Phone:</strong>{' '}
                            <a href={`tel:${request.technician_phone}`} style={{ color: '#3b82f6' }}>{request.technician_phone}</a>
                          </Typography>
                        )}
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
                                Reschedule
                              </Button>
                              <Button
                                variant="contained"
                                onClick={() => navigate(`/cancel-request?requestId=${request.id}`)}
                                sx={{
                                  background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                                  color: '#ffffff',
                                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                }}
                              >
                                <FaTimes style={{ marginRight: '8px' }} />
                                Cancel
                              </Button>
                              <Button
                                variant="contained"
                                onClick={() => handleEditRequest(request.id, request.repair_description)}
                                sx={{
                                  background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                                  color: '#ffffff',
                                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                                }}
                              >
                                <FaEdit style={{ marginRight: '8px' }} />
                                Edit Description
                              </Button>
                            </>
                          )}
                          {request.status === 'completed_technician' && (
                            <Button
                              variant="contained"
                              onClick={handleConfirmComplete}
                              data-id={request.id}
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

          <Dialog open={!!confirmingRequestId} onClose={handleCancelComplete}>
            <DialogTitle sx={{ backgroundColor: '#1f2937', color: '#ffffff' }}>Confirm Technician Note</DialogTitle>
            <DialogContent sx={{ backgroundColor: '#1f2937', color: '#ffffff', pt: 2 }}>
              <Typography sx={{ mb: 2, color: '#ffffff' }}>
                Please review the technician's note for Request #{confirmingRequestId}:
              </Typography>
              <TextField
                label="Technician Note"
                value={requests.find(req => req.id === confirmingRequestId)?.technician_note ?? 'No note provided'}
                fullWidth
                multiline
                rows={4}
                InputProps={{
                  readOnly: true,
                  sx: { backgroundColor: '#374151', borderRadius: '8px', color: '#ffffff' }
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                  }
                }}
              />
            </DialogContent>
            <DialogActions sx={{ backgroundColor: '#1f2937' }}>
              <Button
                onClick={handleCancelComplete}
                variant="outlined"
                sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCompleteRequest}
                variant="contained"
                sx={{
                  background: 'linear-gradient(to right, #22c55e, #15803d)',
                  color: '#ffffff',
                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                }}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CustomerDashboard;