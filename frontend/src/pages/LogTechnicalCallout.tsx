/**
 * LogTechnicalCallout.tsx - Version V1.30
 * - Located in /frontend/src/pages/
 * - Allows customers to log a technical callout via POST /api/customer_request.php?path=create.
 * - Supports rescheduling via PUT /api/requests/reschedule/{requestId} when requestId is provided in query.
 * - Pre-populates form with request data for rescheduling.
 * - Makes repair_description, customer_availability_1, and region required; customer_availability_2 and system_types optional.
 * - Uses date-fns for date handling, including addHours.
 * - Sets all text to white (#ffffff) for visibility on dark background.
 * - Enhanced error handling with ErrorBoundary.
 * - Styled with dark gradient background, gray card, blue gradient buttons.
 * - Added "Back" button to return to /customer-dashboard.
 * - Validates input to match customer_request.php requirements.
 * - Fixed text color for selected values in DatePicker and Select to white (#ffffff).
 * - Changed System Types to checkboxes.
 * - Fixed POST 400 errors by aligning payload keys (customer_availability_1) and enhancing validation.
 * - Customized Popper with disablePortal and focus management for aria-hidden warning.
 * - Integrated with App.tsx modal state for accessibility.
 * - Fixed TypeScript errors by moving autoFocus to inputProps.
 */
