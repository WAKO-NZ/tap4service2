/**
 * LogTechnicalCallout.tsx - Version V1.37
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
 * - Changed selected date/time and region text color to white (#ffffff) for visibility.
 * - Changed redirect to /customer-dashboard after job submission.
 * - Fixed reschedule error by using correct endpoint /api/customer_request.php?path=requests in V1.34.
 * - Fixed reschedule 400 error by including customer_id in payload in V1.35.
 * - Fixed datetime format for availability_1 and availability_2 to use DATETIME format in V1.36.
 * - Fixed datetime format issue in handleSubmit and added logging in V1.37.
 */
import React, { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { format, isValid, isBefore, startOfDay, parse } from 'date-fns';
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
  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);
  const isReschedule = new URLSearchParams(location.search).has('requestId');
  const requestId = new URLSearchParams(location.search).get('requestId');

  // Parse time slot to DATETIME format (use start time)
  const parseTimeSlotToDateTime = (date: Date, timeSlot: string): string => {
    const [startTime] = timeSlot.split(' - ');
    const parsed = parse(`${format(date, 'yyyy-MM-dd')} ${startTime}`, 'yyyy-MM-dd h:mm a', new Date());
    return format(parsed, 'yyyy-MM-dd HH:mm:ss');
  };

  // Parse DATETIME to time slot for form pre-population
  const parseDateTimeToTimeSlot = (dateTime: string): string => {
    const date = parse(dateTime, 'yyyy-MM-dd HH:mm:ss', new Date());
    const hour = date.getHours();
    if (hour >= 4 && hour < 6) return '04:00 AM - 06:00 AM';
    if (hour >= 6 && hour < 8) return '06:00 AM - 08:00 AM';
    if (hour >= 8 && hour < 10) return '08:00 AM - 10:00 AM';
    if (hour >= 10 && hour < 12) return '10:00 AM - 12:00 PM';
    if (hour >= 12 && hour < 14) return '12:00 PM - 02:00 PM';
    if (hour >= 14 && hour < 16) return '02:00 PM - 04:00 PM';
    if (hour >= 16 && hour < 18) return '04:00 PM - 06:00 PM';
    if (hour >= 18 && hour < 20) return '06:00 PM - 08:00 PM';
    return '';
  };

  useEffect(() => {
    if (!customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    if (isReschedule && requestId) {
      const fetchRequest = async () => {
        try {
          const response = await fetch(`${API_URL}/api/customer_request.php?path=requests&customerId=${customerId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Fetch request failed:', response.status, errorText);
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          const request = data.requests.find((req: Request) => req.id === parseInt(requestId, 10));
          if (request) {
            setRepairDescription(request.repair_description || '');
            setRegion(request.region || '');
            setSystemTypes(request.system_types || []);
            if (request.customer_availability_1) {
              const date = parse(request.customer_availability_1, 'yyyy-MM-dd HH:mm:ss', new Date());
              setAvailabilityDate1(date);
              setAvailabilityTime1(parseDateTimeToTimeSlot(request.customer_availability_1));
            }
            if (request.customer_availability_2) {
              const date = parse(request.customer_availability_2, 'yyyy-MM-dd HH:mm:ss', new Date());
              setAvailabilityDate2(date);
              setAvailabilityTime2(parseDateTimeToTimeSlot(request.customer_availability_2));
            }
          } else {
            throw new Error('Request not found');
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error fetching request:', error);
          setMessage({ text: 'Failed to load request data. Please try again or contact support.', type: 'error' });
        }
      };
      fetchRequest();
    }
  }, [navigate, customerId, isReschedule, requestId]);

  const handleSystemTypeChange = (type: string) => {
    setSystemTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ text: '', type: 'error' });

    if (!repairDescription || repairDescription.length > 255) {
      setMessage({ text: 'Description is required and must not exceed 255 characters.', type: 'error' });
      setIsSubmitting(false);
      return;
    }
    if (!availabilityDate1 || !isValid(availabilityDate1) || isBefore(availabilityDate1, startOfDay(new Date()))) {
      setMessage({ text: 'Valid first availability date is required and must not be in the past.', type: 'error' });
      setIsSubmitting(false);
      return;
    }
    if (!availabilityTime1) {
      setMessage({ text: 'First availability time slot is required.', type: 'error' });
      setIsSubmitting(false);
      return;
    }
    if (availabilityDate2 && (!isValid(availabilityDate2) || isBefore(availabilityDate2, startOfDay(new Date())))) {
      setMessage({ text: 'Second availability date must be valid and not in the past.', type: 'error' });
      setIsSubmitting(false);
      return;
    }
    if (!region) {
      setMessage({ text: 'Region is required.', type: 'error' });
      setIsSubmitting(false);
      return;
    }
    if (systemTypes.length === 0) {
      setMessage({ text: 'At least one system type is required.', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    const availability1 = parseTimeSlotToDateTime(availabilityDate1, availabilityTime1);
    const availability2 = availabilityDate2 && availabilityTime2 ? parseTimeSlotToDateTime(availabilityDate2, availabilityTime2) : null;
    console.log('Formatted availability_1:', availability1);
    console.log('Formatted availability_2:', availability2);

    try {
      const endpoint = isReschedule ? `/api/requests/reschedule/${requestId}` : '/api/customer_request.php?path=create';
      const method = isReschedule ? 'PUT' : 'POST';
      const body = isReschedule
        ? {
            customer_id: customerId,
            customer_availability_1: availability1,
            customer_availability_2: availability2,
            region,
            repair_description: repairDescription,
            system_types: systemTypes,
          }
        : {
            customer_id: customerId,
            repair_description: repairDescription,
            availability_1: availability1,
            availability_2: availability2,
            region,
            system_types: systemTypes,
          };

      console.log('Submitting payload:', JSON.stringify(body));

      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Submit failed:', response.status, errorText);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessage({ text: isReschedule ? 'Request rescheduled successfully.' : 'Callout submitted successfully.', type: 'success' });
      setTimeout(() => {
        navigate('/customer-dashboard');
      }, 1000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error submitting callout:', error);
      setMessage({ text: error.message || 'Failed to submit callout. Please try again or contact support.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="sm" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', mb: 2 }}>
              {isReschedule ? 'Reschedule & Edit Technical Callout' : 'Log a Technical Callout'}
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ backgroundColor: '#374151', p: 3, borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' }}>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="Description of Issue"
                  value={repairDescription}
                  onChange={(e) => setRepairDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  required
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
                  InputProps={{ sx: { backgroundColor: '#1f2937', borderRadius: '8px' } }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DatePicker
                    label="First Availability Date"
                    value={availabilityDate1}
                    onChange={(date) => setAvailabilityDate1(date)}
                    minDate={startOfDay(new Date())}
                    sx={{
                      '& .MuiInputLabel-root': { color: '#ffffff' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        '& input': { color: '#ffffff' }
                      },
                      '& .MuiSvgIcon-root': { color: '#ffffff' }
                    }}
                    slotProps={{ textField: { required: true, sx: { backgroundColor: '#1f2937', borderRadius: '8px' } } }}
                  />
                  <FormControl fullWidth required sx={{ backgroundColor: '#1f2937', borderRadius: '8px' }}>
                    <InputLabel sx={{ color: '#ffffff' }}>Time Slot</InputLabel>
                    <Select
                      value={availabilityTime1}
                      onChange={(e) => setAvailabilityTime1(e.target.value)}
                      sx={{
                        color: '#ffffff',
                        '& .MuiSvgIcon-root': { color: '#ffffff' },
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                      }}
                    >
                      {TIME_SLOTS.map((slot) => (
                        <MenuItem key={slot} value={slot} sx={{ color: '#ffffff', backgroundColor: '#1f2937', '&:hover': { backgroundColor: '#374151' } }}>
                          {slot}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DatePicker
                    label="Second Availability Date (Optional)"
                    value={availabilityDate2}
                    onChange={(date) => setAvailabilityDate2(date)}
                    minDate={startOfDay(new Date())}
                    sx={{
                      '& .MuiInputLabel-root': { color: '#ffffff' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                        '& input': { color: '#ffffff' }
                      },
                      '& .MuiSvgIcon-root': { color: '#ffffff' }
                    }}
                    slotProps={{ textField: { sx: { backgroundColor: '#1f2937', borderRadius: '8px' } } }}
                  />
                  <FormControl fullWidth sx={{ backgroundColor: '#1f2937', borderRadius: '8px' }}>
                    <InputLabel sx={{ color: '#ffffff' }}>Time Slot (Optional)</InputLabel>
                    <Select
                      value={availabilityTime2}
                      onChange={(e) => setAvailabilityTime2(e.target.value)}
                      sx={{
                        color: '#ffffff',
                        '& .MuiSvgIcon-root': { color: '#ffffff' },
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                      }}
                    >
                      <MenuItem value="" sx={{ color: '#ffffff', backgroundColor: '#1f2937', '&:hover': { backgroundColor: '#374151' } }}>
                        None
                      </MenuItem>
                      {TIME_SLOTS.map((slot) => (
                        <MenuItem key={slot} value={slot} sx={{ color: '#ffffff', backgroundColor: '#1f2937', '&:hover': { backgroundColor: '#374151' } }}>
                          {slot}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <FormControl fullWidth required sx={{ backgroundColor: '#1f2937', borderRadius: '8px' }}>
                  <InputLabel sx={{ color: '#ffffff' }}>Region</InputLabel>
                  <Select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    sx={{
                      color: '#ffffff',
                      '& .MuiSvgIcon-root': { color: '#ffffff' },
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                    }}
                  >
                    {REGIONS.map((reg) => (
                      <MenuItem key={reg} value={reg} sx={{ color: '#ffffff', backgroundColor: '#1f2937', '&:hover': { backgroundColor: '#374151' } }}>
                        {reg}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1 }}>System Types (Select at least one)</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
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
                  {isSubmitting ? 'Submitting...' : isReschedule ? 'Reschedule & Edit Request' : 'Submit Callout'}
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