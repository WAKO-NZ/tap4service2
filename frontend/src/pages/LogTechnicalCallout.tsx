/**
 * LogTechnicalCallout.tsx - Version V1.25
 * - Allows customers to log a technical callout via POST /api/customer_request.php?path=create.
 * - Makes repair_description, customer_availability_1, and region required; customer_availability_2 and system_types optional.
 * - Uses date-fns for date handling, including addHours.
 * - Sets all text to white (#ffffff) for visibility on dark background.
 * - Enhanced error handling with ErrorBoundary.
 * - Styled with dark gradient background, gray card, blue gradient buttons.
 * - Added "Back" button to return to /customer-dashboard.
 * - Validates input to match customer_request.php requirements.
 */
import React, { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, isValid, isBefore, startOfDay, addHours } from 'date-fns';
import { Box, Button, TextField, Typography, Container, FormControl, InputLabel, Select, MenuItem, OutlinedInput } from '@mui/material';
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
  'Auckland',
  'Bay of Plenty',
  'Canterbury',
  'Gisborne',
  'Hawkes Bay',
  'Manawatu-Whanganui',
  'Marlborough',
  'Nelson',
  'Northland',
  'Otago',
  'Southland',
  'Taranaki',
  'Tasman',
  'Waikato',
  'Wellington',
  'West Coast'
];

const SYSTEM_TYPES = [
  'Alarm System',
  'CCTV',
  'Gate Motor',
  'Garage Motor',
  'Access Control System',
  'Smoke Detectors'
];

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
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-[#ffffff] py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              style={{ color: '#ffffff' }}
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

const LogTechnicalCallout: React.FC = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      navigate('/customer-login');
    }
  }, [navigate, customerId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setMessage({ text: '', type: 'error' });

    // Validate required fields
    if (!repairDescription.trim()) {
      setMessage({ text: 'Job description is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (repairDescription.length > 255) {
      setMessage({ text: 'Job description must not exceed 255 characters.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (!availabilityDate1 || !isValid(availabilityDate1) || !availabilityTime1) {
      setMessage({ text: 'Primary availability date and time are required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (!region) {
      setMessage({ text: 'Region is required.', type: 'error' });
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
      repair_description: repairDescription.trim(),
      customer_availability_1,
      customer_availability_2,
      region,
      system_types: systemTypes.length > 0 ? systemTypes : []
    };

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_URL}/api/customer_request.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });
      const textData = await response.text();
      console.log(`Submit API response status: ${response.status}, Response: ${textData}`);

      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        throw new Error('Invalid server response format');
      }

      if (response.ok && data.success) {
        console.log('Callout submitted successfully:', data);
        setMessage({ text: data.message || 'Callout submitted successfully!', type: 'success' });
        setTimeout(() => navigate('/customer-dashboard'), 2000);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error(`Error submitting callout: ${err.message}`);
      setMessage({ text: `Error submitting callout: ${err.message}`, type: 'error' });
      window.scrollTo(0, 0);
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
              Log a Technical Callout
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
                  inputProps={{ maxLength: 255 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& input': { color: '#ffffff' },
                      '& textarea': { color: '#ffffff' }
                    }
                  }}
                  InputProps={{ className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]' }}
                />
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Primary Availability Date *</Typography>
                <DatePicker
                  label="Primary Availability Date"
                  value={availabilityDate1}
                  onChange={(date: Date | null) => setAvailabilityDate1(date)}
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
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#ffffff' },
                          '&:hover fieldset': { borderColor: '#3b82f6' },
                          '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                          '& input': { color: '#ffffff' }
                        }
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
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Primary Availability Time *</Typography>
                <FormControl fullWidth>
                  <InputLabel id="time-slot1-label" sx={{ color: '#ffffff' }}>Select Time</InputLabel>
                  <Select
                    labelId="time-slot1-label"
                    value={availabilityTime1}
                    onChange={(e) => setAvailabilityTime1(e.target.value as string)}
                    input={<OutlinedInput label="Select Time" className="bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
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
                        '& input': { color: '#ffffff' }
                      }
                    }}
                    required
                  >
                    <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Time</MenuItem>
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem key={slot} value={slot} sx={{ color: '#ffffff' }}>{slot}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Secondary Availability Date</Typography>
                <DatePicker
                  label="Secondary Availability Date"
                  value={availabilityDate2}
                  onChange={(date: Date | null) => setAvailabilityDate2(date)}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      size: 'medium',
                      fullWidth: true,
                      InputProps: {
                        className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]'
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
                    input={<OutlinedInput label="Select Time" className="bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
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
                        '& input': { color: '#ffffff' }
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
                <FormControl fullWidth>
                  <InputLabel id="region-label" sx={{ color: '#ffffff' }}>Select Region</InputLabel>
                  <Select
                    labelId="region-label"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as string)}
                    input={<OutlinedInput label="Select Region" className="bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
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
                        '& input': { color: '#ffffff' }
                      }
                    }}
                    required
                  >
                    <MenuItem value="" disabled sx={{ color: '#ffffff' }}>Select Region</MenuItem>
                    {REGIONS.map((regionOption) => (
                      <MenuItem key={regionOption} value={regionOption} sx={{ color: '#ffffff' }}>{regionOption}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>System Types</Typography>
                <FormControl fullWidth>
                  <InputLabel id="system-types-label" sx={{ color: '#ffffff' }}>Select System Types</InputLabel>
                  <Select
                    labelId="system-types-label"
                    multiple
                    value={systemTypes}
                    onChange={(e) => setSystemTypes(e.target.value as string[])}
                    input={<OutlinedInput label="Select System Types" className="bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
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
                        '& input': { color: '#ffffff' }
                      }
                    }}
                  >
                    <MenuItem value="" sx={{ color: '#ffffff' }}>None</MenuItem>
                    {SYSTEM_TYPES.map((type) => (
                      <MenuItem key={type} value={type} sx={{ color: '#ffffff' }}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                {isSubmitting ? 'Submitting...' : 'Submit Callout'}
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