import React, { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { format, isValid, isBefore, startOfDay, addHours, parse } from 'date-fns';
import { Box, Button, TextField, Typography, Container, FormControl, InputLabel, Select, MenuItem, OutlinedInput, FormControlLabel, Checkbox } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { FaPlus, FaArrowLeft } from 'react-icons/fa';

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

const REGIONS = [
  'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay',
  'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
  'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'
];

const SYSTEM_TYPES = [
  'Alarm System', 'CCTV', 'Gate Motor', 'Garage Motor',
  'Access Control System', 'Smoke Detectors'
];

interface Request {
  id: number;
  repair_description: string | null;
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  region: string | null;
  system_types: string[];
}

interface LogTechnicalCalloutProps {
  onModalToggle?: (open: boolean) => void;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error in LogTechnicalCallout:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ffffff] p-8" style={{ color: '#ffffff' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#ffffff' }}>Something went wrong</h2>
          <p style={{ color: '#ffffff' }}>{this.state.errorMessage}</p>
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

const LogTechnicalCallout: React.FC<LogTechnicalCalloutProps> = ({ onModalToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [repairDescription, setRepairDescription] = useState('');
  const [availabilityDate1, setAvailabilityDate1] = useState<Date | null>(null);
  const [availabilityTime1, setAvailabilityTime1] = useState('');
  const [availabilityDate2, setAvailabilityDate2] = useState<Date | null>(null);
  const [availabilityTime2, setAvailabilityTime2] = useState('');
  const [region, setRegion] = useState('');
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [isPopperOpen, setIsPopperOpen] = useState(false);

  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);

  useEffect(() => {
    if (!customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    const params = new URLSearchParams(location.search);
    const reqId = params.get('requestId');
    if (reqId) {
      setIsReschedule(true);
      setRequestId(parseInt(reqId));
      fetchRequestData(parseInt(reqId));
    }
  }, [navigate, customerId, location.search]);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(isPopperOpen);
    }
  }, [isPopperOpen, onModalToggle]);

  const fetchRequestData = async (reqId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/customer_request.php?path=requests`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: { requests: Request[] } = await response.json();
      if (!data.requests || !Array.isArray(data.requests)) {
        throw new Error('Invalid response format: requests not found');
      }
      const request = data.requests.find(req => req.id === reqId);
      if (request) {
        setRepairDescription(request.repair_description ?? '');
        setRegion(request.region ?? '');
        setSystemTypes(request.system_types ?? []);
        if (request.customer_availability_1) {
          const date1 = new Date(request.customer_availability_1);
          setAvailabilityDate1(date1);
          const time1 = format(date1, 'hh:mm aa');
          const slot1 = TIME_SLOTS.find(slot => slot.startsWith(time1.split(':')[0]));
          setAvailabilityTime1(slot1 || '');
        }
        if (request.customer_availability_2) {
          const date2 = new Date(request.customer_availability_2);
          setAvailabilityDate2(date2);
          const time2 = format(date2, 'hh:mm aa');
          const slot2 = TIME_SLOTS.find(slot => slot.startsWith(time2.split(':')[0]));
          setAvailabilityTime2(slot2 || '');
        }
      } else {
        setMessage({ text: 'Request not found.', type: 'error' });
      }
    } catch (err: any) {
      console.error('Error fetching request data:', err);
      setMessage({ text: `Error fetching request data: ${err.message}`, type: 'error' });
    }
  };

  const validateInputs = () => {
    if (!repairDescription.trim()) {
      setMessage({ text: 'Job description is required.', type: 'error' });
      return false;
    }
    if (repairDescription.length > 255) {
      setMessage({ text: 'Job description must not exceed 255 characters.', type: 'error' });
      return false;
    }
    if (!availabilityDate1 || !isValid(availabilityDate1) || !availabilityTime1) {
      setMessage({ text: 'Primary availability date and time are required.', type: 'error' });
      return false;
    }
    if (!region || !REGIONS.includes(region)) {
      setMessage({ text: 'Region is required and must be valid.', type: 'error' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateInputs()) {
      window.scrollTo(0, 0);
      return;
    }

    // Format availability dates
    let customer_availability_1: string | null = null;
    let customer_availability_2: string | null = null;

    const today = startOfDay(new Date());
    if (availabilityDate1 && isValid(availabilityDate1) && availabilityTime1) {
      if (isBefore(availabilityDate1, today)) {
        setMessage({ text: 'Primary availability date cannot be in the past.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      const startTime = availabilityTime1.split(' - ')[0];
      const [hours, minutes] = startTime.split(':');
      const isPM = startTime.includes('PM');
      let hourNum = parseInt(hours);
      if (isPM && hourNum !== 12) hourNum += 12;
      if (!isPM && hourNum === 12) hourNum = 0;
      const formattedDate = startOfDay(availabilityDate1);
      const availability1 = addHours(formattedDate, hourNum);
      availability1.setMinutes(parseInt(minutes));
      if (!isValid(availability1) || isBefore(availability1, new Date())) {
        setMessage({ text: 'Invalid primary availability date or time.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      customer_availability_1 = format(availability1, 'yyyy-MM-dd HH:mm:ss');
    }

    if (availabilityDate2 && isValid(availabilityDate2) && availabilityTime2) {
      if (isBefore(availabilityDate2, today)) {
        setMessage({ text: 'Secondary availability date cannot be in the past.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      const startTime2 = availabilityTime2.split(' - ')[0];
      const [hours2, minutes2] = startTime2.split(':');
      const isPM2 = startTime2.includes('PM');
      let hourNum2 = parseInt(hours2);
      if (isPM2 && hourNum2 !== 12) hourNum2 += 12;
      if (!isPM2 && hourNum2 === 12) hourNum2 = 0;
      const formattedDate2 = startOfDay(availabilityDate2);
      const availability2 = addHours(formattedDate2, hourNum2);
      availability2.setMinutes(parseInt(minutes2));
      if (isValid(availability2) && !isBefore(availability2, new Date())) {
        customer_availability_2 = format(availability2, 'yyyy-MM-dd HH:mm:ss');
      }
    }

    const requestData = {
      path: 'create',
      customerId,
      repair_description: repairDescription.trim(),
      customer_availability_1,
      customer_availability_2,
      region,
      system_types: systemTypes.length > 0 ? systemTypes : []
    };

    console.log('Submitting payload:', requestData);

    try {
      setIsSubmitting(true);
      let response;
      if (isReschedule && requestId) {
        const rescheduleData = {
          customerId,
          customer_availability_1,
          customer_availability_2,
          region,
          system_types: systemTypes
        };
        console.log('Rescheduling payload:', rescheduleData);
        response = await fetch(`${API_URL}/api/requests/reschedule/${requestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(rescheduleData),
        });
      } else {
        response = await fetch(`${API_URL}/api/customer_request.php?path=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(requestData),
        });
      }
      const textData = await response.text();
      console.log(`Submit API response status: ${response.status}, Response: ${textData}`);

      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        throw new Error('Invalid server response format');
      }

      if (response.ok && data.success) {
        console.log(`${isReschedule ? 'Reschedule' : 'Callout'} submitted successfully:`, data);
        setMessage({ text: isReschedule ? 'Request rescheduled successfully!' : data.message || 'Callout submitted successfully!', type: 'success' });
        setTimeout(() => navigate('/customer-dashboard'), 2000);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error(`Error submitting ${isReschedule ? 'reschedule' : 'callout'}: ${err.message}`);
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSystemTypeChange = (type: string) => {
    setSystemTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="md" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {isReschedule ? 'Reschedule Request' : 'Log a Technical Callout'}
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ backgroundColor: '#1f2937', p: 4, borderRadius: '12px', color: '#ffffff' }}>
            <form onSubmit={handleSubmit} className="space-y-6" style={{ color: '#ffffff' }}>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Job Description *</Typography>
                <TextField
                  value={repairDescription}
                  onChange={(e) => setRepairDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  required
                  error={!repairDescription.trim() && message.type === 'error'}
                  helperText={!repairDescription.trim() && message.type === 'error' ? 'Job description is required.' : ''}
                  inputProps={{ maxLength: 255 }}
                  sx={{
                    '& .MuiInputLabel-root': { color: '#ffffff' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& textarea': { color: '#ffffff' }
                    }
                  }}
                  InputProps={{ sx: { backgroundColor: '#374151', borderRadius: '8px' } }}
                />
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Primary Availability Date *</Typography>
                <DatePicker
                  label="Primary Availability Date"
                  value={availabilityDate1}
                  onChange={(date: Date | null) => setAvailabilityDate1(date)}
                  onOpen={() => setIsPopperOpen(true)}
                  onClose={() => setIsPopperOpen(false)}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      size: 'medium',
                      fullWidth: true,
                      required: true,
                      error: (!availabilityDate1 || !isValid(availabilityDate1)) && message.type === 'error',
                      helperText: (!availabilityDate1 || !isValid(availabilityDate1)) && message.type === 'error' ? 'Primary availability date is required.' : '',
                      InputProps: {
                        sx: { backgroundColor: '#374151', borderRadius: '8px', color: '#ffffff' }
                      },
                      sx: {
                        '& .MuiInputLabel-root': { color: '#ffffff' },
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#ffffff' },
                          '&:hover fieldset': { borderColor: '#3b82f6' },
                          '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                          '& input': { color: '#ffffff' }
                        }
                      }
                    },
                    popper: {
                      disablePortal: true,
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
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Primary Availability Time *</Typography>
                <FormControl fullWidth error={!availabilityTime1 && message.type === 'error'}>
                  <InputLabel id="time-slot1-label" sx={{ color: '#ffffff' }}>Select Time</InputLabel>
                  <Select
                    labelId="time-slot1-label"
                    value={availabilityTime1}
                    onChange={(e) => setAvailabilityTime1(e.target.value as string)}
                    onOpen={() => setIsPopperOpen(true)}
                    onClose={() => setIsPopperOpen(false)}
                    input={<OutlinedInput label="Select Time" />}
                    inputProps={{ autoFocus: false }}
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { sx: { backgroundColor: '#374151', color: '#ffffff' } }
                    }}
                    sx={{
                      '& .MuiSelect-icon': { color: '#ffffff' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        '& .MuiSelect-select': { color: '#ffffff' }
                      }
                    }}
                    required
                  >
                    <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Time</MenuItem>
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                    ))}
                  </Select>
                  {!availabilityTime1 && message.type === 'error' && (
                    <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                      Primary availability time is required.
                    </Typography>
                  )}
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Secondary Availability Date</Typography>
                <DatePicker
                  label="Secondary Availability Date"
                  value={availabilityDate2}
                  onChange={(date: Date | null) => setAvailabilityDate2(date)}
                  onOpen={() => setIsPopperOpen(true)}
                  onClose={() => setIsPopperOpen(false)}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      size: 'medium',
                      fullWidth: true,
                      InputProps: {
                        sx: { backgroundColor: '#374151', borderRadius: '8px', color: '#ffffff' }
                      },
                      sx: {
                        '& .MuiInputLabel-root': { color: '#ffffff' },
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#ffffff' },
                          '&:hover fieldset': { borderColor: '#3b82f6' },
                          '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                          '& input': { color: '#ffffff' }
                        }
                      }
                    },
                    popper: {
                      disablePortal: true,
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
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Secondary Availability Time</Typography>
                <FormControl fullWidth>
                  <InputLabel id="time-slot2-label" sx={{ color: '#ffffff' }}>Select Time</InputLabel>
                  <Select
                    labelId="time-slot2-label"
                    value={availabilityTime2}
                    onChange={(e) => setAvailabilityTime2(e.target.value as string)}
                    onOpen={() => setIsPopperOpen(true)}
                    onClose={() => setIsPopperOpen(false)}
                    input={<OutlinedInput label="Select Time" />}
                    inputProps={{ autoFocus: false }}
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { sx: { backgroundColor: '#374151', color: '#ffffff' } }
                    }}
                    sx={{
                      '& .MuiSelect-icon': { color: '#ffffff' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        '& .MuiSelect-select': { color: '#ffffff' }
                      }
                    }}
                  >
                    <MenuItem value="" sx={{ color: '#ffffff' }}>None</MenuItem>
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Region *</Typography>
                <FormControl fullWidth error={!region && message.type === 'error'}>
                  <InputLabel id="region-label" sx={{ color: '#ffffff' }}>Select Region</InputLabel>
                  <Select
                    labelId="region-label"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as string)}
                    onOpen={() => setIsPopperOpen(true)}
                    onClose={() => setIsPopperOpen(false)}
                    input={<OutlinedInput label="Select Region" />}
                    inputProps={{ autoFocus: false }}
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { sx: { backgroundColor: '#374151', color: '#ffffff' } }
                    }}
                    sx={{
                      '& .MuiSelect-icon': { color: '#ffffff' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        '& .MuiSelect-select': { color: '#ffffff' }
                      }
                    }}
                    required
                  >
                    <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Region</MenuItem>
                    {REGIONS.map((regionOption) => (
                      <MenuItem key={regionOption} value={regionOption} sx={{ color: '#ffffff' }}>{regionOption}</MenuItem>
                    ))}
                  </Select>
                  {!region && message.type === 'error' && (
                    <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                      Region is required.
                    </Typography>
                  )}
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>System Types</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {SYSTEM_TYPES.map((type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Checkbox
                          checked={systemTypes.includes(type)}
                          onChange={() => handleSystemTypeChange(type)}
                          sx={{
                            color: '#ffffff',
                            '&.Mui-checked': { color: '#3b82f6' }
                          }}
                        />
                      }
                      label={<Typography sx={{ color: '#ffffff' }}>{type}</Typography>}
                    />
                  ))}
                </Box>
              </Box>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  width: '100%',
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
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5
                  }
                }}
              >
                <FaPlus style={{ marginRight: '8px', color: '#ffffff' }} />
                {isSubmitting ? 'Submitting...' : isReschedule ? 'Reschedule Request' : 'Submit Callout'}
              </Button>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  component={Link}
                  to="/customer-dashboard"
                  sx={{
                    color: '#ffffff',
                    borderColor: '#ffffff',
                    '&:hover': {
                      borderColor: '#3b82f6',
                      color: '#3b82f6'
                    }
                  }}
                >
                  <FaArrowLeft style={{ marginRight: '8px', color: '#ffffff' }} />
                  Back to Dashboard
                </Button>
              </Box>
            </form>
          </Box>
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default LogTechnicalCallout;