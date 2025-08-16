/**
 * LogTechnicalCallout.tsx - Version V1.31
 * - Located in /frontend/src/pages/
 * - Allows customers to log a technical callout via POST /api/customer_request.php?path=create.
 * - Supports rescheduling via PUT /api/customer_request.php?path=update when requestId is provided in query.
 * - Pre-populates form with request data for rescheduling, including repair_description.
 * - Makes repair_description, customer_availability_1, and region required; customer_availability_2 and system_types optional.
 * - Uses date-fns for date handling, including addHours.
 * - Sets all text to white (#ffffff) for visibility on dark background, including selected values in DatePicker and Select (V1.31).
 * - Enhanced error handling with ErrorBoundary.
 * - Styled with dark gradient background, gray card, blue gradient buttons.
 * - Added "Back" button to return to /customer-dashboard.
 * - Validates input to match customer_request.php requirements.
 * - Fixed text color for selected values in DatePicker and Select to white (#ffffff) (V1.31).
 * - Changed System Types to checkboxes.
 * - Fixed POST 400 errors by aligning payload keys (customer_availability_1) and enhancing validation.
 * - Customized Popper with disablePortal and focus management for aria-hidden warning.
 * - Integrated with App.tsx modal state for accessibility.
 * - Fixed TypeScript errors by moving autoFocus to inputProps.
 * - Enabled repair_description editing during rescheduling (V1.31).
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
  const query = new URLSearchParams(location.search);
  const requestId = query.get('requestId');
  const isReschedule = !!requestId;
  const customerId = localStorage.getItem('user_id') ? parseInt(localStorage.getItem('user_id')!, 10) : null;

  const [description, setDescription] = useState('');
  const [date1, setDate1] = useState<Date | null>(null);
  const [time1, setTime1] = useState('');
  const [date2, setDate2] = useState<Date | null>(null);
  const [time2, setTime2] = useState('');
  const [region, setRegion] = useState('');
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string }>({ type: 'error', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPopperOpen, setIsPopperOpen] = useState(false);

  useEffect(() => {
    if (isReschedule && requestId && customerId) {
      fetch(`${API_URL}/api/customer_request.php?path=requests`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.requests) {
            const request = data.requests.find((req: Request) => req.id === parseInt(requestId, 10));
            if (request) {
              setDescription(request.repair_description || '');
              setRegion(request.region || '');
              setSystemTypes(request.system_types ? request.system_types.split(',').map((type: string) => type.trim()) : []);
              if (request.customer_availability_1) {
                const dateTime1 = parse(request.customer_availability_1, 'yyyy-MM-dd HH:mm:ss', new Date());
                if (isValid(dateTime1)) {
                  setDate1(dateTime1);
                  setTime1(format(dateTime1, 'hh:mm aa') + ' - ' + format(addHours(dateTime1, 2), 'hh:mm aa'));
                }
              }
              if (request.customer_availability_2) {
                const dateTime2 = parse(request.customer_availability_2, 'yyyy-MM-dd HH:mm:ss', new Date());
                if (isValid(dateTime2)) {
                  setDate2(dateTime2);
                  setTime2(format(dateTime2, 'hh:mm aa') + ' - ' + format(addHours(dateTime2, 2), 'hh:mm aa'));
                }
              }
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching request data:', error);
          setMessage({ type: 'error', text: 'Failed to load request data' });
        });
    }
    if (onModalToggle) onModalToggle(true);
    return () => {
      if (onModalToggle) onModalToggle(false);
    };
  }, [requestId, customerId, onModalToggle]);

  const handleSystemTypeChange = (type: string) => {
    setSystemTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const validateForm = () => {
    if (!description) {
      setMessage({ type: 'error', text: 'Description is required' });
      return false;
    }
    if (!date1 || !isValid(date1) || !time1) {
      setMessage({ type: 'error', text: 'Primary availability date and time are required' });
      return false;
    }
    if (!region) {
      setMessage({ type: 'error', text: 'Region is required' });
      return false;
    }
    if (date1 && isBefore(date1, startOfDay(new Date()))) {
      setMessage({ type: 'error', text: 'Primary availability cannot be in the past' });
      return false;
    }
    if (date2 && isValid(date2) && isBefore(date2, startOfDay(new Date()))) {
      setMessage({ type: 'error', text: 'Secondary availability cannot be in the past' });
      return false;
    }
    if (date2 && !time2) {
      setMessage({ type: 'error', text: 'Secondary time is required if secondary date is provided' });
      return false;
    }
    setMessage({ type: 'error', text: '' });
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateForm() || !customerId) {
      if (!customerId) {
        setMessage({ type: 'error', text: 'User ID not found. Please log in again.' });
      }
      return;
    }

    setIsSubmitting(true);
    const customer_availability_1 = date1 && time1 ? format(date1, 'yyyy-MM-dd') + ' ' + time1.split(' - ')[0].replace(/( AM| PM)/, '') + ':00' : '';
    const customer_availability_2 = date2 && time2 ? format(date2, 'yyyy-MM-dd') + ' ' + time2.split(' - ')[0].replace(/( AM| PM)/, '') + ':00' : null;

    const payload = {
      repair_description: description,
      customer_availability_1,
      customer_availability_2,
      region,
      system_types: systemTypes.join(', ')
    };

    if (isReschedule && requestId) {
      payload.requestId = parseInt(requestId, 10);
      payload.customerId = customerId;
    }

    try {
      const endpoint = isReschedule ? `${API_URL}/api/customer_request.php?path=update` : `${API_URL}/api/customer_request.php?path=create`;
      const method = isReschedule ? 'PUT' : 'POST';
      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: isReschedule ? 'Request rescheduled successfully' : 'Callout submitted successfully' });
        setTimeout(() => navigate('/customer-dashboard'), 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit request' });
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage({ type: 'error', text: 'Failed to submit request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container
          maxWidth="sm"
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to right, #1f2937, #111827)',
            color: '#ffffff',
            padding: '20px'
          }}
        >
          <Box
            sx={{
              backgroundColor: '#374151',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              padding: '20px',
              width: '100%'
            }}
          >
            <Typography
              variant="h4"
              sx={{ color: '#ffffff', textAlign: 'center', mb: 2, fontWeight: 'bold' }}
            >
              {isReschedule ? 'Reschedule Technical Callout' : 'Log Technical Callout'}
            </Typography>
            {message.text && (
              <Typography
                sx={{
                  color: message.type === 'success' ? '#10b981' : '#ff0000',
                  textAlign: 'center',
                  mb: 2
                }}
              >
                {message.text}
              </Typography>
            )}
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  required
                  multiline
                  rows={4}
                  sx={{
                    '& .MuiInputLabel-root': { color: '#ffffff' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& .MuiInputBase-input': { color: '#ffffff' }
                    }
                  }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <DatePicker
                      label="Primary Availability Date"
                      value={date1}
                      onChange={(newValue) => setDate1(newValue)}
                      disablePast
                      slots={{ openPickerIcon: () => <FaPlus style={{ color: '#ffffff' }} /> }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          sx: {
                            '& .MuiInputLabel-root': { color: '#ffffff' },
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': { borderColor: '#ffffff' },
                              '&:hover fieldset': { borderColor: '#3b82f6' },
                              '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                              '& .MuiInputBase-input': { color: '#ffffff' }
                            }
                          }
                        },
                        popper: {
                          sx: {
                            '& .MuiPaper-root': { backgroundColor: '#374151', color: '#ffffff' },
                            '& .MuiPickersDay-root': { color: '#ffffff' },
                            '& .MuiPickersDay-root.Mui-selected': { backgroundColor: '#3b82f6', color: '#ffffff' },
                            '& .MuiPickersDay-root:hover': { backgroundColor: '#3b82f6', color: '#ffffff' }
                          }
                        }
                      }}
                    />
                    {!date1 && message.type === 'error' && (
                      <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                        Primary availability date is required.
                      </Typography>
                    )}
                  </Box>
                  <FormControl fullWidth sx={{ flex: 1 }}>
                    <InputLabel sx={{ color: '#ffffff' }}>Primary Time</InputLabel>
                    <Select
                      value={time1}
                      onChange={(e) => setTime1(e.target.value)}
                      onOpen={() => setIsPopperOpen(true)}
                      onClose={() => setIsPopperOpen(false)}
                      input={<OutlinedInput label="Primary Time" />}
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
                          '& .MuiInputBase-input': { color: '#ffffff' }
                        }
                      }}
                      required
                    >
                      <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Time</MenuItem>
                      {TIME_SLOTS.map((slot) => (
                        <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                      ))}
                    </Select>
                    {!time1 && message.type === 'error' && (
                      <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                        Primary time is required.
                      </Typography>
                    )}
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <DatePicker
                      label="Secondary Availability Date"
                      value={date2}
                      onChange={(newValue) => setDate2(newValue)}
                      disablePast
                      slots={{ openPickerIcon: () => <FaPlus style={{ color: '#ffffff' }} /> }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: {
                            '& .MuiInputLabel-root': { color: '#ffffff' },
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': { borderColor: '#ffffff' },
                              '&:hover fieldset': { borderColor: '#3b82f6' },
                              '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                              '& .MuiInputBase-input': { color: '#ffffff' }
                            }
                          }
                        },
                        popper: {
                          sx: {
                            '& .MuiPaper-root': { backgroundColor: '#374151', color: '#ffffff' },
                            '& .MuiPickersDay-root': { color: '#ffffff' },
                            '& .MuiPickersDay-root.Mui-selected': { backgroundColor: '#3b82f6', color: '#ffffff' },
                            '& .MuiPickersDay-root:hover': { backgroundColor: '#3b82f6', color: '#ffffff' }
                          }
                        }
                      }}
                    />
                  </Box>
                  <FormControl fullWidth sx={{ flex: 1 }}>
                    <InputLabel sx={{ color: '#ffffff' }}>Secondary Time</InputLabel>
                    <Select
                      value={time2}
                      onChange={(e) => setTime2(e.target.value)}
                      onOpen={() => setIsPopperOpen(true)}
                      onClose={() => setIsPopperOpen(false)}
                      input={<OutlinedInput label="Secondary Time" />}
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
                          '& .MuiInputBase-input': { color: '#ffffff' }
                        }
                      }}
                    >
                      <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Time</MenuItem>
                      {TIME_SLOTS.map((slot) => (
                        <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                      ))}
                    </Select>
                    {date2 && !time2 && message.type === 'error' && (
                      <Typography sx={{ color: '#ff0000', fontSize: '0.75rem', mt: 1 }}>
                        Secondary time is required if secondary date is provided.
                      </Typography>
                    )}
                  </FormControl>
                </Box>
                <Box>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#ffffff' }}>Region</InputLabel>
                    <Select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
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
                          '& .MuiInputBase-input': { color: '#ffffff' }
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
              </Box>
            </form>
          </Box>
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default LogTechnicalCallout;