/**
 * TechnicianDashboard.tsx - Version V6.132
 * - Located in /frontend/src/pages/
 * - Fetches and displays data from Customer_Request table via /api/requests/available and /api/requests/technician/{technicianId}.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, region, system_types, technician_id.
 * - Includes customer details: customer_name, customer_address, customer_city, customer_postal_code, customer_phone_number, customer_alternate_phone_number, email.
 * - Sends job acceptance email to customer with technician details (if email available).
 * - Prevents re-acceptance of unassigned jobs with confirmation warning.
 * - Removes unassigned jobs from the current technician’s dashboard and makes them available on other technicians’ dashboards.
 * - Audio plays only on new requests or status updates, not on refresh, using /sounds/technician_update.mp3.
 * - Polls every 1 minute (60,000 ms).
 * - Logout redirects to landing page (/).
 * - Uses date-fns-tz for date formatting.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text.
 * - Fixed TypeScript errors: corrected 'preocupación_availability_2' to 'customer_availability_2', added customer_postal_code, added missing imports, typed event handlers.
 * - Fixed JSX error: added missing closing tags for ErrorBoundary and LocalizationProvider.
 * - Enhanced error handling for 404/403 errors with session validation and detailed logging.
 * - Updated to make technician_note optional to align with Technician_Feedback schema (no note column).
 * - Added Edit Profile button to navigate to /technician-edit-profile.
 * - Prioritizes assigned jobs (technician_id matches and status='assigned') at the top, followed by available jobs (technician_id=null).
 * - Updated unassign to use POST /api/requests/unassign/{requestId} with unassignable=0.
 * - Displays technician_note in completed job history if available, with warning if null.
 * - Fixed TypeScript errors 2448, 2454, 2339: ensured assignedData is declared and assigned before use, and correctly uses assignedResponse.json().
 * - Fixed audio error message to reference /sounds/technician_update.mp3.
 * - Added unassignable: 0 to unassign request to match backend.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, type MouseEventHandler, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import deepEqual from 'deep-equal';
import { Box, Button, Card, CardContent, Typography, Container, TextField } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FaCheck, FaTimes, FaSignOutAlt, FaHistory, FaBell, FaUserEdit } from 'react-icons/fa';

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
  customer_name: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_postal_code: string | null;
  customer_phone_number: string | null;
  customer_alternate_phone_number: string | null;
  email: string | null;
  technician_note?: string | null;
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
    console.error('Error in TechnicianDashboard:', error, errorInfo);
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

export default function TechnicianDashboard() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [completedRequests, setCompletedRequests] = useState<Request[]>([]);
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [completingRequestId, setCompletingRequestId] = useState<number | null>(null);
  const [acceptingRequestId, setAcceptingRequestId] = useState<number | null>(null);
  const [selectedAvailability, setSelectedAvailability] = useState<1 | 2 | null>(null);
  const [technicianNote, setTechnicianNote] = useState<string>('');
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => localStorage.getItem('audioEnabled') !== 'false');
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const technicianId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Technician';
  const prevRequests = useRef<Request[]>([]);
  const prevCompleted = useRef<Request[]>([]);
  const hasFetched = useRef(false);
  const updateAudio = new Audio('/sounds/technician_update.mp3');

  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const newState = !prev;
      localStorage.setItem('audioEnabled', newState.toString());
      return newState;
    });
  };

  const sortRequests = (requests: Request[]): Request[] => {
    return [...requests].sort((a, b) => {
      if (a.technician_id === parseInt(technicianId || '0') && a.status === 'assigned' && (b.technician_id !== parseInt(technicianId || '0') || b.status !== 'assigned')) {
        return -1;
      }
      if (b.technician_id === parseInt(technicianId || '0') && b.status === 'assigned' && (a.technician_id !== parseInt(technicianId || '0') || a.status !== 'assigned')) {
        return 1;
      }
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
    if (!technicianId || role !== 'technician') {
      console.error('Invalid session: technicianId or role missing', { technicianId, role });
      setMessage({ text: 'Please log in as a technician to view your dashboard.', type: 'error' });
      navigate('/technician-login');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Fetching available requests for technicianId:', technicianId);
      const availableResponse = await retryFetch(() =>
        fetch(`${API_URL}/api/requests/available?technicianId=${technicianId}&unassignable=0`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );
      if (!availableResponse.ok) {
        const text = await availableResponse.text();
        console.error('Fetch available failed:', text, 'Status:', availableResponse.status);
        if (availableResponse.status === 404) {
          throw new Error('Service request endpoint unavailable. Please contact support at support@tap4service.co.nz.');
        } else if (availableResponse.status === 403) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! Status: ${availableResponse.status} Response: ${text}`);
      }
      const availableData: { requests: Request[] } = await availableResponse.json();
      const sanitizedAvailable = availableData.requests.map(req => ({
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
        customer_name: req.customer_name ?? null,
        customer_address: req.customer_address ?? null,
        customer_city: req.customer_city ?? null,
        customer_postal_code: req.customer_postal_code ?? null,
        customer_phone_number: req.customer_phone_number ?? null,
        customer_alternate_phone_number: req.customer_alternate_phone_number ?? null,
        email: req.email ?? null,
        technician_note: req.technician_note ?? null,
        lastUpdated: req.lastUpdated ?? Date.now()
      }));

      console.log('Fetching assigned/completed requests for technicianId:', technicianId);
      const assignedResponse = await retryFetch(() =>
        fetch(`${API_URL}/api/requests/technician/${technicianId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );
      if (!assignedResponse.ok) {
        const text = await assignedResponse.text();
        console.error('Fetch assigned failed:', text, 'Status:', assignedResponse.status);
        if (assignedResponse.status === 403) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! Status: ${assignedResponse.status} Response: ${text}`);
      }
      const assignedData: { requests: Request[] } = await assignedResponse.json();
      const sanitizedAssigned = assignedData.requests
        .filter(req => req.status === 'assigned')
        .map(req => ({
          id: req.id ?? 0,
          repair_description: req.repair_description ?? 'Unknown',
          created_at: req.created_at ?? null,
          status: req.status ?? 'assigned',
          customer_availability_1: req.customer_availability_1 ?? null,
          customer_availability_2: req.customer_availability_2 ?? null,
          region: req.region ?? null,
          system_types: req.system_types ?? [],
          technician_id: req.technician_id ?? null,
          technician_name: req.technician_name ?? null,
          customer_name: req.customer_name ?? null,
          customer_address: req.customer_address ?? null,
          customer_city: req.customer_city ?? null,
          customer_postal_code: req.customer_postal_code ?? null,
          customer_phone_number: req.customer_phone_number ?? null,
          customer_alternate_phone_number: req.customer_alternate_phone_number ?? null,
          email: req.email ?? null,
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));
      const sanitizedCompleted = assignedData.requests
        .filter(req => req.status === 'completed_technician' || req.status === 'completed')
        .map(req => ({
          id: req.id ?? 0,
          repair_description: req.repair_description ?? 'Unknown',
          created_at: req.created_at ?? null,
          status: req.status ?? 'completed_technician',
          customer_availability_1: req.customer_availability_1 ?? null,
          customer_availability_2: req.customer_availability_2 ?? null,
          region: req.region ?? null,
          system_types: req.system_types ?? [],
          technician_id: req.technician_id ?? null,
          technician_name: req.technician_name ?? null,
          customer_name: req.customer_name ?? null,
          customer_address: req.customer_address ?? null,
          customer_city: req.customer_city ?? null,
          customer_postal_code: req.customer_postal_code ?? null,
          customer_phone_number: req.customer_phone_number ?? null,
          customer_alternate_phone_number: req.customer_alternate_phone_number ?? null,
          email: req.email ?? null,
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));

      if (audioEnabled) {
        if (!deepEqual(sanitizedAvailable, prevRequests.current)) {
          const newJobs = sanitizedAvailable.filter(req => 
            !prevRequests.current.some(prev => prev.id === req.id)
          );
          if (newJobs.length > 0) {
            updateAudio.play().catch(err => {
              console.error('Audio play failed for new jobs:', err);
              setMessage({ text: 'Audio notification failed. Ensure /sounds/technician_update.mp3 exists in public_html/sounds.', type: 'error' });
            });
          }
        }
        if (!deepEqual(sanitizedAssigned, prevRequests.current.filter(req => req.status === 'assigned')) ||
            !deepEqual(sanitizedCompleted, prevCompleted.current)) {
          const statusUpdates = [...sanitizedAssigned, ...sanitizedCompleted].filter(req => {
            const prevReq = [...prevRequests.current, ...prevCompleted.current].find(prev => prev.id === req.id);
            return !prevReq || prevReq.status !== req.status;
          });
          if (statusUpdates.length > 0) {
            updateAudio.play().catch(err => {
              console.error('Audio play failed for status updates:', err);
              setMessage({ text: 'Audio notification failed. Ensure /sounds/technician_update.mp3 exists in public_html/sounds.', type: 'error' });
            });
          }
        }
      }

      if (!deepEqual(sanitizedAvailable, prevRequests.current) || 
          !deepEqual(sanitizedAssigned, prevRequests.current.filter(req => req.status === 'assigned')) ||
          !deepEqual(sanitizedCompleted, prevCompleted.current)) {
        setRequests(sortRequests([...sanitizedAssigned, ...sanitizedAvailable]));
        setCompletedRequests(sortRequests(sanitizedCompleted));
        prevRequests.current = [...sanitizedAssigned, ...sanitizedAvailable];
        prevCompleted.current = sanitizedCompleted;
      }
      setMessage({ text: `Found ${sanitizedAssigned.length} assigned, ${sanitizedAvailable.length} available, and ${sanitizedCompleted.length} completed request(s).`, type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      if (error.message.includes('Unauthorized')) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/technician-login');
      } else {
        setMessage({ text: error.message || 'Error fetching data. Please try again or contact support at support@tap4service.co.nz.', type: 'error' });
      }
      setRequests([]);
      setCompletedRequests([]);
    } finally {
      setIsLoading(false);
      hasFetched.current = true;
    }
  };

  useEffect(() => {
    if (!technicianId || role !== 'technician') {
      console.error('Invalid session on mount: technicianId or role missing', { technicianId, role });
      setMessage({ text: 'Please log in as a technician to view your dashboard.', type: 'error' });
      navigate('/technician-login');
      return;
    }

    fetchData();
    const intervalId = setInterval(fetchData, 60000); // 1 minute
    return () => clearInterval(intervalId);
  }, [technicianId, role, navigate]);

  const handleAccept: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    setAcceptingRequestId(requestId);
    setSelectedAvailability(null);
    setMessage({ text: 'Select availability time.', type: 'info' });
  };

  const handleConfirmAccept = async () => {
    if (!acceptingRequestId || !selectedAvailability || !technicianId) {
      setMessage({ text: 'Please select an availability time.', type: 'error' });
      return;
    }
    const acceptedRequest = requests.find(req => req.id === acceptingRequestId);
    if (!acceptedRequest) {
      setMessage({ text: 'Invalid request.', type: 'error' });
      return;
    }
    const scheduledTime = selectedAvailability === 1 ? acceptedRequest.customer_availability_1 : acceptedRequest.customer_availability_2;
    if (!scheduledTime) {
      setMessage({ text: 'Selected availability time is not valid.', type: 'error' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/requests/accept/${acceptingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), scheduledTime }),
        credentials: 'include',
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        data = { error: 'Server error: Invalid response format' };
      }
      if (response.ok) {
        setMessage({ text: 'Request accepted successfully!', type: 'success' });
        const updatedRequest = {
          ...acceptedRequest,
          status: 'assigned' as const,
          technician_id: parseInt(technicianId),
          technician_name: userName,
          lastUpdated: Date.now()
        };
        setRequests(prev => sortRequests([...prev.filter(req => req.id !== acceptingRequestId), updatedRequest]));
        if (acceptedRequest.email) {
          const emailResponse = await fetch(`${API_URL}/api/requests/send-acceptance-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerEmail: acceptedRequest.email,
              technicianName: userName,
              technicianId: technicianId,
              requestId: acceptingRequestId,
              scheduledTime
            }),
            credentials: 'include',
          });
          if (!emailResponse.ok) {
            console.error('Email sending failed:', await emailResponse.text());
            setMessage({ text: 'Request accepted, but email failed to send.', type: 'warning' });
          }
        } else {
          console.warn('No customer email available, skipping email notification.');
          setMessage({ text: 'Request accepted, but no email sent due to missing customer email.', type: 'warning' });
        }
        setAcceptingRequestId(null);
        setSelectedAvailability(null);
      } else {
        setMessage({ text: `Failed to accept: ${data.error || 'Unknown error'}`, type: 'error' });
        if (response.status === 403) {
          navigate('/technician-login');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error accepting request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleCancelAccept = () => {
    setAcceptingRequestId(null);
    setSelectedAvailability(null);
    setMessage({ text: '', type: '' });
  };

  const handleUnassign: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    if (window.confirm('Unassigning this job will make it available to other technicians. Are you sure?')) {
      if (!technicianId) {
        setMessage({ text: 'Error: Technician ID not found. Please log in again.', type: 'error' });
        return;
      }
      handleConfirmUnassign(requestId);
    }
  };

  const handleConfirmUnassign = async (requestId: number) => {
    if (!technicianId) {
      setMessage({ text: 'Error: Technician ID not found. Please log in again.', type: 'error' });
      return;
    }
    try {
      console.log(`Attempting to unassign request ID ${requestId} for technician ID ${technicianId}`);
      const response = await fetch(`${API_URL}/api/requests/unassign/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), unassignable: 0 }),
        credentials: 'include',
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Unassign response is not JSON:', textData, parseError);
        setMessage({ text: `Error: Invalid server response. Please try again or contact support.`, type: 'error' });
        return;
      }
      if (response.ok) {
        setMessage({ text: 'Request unassigned successfully!', type: 'success' });
        setRequests(prev => prev.filter(req => req.id !== requestId));
        fetchData(); // Refresh dashboard
      } else {
        console.error('Unassign failed:', { status: response.status, response: textData });
        setMessage({ text: `Failed to unassign: ${data.error || 'Unknown server error'}`, type: 'error' });
        if (response.status === 403) {
          navigate('/technician-login');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error unassigning request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error. Please check your connection and try again.'}`, type: 'error' });
    }
  };

  const handleComplete: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    setCompletingRequestId(requestId);
    setTechnicianNote('');
    setMessage({ text: 'Enter completion notes.', type: 'info' });
  };

  const handleConfirmComplete = async () => {
    if (!completingRequestId || !technicianId) {
      setMessage({ text: 'Error: Missing request or technician ID.', type: 'error' });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/requests/complete-technician/${completingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), note: technicianNote }),
        credentials: 'include',
      });
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        data = { error: 'Server error: Invalid response format' };
      }
      if (response.ok) {
        setMessage({ text: 'Completion confirmed successfully!', type: 'success' });
        const completedRequest = requests.find(req => req.id === completingRequestId);
        if (completedRequest) {
          const updatedRequest = {
            ...completedRequest,
            status: 'completed_technician' as const,
            technician_note: technicianNote || null,
            lastUpdated: Date.now()
          };
          setCompletedRequests(prev => sortRequests([...prev, updatedRequest]));
          setRequests(prev => prev.filter(req => req.id !== completingRequestId));
        }
        setCompletingRequestId(null);
        setTechnicianNote('');
      } else {
        setMessage({ text: `Failed to complete: ${data.error || 'Unknown error'}`, type: 'error' });
        if (response.status === 403) {
          navigate('/technician-login');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error confirming completion:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleCancelComplete = () => {
    setCompletingRequestId(null);
    setTechnicianNote('');
    setMessage({ text: '', type: '' });
  };

  const handleEditProfile = () => {
    navigate('/technician-edit-profile');
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

  const getGoogleMapsLink = (address: string | null, city: string | null, postalCode: string | null): string => {
    const fullAddress = `${address}, ${city}, ${postalCode}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
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
              onClick={toggleAudio}
              sx={{
                background: audioEnabled ? 'linear-gradient(to right, #eab308, #ca8a04)' : 'linear-gradient(to right, #6b7280, #4b5563)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              <FaBell style={{ marginRight: '8px' }} />
              Audio Notifications: {audioEnabled ? 'On' : 'Off'}
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
                  {completedRequests.length === 0 ? (
                    <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                      <CardContent>
                        <Typography sx={{ color: '#ffffff' }}>No completed jobs.</Typography>
                      </CardContent>
                    </Card>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {completedRequests.map(request => {
                        const isExpanded = expandedRequests[request.id] || false;
                        const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                        const displayDescription = isExpanded || !isLong
                          ? request.repair_description ?? 'Unknown'
                          : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                        const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                        const fullAddress = `${request.customer_address}, ${request.customer_city}, ${request.customer_postal_code}`.trim();
                        if (!request.technician_note) {
                          console.warn(`No technician note available for completed request ID ${request.id}`);
                        }
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
                                <strong>Customer Name:</strong> {request.customer_name ?? 'Not provided'}
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Customer Address:</strong> <a href={getGoogleMapsLink(request.customer_address, request.customer_city, request.customer_postal_code)} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{fullAddress}</a>
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Phone Number:</strong> {request.customer_phone_number ?? 'Not provided'}
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Alternate Phone Number:</strong> {request.customer_alternate_phone_number ?? 'Not provided'}
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Email:</strong> {request.email ?? 'Not provided'}
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
                                <strong>Technician ID:</strong> {request.technician_id ?? 'Not assigned'}
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
              ) : (
                <>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                    Service Requests
                  </Typography>
                  {requests.length === 0 ? (
                    <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                      <CardContent>
                        <Typography sx={{ color: '#ffffff' }}>No service requests available.</Typography>
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
                        const fullAddress = `${request.customer_address}, ${request.customer_city}, ${request.customer_postal_code}`.trim();
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
                                <strong>Customer Name:</strong> {request.customer_name ?? 'Not provided'}
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Customer Address:</strong> <a href={getGoogleMapsLink(request.customer_address, request.customer_city, request.customer_postal_code)} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{fullAddress}</a>
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Phone Number:</strong> {request.customer_phone_number ?? 'Not provided'}
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Alternate Phone Number:</strong> {request.customer_alternate_phone_number ?? 'Not provided'}
                              </Typography>
                              <Typography sx={{ mb: 1, color: '#ffffff' }}>
                                <strong>Email:</strong> {request.email ?? 'Not provided'}
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
                                <strong>Technician ID:</strong> {request.technician_id ?? 'Not assigned'}
                              </Typography>
                              {request.status === 'pending' && request.technician_id === null && (
                                <Button
                                  data-id={request.id}
                                  onClick={handleAccept}
                                  variant="contained"
                                  sx={{
                                    mt: 2,
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
                                  Accept Job
                                </Button>
                              )}
                              {request.status === 'assigned' && request.technician_id === parseInt(technicianId || '0') && (
                                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                                  <Button
                                    data-id={request.id}
                                    onClick={handleComplete}
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
                                    Complete Job
                                  </Button>
                                  <Button
                                    data-id={request.id}
                                    onClick={handleUnassign}
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
                                    Unassign Job
                                  </Button>
                                </Box>
                              )}
                              {acceptingRequestId === request.id && (
                                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                      onClick={() => setSelectedAvailability(1)}
                                      variant={selectedAvailability === 1 ? 'contained' : 'outlined'}
                                      sx={{
                                        background: selectedAvailability === 1 ? 'linear-gradient(to right, #3b82f6, #1e40af)' : 'transparent',
                                        color: '#ffffff',
                                        borderColor: '#ffffff',
                                        '&:hover': { borderColor: '#3b82f6', background: selectedAvailability === 1 ? 'linear-gradient(to right, #3b82f6, #1e40af)' : 'rgba(255, 255, 255, 0.1)' }
                                      }}
                                    >
                                      Availability 1
                                    </Button>
                                    <Button
                                      onClick={() => setSelectedAvailability(2)}
                                      variant={selectedAvailability === 2 ? 'contained' : 'outlined'}
                                      sx={{
                                        background: selectedAvailability === 2 ? 'linear-gradient(to right, #3b82f6, #1e40af)' : 'transparent',
                                        color: '#ffffff',
                                        borderColor: '#ffffff',
                                        '&:hover': { borderColor: '#3b82f6', background: selectedAvailability === 2 ? 'linear-gradient(to right, #3b82f6, #1e40af)' : 'rgba(255, 255, 255, 0.1)' }
                                      }}
                                    >
                                      Availability 2
                                    </Button>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                      onClick={handleConfirmAccept}
                                      variant="contained"
                                      disabled={!selectedAvailability}
                                      sx={{
                                        background: 'linear-gradient(to right, #22c55e, #15803d)',
                                        color: '#ffffff',
                                        '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' },
                                        '&.Mui-disabled': { opacity: 0.5 }
                                      }}
                                    >
                                      Confirm Accept
                                    </Button>
                                    <Button
                                      onClick={handleCancelAccept}
                                      variant="outlined"
                                      sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                                    >
                                      Cancel
                                    </Button>
                                  </Box>
                                </Box>
                              )}
                              {completingRequestId === request.id && (
                                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <TextField
                                    label="Completion Notes"
                                    value={technicianNote}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTechnicianNote(e.target.value)}
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
                                  <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
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
                                      Confirm Completion
                                    </Button>
                                    <Button
                                      onClick={handleCancelComplete}
                                      variant="outlined"
                                      sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
                                    >
                                      Cancel
                                    </Button>
                                  </Box>
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
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
}