/**
 * LogTechnicalCallout.tsx - Version V1.31
 * - Located in /frontend/src/pages/
 * - Allows customers to log a technical callout via POST /api/customer_request.php?path=create.
 * - Supports rescheduling via PUT /api/requests/reschedule/{requestId} when requestId is provided in query.
 * - Pre-populates form with request data for rescheduling.
 * - Makes repair_description, availability_1, region, and system_types required; availability_2 optional.
 * - Uses date-fns for date handling, including addHours.
 * - Sets all text to white (#ffffff) for visibility on dark background.
 * - Enhanced error handling with ErrorBoundary.
 * - Styled with dark gradient background, gray card, blue gradient buttons.
 * - Added "Back" button to return to /customer-dashboard.
 * - Validates input to match customer_request.php requirements.
 * - Fixed text color for selected values in DatePicker and Select to white (#ffffff).
 * - Changed System Types to checkboxes.
 * - Fixed POST 400 errors by aligning payload keys (customer_id, availability_1) and enhancing validation.
 * - Fixed aria-hidden warning by ensuring disablePortal and proper focus management in Select components.
 * - Integrated with App.tsx modal state for accessibility.
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
  '04:00 AM - 06:00 AM', '06:00 AM - 08:00 AM', '08:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM', '12:00 PM - 02:00 PM', '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM', '06:00 PM - 08:00 PM'
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
  const userName = localStorage.getItem('userName') || 'Customer';

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
      const response = await fetch(`${API_URL}/api/requests/customer/${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      const request = data.requests.find((req: Request) => req.id === reqId);
      if (request) {
        setRepairDescription(request.repair_description ?? '');
        setRegion(request.region ?? '');
        setSystemTypes(request.system_types ?? []);
        if (request.customer_availability_1) {
          const date1 = new Date(request.customer_availability_1);
          setAvailabilityDate1(date1);
          setAvailabilityTime1(format(date1, 'hh:00 aa') + ' - ' + format(addHours(date1, 2), 'hh:00 aa'));
        }
        if (request.customer_availability_2) {
          const date2 = new Date(request.customer_availability_2);
          setAvailabilityDate2(date2);
          setAvailabilityTime2(format(date2, 'hh:00 aa') + ' - ' + format(addHours(date2, 2), 'hh:00 aa'));
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching request data:', error);
      setMessage({ text: 'Failed to load request data.', type: 'error' });
    }
  };

  const handleSystemTypeChange = (type: string) => {
    setSystemTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const parseTimeSlot = (slot: string, date: Date | null): Date | null => {
    if (!slot || !date || !isValid(date)) return null;
    const [startTime] = slot.split(' - ');
    try {
      const parsedTime = parse(startTime, 'hh:mm aa', date);
      return isValid(parsedTime) ? parsedTime : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    // Validate inputs
    if (!repairDescription || repairDescription.length > 255) {
      setMessage({ text: 'Repair description is required and must not exceed 255 characters.', type: 'error' });
      return;
    }
    if (!availabilityDate1 || !isValid(availabilityDate1) || !availabilityTime1) {
      setMessage({ text: 'Primary availability date and time are required.', type: 'error' });
      return;
    }
    if (!region || !REGIONS.includes(region)) {
      setMessage({ text: 'Please select a valid region.', type: 'error' });
      return;
    }
    if (systemTypes.length === 0) {
      setMessage({ text: 'At least one system type is required.', type: 'error' });
      return;
    }
    if (!systemTypes.every(type => SYSTEM_TYPES.includes(type))) {
      setMessage({ text: 'Invalid system type selected.', type: 'error' });
      return;
    }
    if (availabilityDate2 && (!isValid(availabilityDate2) || !availabilityTime2)) {
      setMessage({ text: 'Secondary availability time is incomplete.', type: 'error' });
      return;
    }

    const availability1 = parseTimeSlot(availabilityTime1, availabilityDate1);
    const availability2 = parseTimeSlot(availabilityTime2, availabilityDate2);

    if (!availability1) {
      setMessage({ text: 'Invalid primary availability time.', type: 'error' });
      return;
    }
    if (availability2 && isBefore(availability2, startOfDay(new Date()))) {
      setMessage({ text: 'Secondary availability cannot be in the past.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        path: 'create',
        customer_id: customerId,
        repair_description: repairDescription,
        availability_1: format(availability1, 'yyyy-MM-dd HH:mm:ss'),
        availability_2: availability2 ? format(availability2, 'yyyy-MM-dd HH:mm:ss') : null,
        region,
        system_types: systemTypes,
      };
      console.log('Submitting payload:', payload);

      const endpoint = isReschedule
        ? `${API_URL}/api/requests/reschedule/${requestId}`
        : `${API_URL}/api/customer_request.php?path=create`;
      const method = isReschedule ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const responseText = await response.text();
      console.log('Submit API response status:', response.status, 'Response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      setMessage({ text: data.message || (isReschedule ? 'Request rescheduled successfully!' : 'Callout submitted successfully!'), type: 'success' });
      setTimeout(() => navigate('/request-confirmation'), 2000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error submitting callout:', error.message);
      setMessage({ text: error.message || 'Failed to submit callout.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="md" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {isReschedule ? 'Reschedule Service Request' : 'Log a Technical Callout'} for {userName}
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ maxWidth: '600px', mx: 'auto' }}>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Repair Description *</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    error={!!message.text && !repairDescription}
                    helperText={(!repairDescription && message.type === 'error') ? 'Repair description is required.' : ''}
                    sx={{
                      '& .MuiInputLabel-root': { color: '#ffffff' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        '& textarea': { color: '#ffffff' }
                      },
                      '& .MuiFormHelperText-root': { color: '#ff0000' }
                    }}
                    InputProps={{ sx: { backgroundColor: '#374151', borderRadius: '8px', color: '#ffffff' } }}
                    required
                    inputProps={{ maxLength: 255 }}
                    aria-label="Repair Description"
                  />
                </Box>
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Availability 1 (Date) *</Typography>
                  <DatePicker
                    value={availabilityDate1}
                    onChange={(newValue) => setAvailabilityDate1(newValue)}
                    minDate={new Date()}
                    sx={{
                      '& .MuiInputBase-root': {
                        backgroundColor: '#374151',
                        color: '#ffffff',
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                      },
                      '& .MuiInputLabel-root': { color: '#ffffff' },
                      '& .MuiSvgIcon-root': { color: '#ffffff' }
                    }}
                    slotProps={{
                      textField: { error: !!message.text && !availabilityDate1, helperText: (!availabilityDate1 && message.type === 'error') ? 'Date is required.' : '' },
                      popper: { disablePortal: true, sx: { backgroundColor: '#374151', color: '#ffffff' } }
                    }}
                    aria-label="Primary Availability Date"
                  />
                </Box>
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Availability 1 (Time) *</Typography>
                  <FormControl fullWidth error={!!message.text && !availabilityTime1}>
                    <InputLabel id="availability-time-1-label" sx={{ color: '#ffffff' }}>Select Time</InputLabel>
                    <Select
                      labelId="availability-time-1-label"
                      value={availabilityTime1}
                      onChange={(e) => setAvailabilityTime1(e.target.value as string)}
                      onOpen={() => setIsPopperOpen(true)}
                      onClose={() => setIsPopperOpen(false)}
                      input={<OutlinedInput label="Select Time" />}
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
                      aria-label="Primary Availability Time"
                    >
                      <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Time</MenuItem>
                      {TIME_SLOTS.map((slot) => (
                        <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                      ))}
                    </Select>
                    {!availabilityTime1 && message.type === 'error' && (
                      <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                        Time is required.
                      </Typography>
                    )}
                  </FormControl>
                </Box>
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Availability 2 (Date)</Typography>
                  <DatePicker
                    value={availabilityDate2}
                    onChange={(newValue) => setAvailabilityDate2(newValue)}
                    minDate={new Date()}
                    sx={{
                      '& .MuiInputBase-root': {
                        backgroundColor: '#374151',
                        color: '#ffffff',
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                      },
                      '& .MuiInputLabel-root': { color: '#ffffff' },
                      '& .MuiSvgIcon-root': { color: '#ffffff' }
                    }}
                    slotProps={{
                      textField: { helperText: '' },
                      popper: { disablePortal: true, sx: { backgroundColor: '#374151', color: '#ffffff' } }
                    }}
                    aria-label="Secondary Availability Date"
                  />
                </Box>
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Availability 2 (Time)</Typography>
                  <FormControl fullWidth>
                    <InputLabel id="availability-time-2-label" sx={{ color: '#ffffff' }}>Select Time</InputLabel>
                    <Select
                      labelId="availability-time-2-label"
                      value={availabilityTime2}
                      onChange={(e) => setAvailabilityTime2(e.target.value as string)}
                      onOpen={() => setIsPopperOpen(true)}
                      onClose={() => setIsPopperOpen(false)}
                      input={<OutlinedInput label="Select Time" />}
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
                      aria-label="Secondary Availability Time"
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
                  <FormControl fullWidth error={!!message.text && !region}>
                    <InputLabel id="region-label" sx={{ color: '#ffffff' }}>Select Region</InputLabel>
                    <Select
                      labelId="region-label"
                      value={region}
                      onChange={(e) => setRegion(e.target.value as string)}
                      onOpen={() => setIsPopperOpen(true)}
                      onClose={() => setIsPopperOpen(false)}
                      input={<OutlinedInput label="Select Region" />}
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
                      aria-label="Region"
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
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>System Types *</Typography>
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
                  {systemTypes.length === 0 && message.type === 'error' && (
                    <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                      At least one system type is required.
                    </Typography>
                  )}
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{
                    width: '100%',
                    background: 'linear-gradient(to right, #10b981, #047857, #10b981)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    borderRadius: '24px',
                    padding: '16px 32px',
                    fontSize: '1.25rem',
                    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: '0 8px 16px rgba(16, 185, 129, 0.5)',
                      background: 'linear-gradient(to right, #34d399, #059669, #34d399)',
                    },
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { transform: 'scale(1)', boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)' },
                      '50%': { transform: 'scale(1.03)', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.4)' },
                      '100%': { transform: 'scale(1)', boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)' },
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
              </Box>
            </form>
          </Box>
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default LogTechnicalCallout;