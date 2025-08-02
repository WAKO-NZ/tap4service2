/**
 * CustomerDashboard.tsx - Version V1.19
 * - Displays outstanding customer service requests (status: 'pending' or 'assigned') in a list format.
 * - Shows fields: id, repair_description, created_at, customer_availability_1, customer_availability_2, customer_id, region, status, system_types, technician_id.
 * - Includes forms to reschedule (update customer_availability_1, customer_availability_2) and edit repair_description.
 * - Adds a cancel button to set status to 'cancelled'.
 * - Shows "No service requests found" if no outstanding requests.
 * - Highlights new requests with blue border and text wrapping.
 * - Includes "Log a Problem for Tech Assistance" and "Edit Profile" buttons.
 * - Uses logo from public_html/Tap4Service Logo 1.png.
 * - Updates login_status to 'offline' on logout via POST /api/customers-logout.php and redirects to landing page (/).
 * - Uses date-fns for date handling.
 * - Sets all text to white (#ffffff) for visibility on dark background.
 * - Enhanced error handling with ErrorBoundary.
 * - Fixed rendering logic to ensure requests are displayed.
 * - Fixed TypeScript error by importing OutlinedInput.
 * - Added logging to debug localStorage and request fetching.
 * - Simplified rendering logic and added logging for requests content.
 */
import React, { useEffect, useState, Component } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, isValid, isBefore, startOfDay, addHours, parse } from 'date-fns';
import { Box, Button, Card, CardContent, Typography, Container, TextField, FormControl, InputLabel, Select, MenuItem, OutlinedInput } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { FaSignOutAlt, FaPlus, FaUser, FaEdit, FaCalendarAlt, FaTrash } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

const TIME_SLOTS = [
  '04:00 AM - 06:00 AM',
  '06:00 AM - 08:00 AM',
  '08:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 02:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
  '06:00 PM - 08:00 PM'
];

