/**
 * CustomerDashboard.tsx - Version V1.43
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
 * - Added Confirm Job Complete button for status='completed_technician', sending PUT /api/requests/confirm-complete/{requestId}.
 * - Job History button navigates to /customer-job-history.
 * - Removed dialog to confirm technician_note before completing job; now directly marks as complete on button press.
 * - Updated welcome section to display name, surname, email, address (address, suburb, city, postal_code), and phone number via GET /api/customer_request.php.
 * - Added error handling for undefined requests in fetchData.
 * - Improved error handling in handleConfirmComplete to use response.text() and attempt JSON parse.
 * - Added raw response logging to debug JSON parse errors and empty responses.
 * - Added retry logic with exponential backoff for transient failures in fetchProfile and fetchRequests.
 * - Enhanced error messages to handle partial profile data and guide users.
 * - Added status code logging and improved retry logic for empty responses.
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
  customer_id: number;
  region: string | null;
  system_types: string[] | null;
  technician_id: number | null;
  technician_name: string | null;
  technician_note: string | null;
  lastUpdated: number;
}

interface Profile {
  name: string | null;
  surname: string | null;
  email: string | null;
  phone_number: string | null;
  alternate_phone_number: string | null;
  address: string | null;
  suburb: string | null;
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
          <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-bold mb-4">Something went wrong</h2>
          <p>Please try again later or contact <a href="mailto:support@tap4service.co.nz" className="underline text-[#ffffff]">support@tap4service.co.nz</a>.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CustomerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState('');
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const prevRequestsRef = useRef<Request[]>([]);

  const retryFetch = async (url: string, options: RequestInit, retries: number = 3, delay: number = 1000): Promise<Response> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        const text = await response.text();
        console.log(`API response: attempt=${attempt}, url=${url}, status=${response.status}, response=${text.substring(0, 100)}...`);
        if (!text && response.status !== 200) {
          throw new Error(`Empty response from server on attempt ${attempt} with status ${response.status}`);
        }
        return new Response(text, { status: response.status, headers: response.headers });
      } catch (err) {
        console.error(`Retry attempt ${attempt} failed for ${url}:`, err);
        if (attempt === retries) {
          throw new Error(`Failed after ${retries} retries: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error('Retry limit reached');
  };

  useEffect(() => {
    if (!customerId) {
      setError('User not logged in. Please log in again.');
      navigate('/customer-login');
      return;
    }

    const fetchProfile = async () => {
      console.log(`Fetching customer profile for customerId: ${customerId}`);
      try {
        const response = await retryFetch(`${API_URL}/api/customer_request.php`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const responseText = await response.text();
        console.log('Profile raw response text:', responseText);

        if (!response.ok) {
          console.error('Fetch profile failed:', { status: response.status, response: responseText });
          throw new Error(`HTTP error! Status: ${response.status} Response: ${responseText || 'No response data'}`);
        }

        if (!responseText) {
          throw new Error('Empty response from server');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.error('Failed to parse profile JSON:', responseText);
          throw new Error('Invalid JSON response from server');
        }

        if (!data.name || !data.email) {
          console.warn('Incomplete profile data:', data);
          setError('Incomplete profile data received. Please update your profile.');
        }
        setProfile(data);
      } catch (err: unknown) {
        console.error('Error fetching customer profile:', err);
        setError(`Failed to fetch profile: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or contact support.`);
      }
    };

    const fetchRequests = async () => {
      console.log(`Fetching requests for customerId: ${customerId}`);
      try {
        const response = await retryFetch(`${API_URL}/api/customer_request.php?path=requests`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const responseText = await response.text();
        console.log('Requests raw response text:', responseText);

        if (!response.ok) {
          console.error('Fetch requests failed:', { status: response.status, response: responseText });
          throw new Error(`HTTP error! Status: ${response.status} Response: ${responseText || 'No response data'}`);
        }

        if (!responseText) {
          throw new Error('Empty response from server');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.error('Failed to parse requests JSON:', responseText);
          throw new Error('Invalid JSON response from server');
        }

        if (!deepEqual(requests, data.requests)) {
          setRequests(data.requests || []);
          prevRequestsRef.current = data.requests || [];
        }
      } catch (err: unknown) {
        console.error('Error fetching requests:', err);
        setError(`Failed to fetch requests: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or contact support.`);
      }
    };

    const fetchData = async () => {
      await Promise.all([fetchProfile(), fetchRequests()]);
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [customerId, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    navigate('/');
  };

  const handleEditDescription = (requestId: number, description: string | null) => {
    setEditingRequestId(requestId);
    setNewDescription(description || '');
  };

  const handleCancelEdit = () => {
    setEditingRequestId(null);
    setNewDescription('');
  };

  const handleConfirmEdit = async () => {
    if (!editingRequestId) return;
    try {
      const response = await retryFetch(`${API_URL}/api/requests/update-description/${editingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: newDescription }),
      });
      const responseText = await response.text();
      console.log('Update description response:', responseText);

      if (!response.ok) {
        console.error('Update description failed:', { status: response.status, response: responseText });
        setError(`Failed to update description: ${responseText || 'No response data'}. Please try again or contact support.`);
        return;
      }

      setRequests(requests.map(req => req.id === editingRequestId ? { ...req, repair_description: newDescription } : req));
      setEditingRequestId(null);
      setNewDescription('');
    } catch (err: unknown) {
      console.error('Error updating description:', err);
      setError(`Failed to update description: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or contact support.`);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      const response = await retryFetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const responseText = await response.text();
      console.log('Cancel request response:', responseText);

      if (!response.ok) {
        console.error('Cancel request failed:', { status: response.status, response: responseText });
        setError(`Failed to cancel request: ${responseText || 'No response data'}. Please try again or contact support.`);
        return;
      }

      setRequests(requests.filter(req => req.id !== requestId));
    } catch (err: unknown) {
      console.error('Error canceling request:', err);
      setError(`Failed to cancel request: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or contact support.`);
    }
  };

  const handleConfirmComplete = async (requestId: number) => {
    try {
      const response = await retryFetch(`${API_URL}/api/requests/confirm-complete/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const responseText = await response.text();
      console.log('Confirm complete response:', responseText);

      if (!response.ok) {
        console.error('Confirm complete failed:', { status: response.status, response: responseText });
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          setError(`Failed to confirm job: Invalid response format (Status: ${response.status}). Please try again or contact support.`);
          return;
        }
        setError(`Failed to confirm job: ${data.error || 'No error message'}. Please try again or contact support.`);
        return;
      }

      setRequests(requests.filter(req => req.id !== requestId));
    } catch (err: unknown) {
      console.error('Error confirming job:', err);
      setError(`Failed to confirm job: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or contact support.`);
    }
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
          <Box sx={{ mb: 4 }}>
            <Button
              variant="contained"
              fullWidth
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '24px',
                fontSize: '1.5rem',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
              onClick={() => navigate('/log-technical-callout')}
            >
              <FaPlus style={{ marginRight: '8px' }} />
              Log a Callout
            </Button>
          </Box>
          {error && (
            <Typography sx={{ color: '#ff0000', textAlign: 'center', mb: 4 }}>
              {error}
            </Typography>
          )}
          {profile && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Welcome, {profile.name || 'User'} {profile.surname || ''}
              </Typography>
              <Typography>Email: {profile.email || 'N/A'}</Typography>
              <Typography>Phone: {profile.phone_number || 'N/A'}</Typography>
              <Typography>Address: {profile.address || 'N/A'}, {profile.suburb || 'N/A'}, {profile.city || 'N/A'}, {profile.postal_code || 'N/A'}</Typography>
              <Button
                variant="outlined"
                sx={{
                  mt: 2,
                  color: '#ffffff',
                  borderColor: '#ffffff',
                  borderRadius: '24px',
                  '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
                }}
                onClick={() => navigate('/customer-edit-profile')}
              >
                <FaUserEdit style={{ marginRight: '8px' }} />
                Edit Profile
              </Button>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
            <Button
              variant="outlined"
              sx={{
                color: '#ffffff',
                borderColor: '#ffffff',
                borderRadius: '24px',
                padding: '12px 24px',
                '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
              }}
              onClick={() => navigate('/customer-job-history')}
            >
              <FaHistory style={{ marginRight: '8px' }} />
              Job History
            </Button>
            <Button
              variant="outlined"
              sx={{
                color: '#ffffff',
                borderColor: '#ffffff',
                borderRadius: '24px',
                padding: '12px 24px',
                '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
              }}
              onClick={handleLogout}
            >
              <FaSignOutAlt style={{ marginRight: '8px' }} />
              Logout
            </Button>
          </Box>
          <Typography variant="h5" sx={{ mb: 2 }}>Active Service Requests</Typography>
          {requests.length === 0 ? (
            <Typography>No active service requests found.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requests.map((req: Request) => (
                <Card key={req.id} sx={{ backgroundColor: '#374151', color: '#ffffff' }}>
                  <CardContent>
                    <Typography>ID: {req.id}</Typography>
                    <Typography>Description: {req.repair_description || 'N/A'}</Typography>
                    <Typography>Created: {req.created_at ? formatInTimeZone(new Date(req.created_at), 'Pacific/Auckland', 'PPpp') : 'N/A'}</Typography>
                    <Typography>Status: {req.status}</Typography>
                    <Typography>Availability 1: {req.customer_availability_1 || 'N/A'}</Typography>
                    <Typography>Availability 2: {req.customer_availability_2 || 'N/A'}</Typography>
                    <Typography>Region: {req.region || 'N/A'}</Typography>
                    <Typography>System Types: {req.system_types?.join(', ') || 'N/A'}</Typography>
                    <Typography>Technician: {req.technician_name || 'Not assigned'}</Typography>
                    <Typography>Technician Note: {req.technician_note || 'N/A'}</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                      {req.status === 'pending' && (
                        <>
                          <Button
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
                            onClick={() => handleEditDescription(req.id, req.repair_description)}
                          >
                            <FaEdit style={{ marginRight: '8px' }} />
                            Edit Description
                          </Button>
                          <Button
                            variant="contained"
                            sx={{
                              background: 'linear-gradient(to right, #ef4444, #991b1b)',
                              color: '#ffffff',
                              fontWeight: 'bold',
                              borderRadius: '24px',
                              padding: '12px 24px',
                              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                              '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                            }}
                            onClick={() => handleCancelRequest(req.id)}
                          >
                            <FaTimes style={{ marginRight: '8px' }} />
                            Cancel Request
                          </Button>
                        </>
                      )}
                      {(req.status === 'pending' || req.status === 'assigned') && (
                        <Button
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
                            onClick={() => navigate(`/log-technical-callout?requestId=${req.id}`)}
                          >
                            Reschedule
                          </Button>
                        )}
                        {req.status === 'completed_technician' && (
                          <Button
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
                            onClick={() => handleConfirmComplete(req.id)}
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
  }