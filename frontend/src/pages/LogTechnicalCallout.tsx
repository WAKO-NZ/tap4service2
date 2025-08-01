/**
 * LogTechnicalCallout.tsx - Version V1.13
 * - Submits service request to POST /api/requests with path: 'create'.
 * - Includes repair_description, customer_availability_1, customer_availability_2 (optional), region, system_types (all required except availability_2).
 * - Saves to Customer_Request and Technician_Feedback tables, dispatches event, and redirects to customer dashboard.
 * - Styled to match CustomerRegister.tsx with dark gradient background, gray card, blue gradient buttons.
 * - Uses MUI DatePicker, Select, Checkbox, ListItemText with white text.
 * - Includes time selection in two-hour segments from 04:00 AM to 08:00 PM.
 * - Uses date-fns to eliminate hooks.js interference.
 * - Fixes TypeScript error by importing useEffect.
 * - Fixes ARIA warning by ensuring MenuProps avoid aria-hidden conflicts.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { FormControl, InputLabel, Select, MenuItem, OutlinedInput, Checkbox, ListItemText, SelectChangeEvent } from '@mui/material';
import { format, isValid, isBefore, startOfDay, addHours, parse } from 'date-fns';
import { FaWrench } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

const REGIONS = [
  'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawkes Bay',
  'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
  'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'
];

const SYSTEM_TYPES = ['Alarm System', 'CCTV', 'Gate Motor', 'Garage Motor', 'Access Control System', 'Smoke Detectors'];

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
    console.error('Error in LogTechnicalCallout:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-center text-red-500 text-[clamp(1rem,2.5vw,1.125rem)] p-8">Something went wrong. Please try again later.</div>;
    }
    return this.props.children;
  }
}

export default function LogTechnicalCallout() {
  const [description, setDescription] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState<Date | null>(null);
  const [availabilityTime, setAvailabilityTime] = useState('');
  const [availabilityTime2, setAvailabilityTime2] = useState('');
  const [region, setRegion] = useState('');
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  useEffect(() => {
    console.log('Component mounted, customerId:', customerId, 'role:', role, 'API_URL:', API_URL);
    if (!customerId || role !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      setTimeout(() => navigate('/customer-login'), 1000);
    }
    console.log('Native fetch available:', typeof window.fetch === 'function');
  }, [customerId, role, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!customerId || isNaN(parseInt(customerId))) {
      setMessage({ text: 'Invalid customer login. Please log in again.', type: 'error' });
      setTimeout(() => navigate('/customer-login'), 1000);
      return;
    }
    if (!description.trim()) {
      setMessage({ text: 'Job description is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (description.trim().length > 255) {
      setMessage({ text: 'Job description must not exceed 255 characters.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (!availabilityDate || !isValid(availabilityDate)) {
      setMessage({ text: 'Availability date is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (!availabilityTime) {
      setMessage({ text: 'Primary availability time is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    const today = startOfDay(new Date());
    if (isBefore(availabilityDate, today)) {
      setMessage({ text: 'Availability date must be today or in the future.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    const startTime = availabilityTime.split(' - ')[0];
    const [hours, minutes] = startTime.split(':');
    const isPM = startTime.includes('PM');
    let hourNum = parseInt(hours);
    if (isPM && hourNum !== 12) hourNum += 12;
    if (!isPM && hourNum === 12) hourNum = 0;
    const formattedDate = startOfDay(availabilityDate);
    const availability1 = addHours(formattedDate, hourNum);
    availability1.setMinutes(parseInt(minutes));
    if (!isValid(availability1) || isBefore(availability1, new Date())) {
      setMessage({ text: 'Primary availability time must be a valid future time.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    let availability2: Date | null = null;
    if (availabilityTime2) {
      const startTime2 = availabilityTime2.split(' - ')[0];
      const [hours2, minutes2] = startTime2.split(':');
      const isPM2 = startTime2.includes('PM');
      let hourNum2 = parseInt(hours2);
      if (isPM2 && hourNum2 !== 12) hourNum2 += 12;
      if (!isPM2 && hourNum2 === 12) hourNum2 = 0;
      availability2 = addHours(formattedDate, hourNum2);
      availability2.setMinutes(parseInt(minutes2));
      if (!isValid(availability2) || isBefore(availability2, new Date())) {
        setMessage({ text: 'Secondary availability time must be a valid future time.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
    }
    if (!region) {
      setMessage({ text: 'Region is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (systemTypes.length === 0) {
      setMessage({ text: 'At least one system type is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    const payload = {
      path: 'create',
      customer_id: parseInt(customerId),
      repair_description: description.trim(),
      availability_1: format(availability1, 'yyyy-MM-dd HH:mm:ss'),
      availability_2: availability2 ? format(availability2, 'yyyy-MM-dd HH:mm:ss') : null,
      region,
      system_types: systemTypes,
    };

    try {
      const url = `${API_URL}/api/requests`;
      const headers = { 'Content-Type': 'application/json' };
      const requestOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      };
      console.log('Sending fetch request: Method:', requestOptions.method, 'URL:', url, 'Headers:', headers, 'Payload:', payload);

      const response = await fetch(url, requestOptions);
      const responseText = await response.text();
      console.log('API response: Status:', response.status, 'Headers:', Object.fromEntries(response.headers), 'Response:', responseText);

      if (!response.ok) {
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error('Invalid server response format');
        }
        console.warn('Request submission failed:', data.error || 'Unknown error', 'Status:', response.status);
        if (response.status === 403) {
          setMessage({ text: 'Unauthorized: Please log in again.', type: 'error' });
          setTimeout(() => navigate('/customer-login'), 1000);
        } else if (response.status === 400) {
          setMessage({ text: `Invalid input: ${data.error || 'Check your form data.'}`, type: 'error' });
        } else {
          setMessage({ text: `Failed to submit: ${data.error || 'Server error.'}`, type: 'error' });
        }
        window.scrollTo(0, 0);
        return;
      }

      if (responseText.trim() === '') {
        console.warn('Empty response from server');
        setMessage({ text: 'Server returned an empty response.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Response is not valid JSON:', parseError, 'Raw data:', responseText);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      setMessage({ text: data.message || 'Service request submitted successfully!', type: 'success' });
      console.log('Request submitted successfully, dispatching event');

      // Dispatch custom event for CustomerDashboard
      const newRequest = {
        id: data.requestId,
        repair_description: description.trim(),
        created_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        status: 'pending',
        customer_availability_1: format(availability1, 'yyyy-MM-dd HH:mm:ss'),
        customer_availability_2: availability2 ? format(availability2, 'yyyy-MM-dd HH:mm:ss') : null,
        region,
        system_types: systemTypes,
        payment_status: 'pending',
      };
      window.dispatchEvent(new CustomEvent('newTechnicalCallout', { detail: { request: newRequest } }));

      setTimeout(() => navigate('/customer-dashboard'), 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error submitting request:', error);
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  const filterPastDates = (date: Date | null) => {
    if (!date) return true;
    const today = startOfDay(new Date());
    return isBefore(date, today);
  };

  const handleSystemTypesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    setSystemTypes(value);
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
          <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
            <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent mb-6">
              Log a Technical Callout
            </h2>
            {message.text && (
              <p className={`text-center mb-6 text-[clamp(1rem,2.5vw,1.125rem)] ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Job Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)] resize-y"
                  rows={5}
                  placeholder="Describe the issue"
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">Availability Date *</label>
                <DatePicker
                  value={availabilityDate}
                  onChange={(date: Date | null) => setAvailabilityDate(date)}
                  shouldDisableDate={filterPastDates}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      size: 'medium',
                      fullWidth: true,
                      required: true,
                      InputProps: {
                        className: 'bg-gray-700 text-white border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]'
                      }
                    },
                    popper: {
                      placement: 'bottom-start',
                      sx: {
                        '& .MuiPaper-root': { backgroundColor: '#374151', color: 'white' },
                        '& .MuiPickersDay-root': { color: 'white' },
                        '& .MuiPickersDay-root.Mui-selected': { backgroundColor: '#3b82f6', color: 'white' },
                        '& .MuiPickersDay-root:hover': { backgroundColor: '#4b5563', color: 'white' },
                        '& .MuiPickersCalendarHeader-label': { color: 'white' },
                        '& .MuiPickersArrowSwitcher-button': { color: 'white' },
                        '& .MuiPickersYear-yearButton': { color: 'white' },
                        '& .MuiPickersYear-yearButton.Mui-selected': { backgroundColor: '#3b82f6', color: 'white' }
                      }
                    }
                  }}
                />
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel id="time-slot-label" className="text-[clamp(1rem,2.5vw,1.125rem)] text-white">Primary Availability Time *</InputLabel>
                  <Select
                    labelId="time-slot-label"
                    value={availabilityTime}
                    onChange={(e) => setAvailabilityTime(e.target.value as string)}
                    input={<OutlinedInput label="Primary Availability Time" className="bg-gray-700 text-white border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
                    className="rounded-md"
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { 
                        sx: { 
                          backgroundColor: '#374151', 
                          color: 'white',
                          '& .MuiMenuItem-root.Mui-selected': { backgroundColor: '#3b82f6' },
                          '& .MuiMenuItem-root:hover': { backgroundColor: '#4b5563' }
                        } 
                      }
                    }}
                    sx={{ 
                      '& .MuiSelect-icon': { color: 'white' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' }
                    }}
                  >
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem key={slot} value={slot} sx={{ color: 'white' }}>{slot}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div>
                <FormControl fullWidth>
                  <InputLabel id="time-slot2-label" className="text-[clamp(1rem,2.5vw,1.125rem)] text-white">Secondary Availability Time</InputLabel>
                  <Select
                    labelId="time-slot2-label"
                    value={availabilityTime2}
                    onChange={(e) => setAvailabilityTime2(e.target.value as string)}
                    input={<OutlinedInput label="Secondary Availability Time" className="bg-gray-700 text-white border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
                    className="rounded-md"
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { 
                        sx: { 
                          backgroundColor: '#374151', 
                          color: 'white',
                          '& .MuiMenuItem-root.Mui-selected': { backgroundColor: '#3b82f6' },
                          '& .MuiMenuItem-root:hover': { backgroundColor: '#4b5563' }
                        } 
                      }
                    }}
                    sx={{ 
                      '& .MuiSelect-icon': { color: 'white' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' }
                    }}
                  >
                    <MenuItem value="" sx={{ color: 'white' }}>None</MenuItem>
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem key={slot} value={slot} sx={{ color: 'white' }}>{slot}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel id="region-label" className="text-[clamp(1rem,2.5vw,1.125rem)] text-white">Region</InputLabel>
                  <Select
                    labelId="region-label"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as string)}
                    input={<OutlinedInput label="Region" className="bg-gray-700 text-white border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
                    className="rounded-md"
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { 
                        sx: { 
                          backgroundColor: '#374151', 
                          color: 'white',
                          '& .MuiMenuItem-root.Mui-selected': { backgroundColor: '#3b82f6' },
                          '& .MuiMenuItem-root:hover': { backgroundColor: '#4b5563' }
                        } 
                      }
                    }}
                    sx={{ 
                      '& .MuiSelect-icon': { color: 'white' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' }
                    }}
                  >
                    <MenuItem value="" sx={{ color: 'white' }}>Select a region</MenuItem>
                    {REGIONS.map((r) => (
                      <MenuItem key={r} value={r} sx={{ color: 'white' }}>{r}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel id="system-types-label" className="text-[clamp(1rem,2.5vw,1.125rem)] text-white">System Types</InputLabel>
                  <Select
                    labelId="system-types-label"
                    multiple
                    value={systemTypes}
                    onChange={handleSystemTypesChange}
                    input={<OutlinedInput label="System Types" className="bg-gray-700 text-white border-gray-600 focus:border-blue-500 text-[clamp(1rem,2.5vw,1.125rem)]" />}
                    renderValue={(selected) => (selected as string[]).join(', ')}
                    className="rounded-md"
                    MenuProps={{
                      disablePortal: true,
                      PaperProps: { 
                        sx: { 
                          backgroundColor: '#374151', 
                          color: 'white',
                          '& .MuiMenuItem-root.Mui-selected': { backgroundColor: '#3b82f6' },
                          '& .MuiMenuItem-root:hover': { backgroundColor: '#4b5563' }
                        } 
                      }
                    }}
                    sx={{ 
                      '& .MuiSelect-icon': { color: 'white' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' }
                    }}
                  >
                    {SYSTEM_TYPES.map((type) => (
                      <MenuItem key={type} value={type} sx={{ color: 'white' }}>
                        <Checkbox checked={systemTypes.includes(type)} sx={{ color: 'white', '&.Mui-checked': { color: '#3b82f6' } }} />
                        <ListItemText primary={type} primaryTypographyProps={{ sx: { color: 'white' } }} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                  <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                  <div className="relative flex items-center justify-center h-12 z-10">
                    <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                    Submit Callout
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/customer-dashboard')}
                  className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                  <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                  <div className="relative flex items-center justify-center h-12 z-10">
                    Back to Dashboard
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      </LocalizationProvider>
    </ErrorBoundary>
  );
}