interface Request {
  id: number;
  repair_description: string;
  created_at: string | null;
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  customer_id: number;
  region: string;
  status: string;
  system_types: string[];
  technician_id: number | null;
  technician_name: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in CustomerDashboard:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ffffff] p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please try refreshing the page or contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline">
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4 flex space-x-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-[#ffffff] py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              Reload Page
            </button>
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRequestId, setNewRequestId] = useState<number | null>(null);
  const [editRequestId, setEditRequestId] = useState<number | null>(null);
  const [rescheduleRequestId, setRescheduleRequestId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [rescheduleDate1, setRescheduleDate1] = useState<Date | null>(null);
  const [rescheduleTime1, setRescheduleTime1] = useState('');
  const [rescheduleDate2, setRescheduleDate2] = useState<Date | null>(null);
  const [rescheduleTime2, setRescheduleTime2] = useState('');

  const userId = localStorage.getItem('userId');
  const customerId = userId ? parseInt(userId, 10) : 0;
  const userName = localStorage.getItem('userName') || 'Customer';
  const role = localStorage.getItem('role') || '';

  useEffect(() => {
    console.log('Component mounted, localStorage:', {
      userId: localStorage.getItem('userId'),
      role: localStorage.getItem('role'),
      userName: localStorage.getItem('userName')
    });
    console.log(`Parsed customerId: ${customerId}, role: ${role}`);

    if (role !== 'customer' || !customerId || isNaN(customerId)) {
      console.error('Unauthorized access attempt: Invalid customerId or role');
      navigate('/customer-login');
      return;
    }

    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      let newRequests: Request[] = [];

      try {
        console.log(`Fetching requests for customerId: ${customerId}`);
        const response = await fetch(`${API_URL}/api/requests/customer/${customerId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const textData = await response.text();
        console.log(`GET API response status: ${response.status}, Response: ${textData}`);

        if (!response.ok) {
          let data;
          try {
            data = JSON.parse(textData);
          } catch {
            throw new Error('Invalid server response format');
          }
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
        }

        const data = JSON.parse(textData);
        console.log('GET response data:', data);
        newRequests = Array.isArray(data) ? data : [];
        console.log('Requests fetched (GET):', newRequests);
      } catch (err: any) {
        console.error(`Error fetching GET data: ${err.message}`);
        setError(err.message);
      } finally {
        setRequests(newRequests);
        console.log('Requests state set:', newRequests);
        setLoading(false);
        console.log('Final requests state after fetch:', newRequests);
      }
    };

    fetchRequests();

    // Check for new request
    const newRequest = localStorage.getItem('newRequestId');
    if (newRequest) {
      setNewRequestId(parseInt(newRequest, 10));
      localStorage.removeItem('newRequestId');
    }
  }, [navigate, customerId, role]);

  useEffect(() => {
    console.log('Requests state updated:', requests);
    console.log('Rendering requests:', requests.map(req => ({ id: req.id, status: req.status, repair_description: req.repair_description })));
  }, [requests]);

  const handleEditDescription = async (requestId: number) => {
    if (!editDescription.trim()) {
      setError('Description is required');
      window.scrollTo(0, 0);
      return;
    }
    if (editDescription.trim().length > 255) {
      setError('Description must not exceed 255 characters');
      window.scrollTo(0, 0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/requests/update-description/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customerId, repair_description: editDescription.trim() })
      });
      const textData = await response.text();
      console.log(`Update description API response status: ${response.status}, Response: ${textData}`);

      if (!response.ok) {
        let data;
        try {
          data = JSON.parse(textData);
        } catch {
          throw new Error('Invalid server response format');
        }
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
      }

      const data = JSON.parse(textData);
      console.log('Description updated successfully:', data);
      setRequests(requests.map(req => req.id === requestId ? { ...req, repair_description: editDescription } : req));
      setEditRequestId(null);
      setEditDescription('');
      setError(null);
    } catch (err: any) {
      console.error(`Error updating description: ${err.message}`);
      setError(err.message);
      window.scrollTo(0, 0);
    }
  };

  const handleReschedule = async (requestId: number) => {
    if (!rescheduleDate1 || !isValid(rescheduleDate1) || !rescheduleTime1) {
      setError('Primary availability date and time are required');
      window.scrollTo(0, 0);
      return;
    }
    const today = startOfDay(new Date());
    if (isBefore(rescheduleDate1, today)) {
      setError('Primary availability date must be today or in the future');
      window.scrollTo(0, 0);
      return;
    }
    const startTime = rescheduleTime1.split(' - ')[0];
    const [hours, minutes] = startTime.split(':');
    const isPM = startTime.includes('PM');
    let hourNum = parseInt(hours);
    if (isPM && hourNum !== 12) hourNum += 12;
    if (!isPM && hourNum === 12) hourNum = 0;
    const formattedDate = startOfDay(rescheduleDate1);
    const availability1 = addHours(formattedDate, hourNum);
    availability1.setMinutes(parseInt(minutes));
    if (!isValid(availability1) || isBefore(availability1, new Date())) {
      setError('Primary availability time must be a valid future time');
      window.scrollTo(0, 0);
      return;
    }
    let availability2: Date | null = null;
    if (rescheduleTime2) {
      if (!rescheduleDate2 || !isValid(rescheduleDate2)) {
        setError('Secondary availability date is required if time is provided');
        window.scrollTo(0, 0);
        return;
      }
      if (isBefore(rescheduleDate2, today)) {
        setError('Secondary availability date must be today or in the future');
        window.scrollTo(0, 0);
        return;
      }
      const startTime2 = rescheduleTime2.split(' - ')[0];
      const [hours2, minutes2] = startTime2.split(':');
      const isPM2 = startTime2.includes('PM');
      let hourNum2 = parseInt(hours2);
      if (isPM2 && hourNum2 !== 12) hourNum2 += 12;
      if (!isPM2 && hourNum2 === 12) hourNum2 = 0;
      const formattedDate2 = startOfDay(rescheduleDate2);
      availability2 = addHours(formattedDate2, hourNum2);
      availability2.setMinutes(parseInt(minutes2));
      if (!isValid(availability2) || isBefore(availability2, new Date())) {
        setError('Secondary availability time must be a valid future time');
        window.scrollTo(0, 0);
        return;
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/requests/reschedule/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId,
          availability_1: format(availability1, 'yyyy-MM-dd HH:mm:ss'),
          availability_2: availability2 ? format(availability2, 'yyyy-MM-dd HH:mm:ss') : null
        })
      });
      const textData = await response.text();
      console.log(`Reschedule API response status: ${response.status}, Response: ${textData}`);

      if (!response.ok) {
        let data;
        try {
          data = JSON.parse(textData);
        } catch {
          throw new Error('Invalid server response format');
        }
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
      }

      const data = JSON.parse(textData);
      console.log('Reschedule successful:', data);
      setRequests(requests.map(req => req.id === requestId ? {
        ...req,
        customer_availability_1: format(availability1, 'yyyy-MM-dd HH:mm:ss'),
        customer_availability_2: availability2 ? format(availability2, 'yyyy-MM-dd HH:mm:ss') : null,
        status: 'pending',
        technician_id: null,
        technician_name: null
      } : req));
      setRescheduleRequestId(null);
      setRescheduleDate1(null);
      setRescheduleTime1('');
      setRescheduleDate2(null);
      setRescheduleTime2('');
      setError(null);
    } catch (err: any) {
      console.error(`Error rescheduling: ${err.message}`);
      setError(err.message);
      window.scrollTo(0, 0);
    }
  };

  const handleCancel = async (requestId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customerId })
      });
      const textData = await response.text();
      console.log(`Cancel API response status: ${response.status}, Response: ${textData}`);

      if (!response.ok) {
        let data;
        try {
          data = JSON.parse(textData);
        } catch {
          throw new Error('Invalid server response format');
        }
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
      }

      const data = JSON.parse(textData);
      console.log('Cancel successful:', data);
      setRequests(requests.filter(req => req.id !== requestId));
      setError(null);
    } catch (err: any) {
      console.error(`Error cancelling: ${err.message}`);
      setError(err.message);
      window.scrollTo(0, 0);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_URL}/api/customers-logout.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'logout', user_id: customerId })
      });
      const textData = await response.text();
      console.log(`Logout API response status: ${response.status}, Response: ${textData}`);

      if (!response.ok) {
        let data;
        try {
          data = JSON.parse(textData);
        } catch {
          throw new Error('Invalid server response format');
        }
        throw new Error(`Logout failed! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
      }

      const data = JSON.parse(textData);
      console.log('Logout successful:', data);
    } catch (err: any) {
      console.error(`Logout error: ${err.message}`);
    } finally {
      console.log('Clearing localStorage');
      localStorage.removeItem('userId');
      localStorage.removeItem('role');
      localStorage.removeItem('userName');
      navigate('/');
    }
  };

  const filterPastDates = (date: Date | null) => {
    if (!date) return true;
    const today = startOfDay(new Date());
    return isBefore(date, today);
  };

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

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, gap: 2 }}>
            <Button
              variant="contained"
              component={Link}
              to="/log-technical-callout"
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)',
                  '&::before': { left: '100%' }
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2))',
                  transform: 'skewX(-12deg)',
                  transition: 'left 0.3s'
                }
              }}
            >
              <FaPlus style={{ marginRight: '8px' }} />
              Log a Problem for Tech Assistance
            </Button>
            <Button
              variant="contained"
              component={Link}
              to="/edit-profile"
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)',
                  '&::before': { left: '100%' }
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2))',
                  transform: 'skewX(-12deg)',
                  transition: 'left 0.3s'
                }
              }}
            >
              <FaUser style={{ marginRight: '8px' }} />
              Edit Profile
            </Button>
            <Button
              variant="contained"
              onClick={handleLogout}
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)',
                  '&::before': { left: '100%' }
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2))',
                  transform: 'skewX(-12deg)',
                  transition: 'left 0.3s'
                }
              }}
            >
              <FaSignOutAlt style={{ marginRight: '8px' }} />
              Logout
            </Button>
          </Box>

          {loading ? (
            <Typography sx={{ textAlign: 'center', color: '#ffffff' }}>
              Loading...
            </Typography>
          ) : error ? (
            <Typography sx={{ textAlign: 'center', color: '#ffffff', mb: 2 }}>
              {error}
            </Typography>
          ) : (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Your Outstanding Service Requests
              </Typography>
              {requests.length === 0 ? (
                <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                  <CardContent>
                    <Typography sx={{ color: '#ffffff' }}>No outstanding service requests found</Typography>
                  </CardContent>
                </Card>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {requests.map((request) => (
                    <Card
                      key={request.id}
                      sx={{
                        backgroundColor: '#1f2937',
                        color: '#ffffff',
                        p: 2,
                        borderRadius: '12px',
                        border: newRequestId === request.id ? '2px solid #3b82f6' : 'none'
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', color: '#ffffff' }}>
                          Request #{request.id}
                        </Typography>
                        {editRequestId === request.id ? (
                          <Box sx={{ mb: 2 }}>
                            <TextField
                              label="Job Description"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              fullWidth
                              required
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
                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                              <Button
                                variant="contained"
                                onClick={() => handleEditDescription(request.id)}
                                sx={{
                                  background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                                  color: '#ffffff'
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => {
                                  setEditRequestId(null);
                                  setEditDescription('');
                                }}
                                sx={{ color: '#ffffff', borderColor: '#ffffff' }}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Typography sx={{ mb: 1, wordBreak: 'break-word', color: '#ffffff' }}>
                            <strong>Job Description:</strong> {request.repair_description}
                            <Button
                              onClick={() => {
                                setEditRequestId(request.id);
                                setEditDescription(request.repair_description);
                              }}
                              sx={{ ml: 2, color: '#3b82f6' }}
                            >
                              <FaEdit />
                            </Button>
                          </Typography>
                        )}
                        <Typography sx={{ mb: 1, color: '#ffffff' }}>
                          <strong>Created At:</strong> {request.created_at ? format(new Date(request.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </Typography>
                        {rescheduleRequestId === request.id ? (
                          <Box sx={{ mb: 2 }}>
                            <DatePicker
                              label="Primary Availability Date"
                              value={rescheduleDate1}
                              onChange={(date: Date | null) => setRescheduleDate1(date)}
                              shouldDisableDate={filterPastDates}
                              format="dd/MM/yyyy"
                              slotProps={{
                                textField: {
                                  variant: 'outlined',
                                  size: 'medium',
                                  fullWidth: true,
                                  required: true,
                                  InputProps: {
                                    className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]'
                                  },
                                  sx: {
                                    '& .MuiInputLabel-root': { color: '#ffffff' },
                                    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#ffffff' }, '&:hover fieldset': { borderColor: '#3b82f6' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }
                                  }
                                },
                                popper: {
                                  placement: 'bottom-start',
                                  sx: {
                                    '& .MuiPaper-root': { backgroundColor: '#374151', color: '#ffffff' },
                                    '& .MuiPickersDay-root': { color: '#ffffff' },
                                    '& .MuiPickersDay-root.Mui-selected': { backgroundColor: '#3b82f6', color: '#ffffff' },
                                    '& .MuiPickersDay-root:hover': { backgroundColor: '#4b5563', color: '#ffffff' },
                                    '& .MuiPickersCalendarHeader-label': { color: '#ffffff' },
                                    '& .MuiPickersArrowSwitcher-button': { color: '#ffffff' },
                                    '& .MuiPickersYear-yearButton': { color: '#ffffff' },
                                    '& .MuiPickersYear-yearButton.Mui-selected': { backgroundColor: '#3b82f6', color: '#ffffff' }
                                  }
                                }
                              }}
                            />
                            <FormControl fullWidth required sx={{ mt: 2 }}>
                              <InputLabel id="time-slot1-label" sx={{ color: '#ffffff' }}>Primary Availability Time</InputLabel>
                              <Select
                                labelId="time-slot1-label"
                                value={rescheduleTime1}
                                onChange={(e) => setRescheduleTime1(e.target.value as string)}
                                input={<OutlinedInput label="Primary Availability Time" className="bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
                                MenuProps={{
                                  disablePortal: true,
                                  PaperProps: { sx: { backgroundColor: '#374151', color: '#ffffff' } }
                                }}
                                sx={{ '& .MuiSelect-icon': { color: '#ffffff' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#ffffff' }, '&:hover fieldset': { borderColor: '#3b82f6' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } } }}
                              >
                                {TIME_SLOTS.map((slot) => (
                                  <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <DatePicker
                              label="Secondary Availability Date"
                              value={rescheduleDate2}
                              onChange={(date: Date | null) => setRescheduleDate2(date)}
                              shouldDisableDate={filterPastDates}
                              format="dd/MM/yyyy"
                              slotProps={{
                                textField: {
                                  variant: 'outlined',
                                  size: 'medium',
                                  fullWidth: true,
                                  sx: {
                                    mt: 2,
                                    '& .MuiInputLabel-root': { color: '#ffffff' },
                                    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#ffffff' }, '&:hover fieldset': { borderColor: '#3b82f6' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }
                                  },
                                  InputProps: {
                                    className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]'
                                  }
                                },
                                popper: {
                                  placement: 'bottom-start',
                                  sx: {
                                    '& .MuiPaper-root': { backgroundColor: '#374151', color: '#ffffff' },
                                    '& .MuiPickersDay-root': { color: '#ffffff' },
                                    '& .MuiPickersDay-root.Mui-selected': { backgroundColor: '#3b82f6', color: '#ffffff' },
                                    '& .MuiPickersDay-root:hover': { backgroundColor: '#4b5563', color: '#ffffff' },
                                    '& .MuiPickersCalendarHeader-label': { color: '#ffffff' },
                                    '& .MuiPickersArrowSwitcher-button': { color: '#ffffff' },
                                    '& .MuiPickersYear-yearButton': { color: '#ffffff' },
                                    '& .MuiPickersYear-yearButton.Mui-selected': { backgroundColor: '#3b82f6', color: '#ffffff' }
                                  }
                                }
                              }}
                            />
                            <FormControl fullWidth sx={{ mt: 2 }}>
                              <InputLabel id="time-slot2-label" sx={{ color: '#ffffff' }}>Secondary Availability Time</InputLabel>
                              <Select
                                labelId="time-slot2-label"
                                value={rescheduleTime2}
                                onChange={(e) => setRescheduleTime2(e.target.value as string)}
                                input={<OutlinedInput label="Secondary Availability Time" className="bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
                                MenuProps={{
                                  disablePortal: true,
                                  PaperProps: { sx: { backgroundColor: '#374151', color: '#ffffff' } }
                                }}
                                sx={{ '& .MuiSelect-icon': { color: '#ffffff' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#ffffff' }, '&:hover fieldset': { borderColor: '#3b82f6' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } } }}
                              >
                                <MenuItem value="" sx={{ color: '#ffffff' }}>None</MenuItem>
                                {TIME_SLOTS.map((slot) => (
                                  <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                              <Button
                                variant="contained"
                                onClick={() => handleEditDescription(request.id)}
                                sx={{
                                  background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                                  color: '#ffffff'
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => {
                                  setRescheduleRequestId(null);
                                  setRescheduleDate1(null);
                                  setRescheduleTime1('');
                                  setRescheduleDate2(null);
                                  setRescheduleTime2('');
                                }}
                                sx={{ color: '#ffffff', borderColor: '#ffffff' }}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Typography sx={{ mb: 1, color: '#ffffff' }}>
                            <strong>Availability 1:</strong> {request.customer_availability_1 ? format(new Date(request.customer_availability_1), 'dd/MM/yyyy HH:mm') : 'N/A'}
                            <Button
                              onClick={() => {
                                setRescheduleRequestId(request.id);
                                setRescheduleDate1(request.customer_availability_1 ? new Date(request.customer_availability_1) : null);
                                setRescheduleTime1('');
                                setRescheduleDate2(request.customer_availability_2 ? new Date(request.customer_availability_2) : null);
                                setRescheduleTime2('');
                              }}
                              sx={{ ml: 2, color: '#3b82f6' }}
                            >
                              <FaCalendarAlt />
                            </Button>
                          </Typography>
                        )}
                        <Typography sx={{ mb: 1, color: '#ffffff' }}>
                          <strong>Availability 2:</strong> {request.customer_availability_2 ? format(new Date(request.customer_availability_2), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </Typography>
                        <Typography sx={{ mb: 1, color: '#ffffff' }}>
                          <strong>Customer ID:</strong> {request.customer_id}
                        </Typography>
                        <Typography sx={{ mb: 1, color: '#ffffff' }}>
                          <strong>Region:</strong> {request.region}
                        </Typography>
                        <Typography sx={{ mb: 1, color: '#ffffff' }}>
                          <strong>Status:</strong> {request.status}
                        </Typography>
                        <Typography sx={{ mb: 1, wordBreak: 'break-word', color: '#ffffff' }}>
                          <strong>System Types:</strong> {request.system_types.join(', ')}
                        </Typography>
                        <Typography sx={{ mb: 1, color: '#ffffff' }}>
                          <strong>Technician:</strong> {request.technician_name || 'Not assigned'}
                        </Typography>
                        <Button
                          variant="contained"
                          color="error"
                          onClick={() => handleCancel(request.id)}
                          sx={{ mt: 2 }}
                        >
                          <FaTrash style={{ marginRight: '8px' }} />
                          Cancel Request
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CustomerDashboard;