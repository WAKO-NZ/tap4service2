/**
 * CustomerDashboard.tsx - Version V1.34
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
 * - Added dialog to confirm technician_note before completing job.
 * - Updated welcome section to display name, surname, email, address (address, suburb, city, postal_code), and phone number via GET /api/customer_request.php.
 * - Added error handling for undefined requests in fetchData.
 * - Fixed TypeScript error for implicit 'any' type in fetchData map function.
 * - Fixed TypeScript errors (TS18046, TS2769) by typing error as any and removing inert prop.
 * - Fixed edit description by including customerId in PUT request body.
 * - Filtered Active Service Requests to only show pending, assigned, and completed_technician statuses.
 * - Enhanced error handling to display specific backend error messages.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, type ChangeEvent } from 'react';
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
  const [newDescription, setNewDescription] = useState('');
  const [confirmingRequestId, setConfirmingRequestId] = useState<number | null>(null);
  const navigate = useNavigate();
  const prevRequestsRef = useRef<Request[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const customerId = customerProfile?.id ?? null;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (confirmingRequestId || editingRequestId) {
      const focusableElements = dialogRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstElement = focusableElements?.[0] as HTMLElement;
      firstElement?.focus();

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;
          const currentElement = document.activeElement as HTMLElement;
          if (currentElement === lastElement) {
            firstElement.focus();
          } else {
            const nextElement = focusableElements?.[Array.from(focusableElements).indexOf(currentElement) + 1] as HTMLElement;
            nextElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [confirmingRequestId, editingRequestId]);

  const fetchData = async () => {
    try {
      console.log(`Fetching customer profile for customerId: ${customerId}`);
      console.log(`Fetching requests for customerId: ${customerId}`);
      const [requestsResponse, profileResponse] = await Promise.all([
        fetch(`${API_URL}/api/customer_request.php?path=requests`, { credentials: 'include' }),
        fetch(`${API_URL}/api/customer_request.php`, { credentials: 'include' })
      ]);

      if (!requestsResponse.ok || !profileResponse.ok) {
        if (requestsResponse.status === 403 || profileResponse.status === 403) {
          navigate('/');
        }
        throw new Error(`Failed to fetch data: Requests=${requestsResponse.status}, Profile=${profileResponse.status}`);
      }

      const requestsData = await requestsResponse.json();
      const profileData = await profileResponse.json();
      console.log('Raw response data:', requestsData);

      if (requestsData.requests && !deepEqual(requestsData.requests, prevRequestsRef.current)) {
        const newRequests = requestsData.requests
          .filter((req: Request) => ['pending', 'assigned', 'completed_technician'].includes(req.status))
          .map((req: Request) => ({
            ...req,
            system_types: typeof req.system_types === 'string' ? JSON.parse(req.system_types) : req.system_types,
            lastUpdated: Date.now()
          }));
        setRequests(newRequests);
        prevRequestsRef.current = newRequests;
        if (audioRef.current) audioRef.current.play();
      }

      setCustomerProfile(profileData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setMessage({ text: `Failed to load data: ${error.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    fetch(`${API_URL}/api/logout.php`, { method: 'POST', credentials: 'include' })
      .then(() => navigate('/'))
      .catch((error: any) => {
        console.error('Logout error:', error);
        setMessage({ text: `Logout failed: ${error.message || 'Unknown error'}`, type: 'error' });
      });
  };

  const handleEditDescription = (requestId: number, currentDescription: string | null) => {
    setEditingRequestId(requestId);
    setNewDescription(currentDescription ?? '');
  };

  const handleConfirmEdit = async () => {
    if (editingRequestId && customerId) {
      try {
        const response = await fetch(`${API_URL}/api/requests/update-description/${editingRequestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ newDescription, customerId }),
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update description');
        }

        setMessage({ text: 'Description updated successfully', type: 'success' });
        await fetchData();
      } catch (error: any) {
        console.error('Error updating description:', error);
        setMessage({ text: `Failed to update description: ${error.message || 'Unknown error'}`, type: 'error' });
      } finally {
        setEditingRequestId(null);
        setNewDescription('');
      }
    } else {
      setMessage({ text: 'Unable to update description: Customer profile not loaded', type: 'error' });
      setEditingRequestId(null);
      setNewDescription('');
    }
  };

  const handleCancelEdit = () => {
    setEditingRequestId(null);
    setNewDescription('');
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!customerId) {
      setMessage({ text: 'Customer profile not loaded', type: 'error' });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ customerId }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel request');
      }

      setMessage({ text: 'Request cancelled successfully', type: 'success' });
      await fetchData();
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      setMessage({ text: `Failed to cancel request: ${error.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const handleReschedule = (requestId: number) => {
    navigate(`/log-technical-callout?requestId=${requestId}`);
  };

  const handleConfirmComplete = (requestId: number) => {
    setConfirmingRequestId(requestId);
  };

  const handleConfirmCompleteRequest = async () => {
    if (confirmingRequestId && customerId) {
      try {
        const response = await fetch(`${API_URL}/api/requests/confirm-complete/${confirmingRequestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ customerId }),
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to confirm completion');
        }

        setMessage({ text: 'Job completion confirmed', type: 'success' });
        await fetchData();
      } catch (error: any) {
        console.error('Error confirming completion:', error);
        setMessage({ text: `Failed to confirm completion: ${error.message || 'Unknown error'}`, type: 'error' });
      } finally {
        setConfirmingRequestId(null);
      }
    } else {
      setMessage({ text: 'Unable to confirm: Customer profile not loaded', type: 'error' });
      setConfirmingRequestId(null);
    }
  };

  const handleCancelComplete = () => {
    setConfirmingRequestId(null);
  };

  if (isLoading) {
    return <div className="text-center text-[#ffffff] p-8">Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <audio ref={audioRef} src="/sounds/customer_update.mp3" preload="auto" />
          {message.text && (
            <Typography
              variant="body1"
              sx={{
                mb: 4,
                p: 2,
                borderRadius: '8px',
                textAlign: 'center',
                backgroundColor: message.type === 'success' ? '#22c55e' : '#ef4444',
                color: '#ffffff'
              }}
            >
              {message.text}
            </Typography>
          )}

          {customerProfile && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ color: '#ffffff' }}>
                  Welcome, {customerProfile.name} {customerProfile.surname}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    onClick={() => navigate('/customer-edit-profile')}
                    variant="outlined"
                    sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                  >
                    <FaUserEdit style={{ marginRight: '8px' }} />
                    Edit Profile
                  </Button>
                  <Button
                    onClick={() => navigate('/customer-job-history')}
                    variant="outlined"
                    sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                  >
                    <FaHistory style={{ marginRight: '8px' }} />
                    Job History
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="outlined"
                    sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                  >
                    <FaSignOutAlt style={{ marginRight: '8px' }} />
                    Logout
                  </Button>
                </Box>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Button
                  onClick={() => navigate('/log-technical-callout')}
                  variant="contained"
                  fullWidth
                  sx={{
                    background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    borderRadius: '24px',
                    padding: '24px',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' },
                    fontSize: '1.5rem'
                  }}
                >
                  <FaPlus style={{ marginRight: '8px' }} />
                  Log a Callout
                </Button>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                  Profile Details
                </Typography>
                <Typography sx={{ color: '#ffffff' }}>Email: {customerProfile.email}</Typography>
                <Typography sx={{ color: '#ffffff' }}>
                  Address: {customerProfile.address}, {customerProfile.suburb}, {customerProfile.city}, {customerProfile.postal_code}
                </Typography>
                <Typography sx={{ color: '#ffffff' }}>Phone: {customerProfile.phone_number}</Typography>
                <Typography sx={{ color: '#ffffff' }}>
                  Alternate Phone: {customerProfile.alternate_phone_number ?? 'N/A'}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                  Active Service Requests
                </Typography>
                {requests.length === 0 ? (
                  <Typography sx={{ color: '#ffffff' }}>No active requests</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {requests.map((request: Request) => (
                      <Card key={request.id} sx={{ backgroundColor: '#1f2937', borderRadius: '12px' }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                            Request #{request.id} - {request.status.toUpperCase()}
                          </Typography>
                          <Typography sx={{ color: '#ffffff' }}>Description: {request.repair_description}</Typography>
                          <Typography sx={{ color: '#ffffff' }}>
                            Created: {request.created_at ? formatInTimeZone(new Date(request.created_at), 'Pacific/Auckland', 'PPPpp') : 'N/A'}
                          </Typography>
                          <Typography sx={{ color: '#ffffff' }}>Availability 1: {request.customer_availability_1}</Typography>
                          <Typography sx={{ color: '#ffffff' }}>
                            Availability 2: {request.customer_availability_2 ?? 'N/A'}
                          </Typography>
                          <Typography sx={{ color: '#ffffff' }}>Region: {request.region}</Typography>
                          <Typography sx={{ color: '#ffffff' }}>System Types: {request.system_types.join(', ')}</Typography>
                          {request.technician_name && (
                            <Typography sx={{ color: '#ffffff' }}>Technician: {request.technician_name}</Typography>
                          )}

                          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  onClick={() => handleEditDescription(request.id, request.repair_description)}
                                  variant="outlined"
                                  sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                                >
                                  <FaEdit style={{ marginRight: '8px' }} />
                                  Edit Description
                                </Button>
                                <Button
                                  onClick={() => handleCancelRequest(request.id)}
                                  variant="outlined"
                                  sx={{ color: '#ef4444', borderColor: '#ef4444', '&:hover': { borderColor: '#dc2626' } }}
                                >
                                  <FaTimes style={{ marginRight: '8px' }} />
                                  Cancel Request
                                </Button>
                              </>
                            )}
                            {request.status === 'assigned' && (
                              <Button
                                onClick={() => handleReschedule(request.id)}
                                variant="outlined"
                                sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                              >
                                Reschedule
                              </Button>
                            )}
                            {request.status === 'completed_technician' && (
                              <Button
                                onClick={() => handleConfirmComplete(request.id)}
                                variant="contained"
                                disabled={!customerProfile}
                                sx={{
                                  background: 'linear-gradient(to right, #22c55e, #15803d)',
                                  color: '#ffffff',
                                  fontWeight: 'bold',
                                  borderRadius: '24px',
                                  padding: '12px 24px',
                                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' },
                                  '&.Mui-disabled': { opacity: 0.5 }
                                }}
                              >
                                <FaCheck style={{ marginRight: '8px' }} />
                                Confirm Job Complete
                              </Button>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          )}

          <Dialog open={!!editingRequestId} onClose={handleCancelEdit} ref={dialogRef}>
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
                disabled={!customerId}
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
                onClick={handleCancelEdit}
                variant="outlined"
                sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
              >
                Cancel
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={!!confirmingRequestId} onClose={handleCancelComplete} ref={dialogRef}>
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
                onClick={handleConfirmCompleteRequest}
                variant="contained"
                disabled={!customerId}
                sx={{
                  background: 'linear-gradient(to right, #22c55e, #15803d)',
                  color: '#ffffff',
                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' },
                  '&.Mui-disabled': { opacity: 0.5 }
                }}
              >
                Confirm
              </Button>
              <Button
                onClick={handleCancelComplete}
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