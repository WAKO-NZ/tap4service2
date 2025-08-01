/**
 * RequestTechnician.tsx - Version V6.110
 * - Submits service request to /api/requests?path=create as pending using POST.
 * - Includes repair_description (text), customer_availability_1 (date), region (string), and system_types (array), all required.
 * - Saves to service_requests table and redirects to customer dashboard.
 * - Styled to match CustomerDashboard.tsx and CustomerEditProfile.tsx.
 * - Uses MUI DatePicker, Select, and FormControl for inputs.
 */
import { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { FormControl, InputLabel, Select, MenuItem, OutlinedInput, Checkbox, ListItemText } from '@mui/material';
import moment from 'moment-timezone';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

// Define available regions based on technician_service_regions table
const REGIONS = [
  'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawkes Bay',
  'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
  'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'
];

// Define system types (assumed list; update if specific types are provided)
const SYSTEM_TYPES = ['Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Other'];

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
    console.error('Error in RequestTechnician:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-center text-red-600 text-lg font-medium">Something went wrong. Please try again later.</div>;
    }
    return this.props.children;
  }
}

export default function RequestTechnician() {
  const [description, setDescription] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState<moment.Moment | null>(null);
  const [region, setRegion] = useState('');
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  useEffect(() => {
    console.log('Component mounted, customerId:', customerId, 'role:', role, 'API_URL:', API_URL);
    if (!customerId || role !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      setTimeout(() => navigate('/login'), 1000);
    }
  }, [customerId, role, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!customerId || isNaN(parseInt(customerId))) {
      setMessage({ text: 'Invalid customer login. Please log in again.', type: 'error' });
      return;
    }
    if (!description.trim()) {
      setMessage({ text: 'Job description is required.', type: 'error' });
      return;
    }
    if (description.trim().length > 255) {
      setMessage({ text: 'Job description must not exceed 255 characters.', type: 'error' });
      return;
    }
    if (!availabilityDate || !moment(availabilityDate).isValid()) {
      setMessage({ text: 'Availability date is required.', type: 'error' });
      return;
    }
    const availability = moment.tz(availabilityDate, 'Pacific/Auckland').startOf('day');
    if (!availability.isValid() || availability.isBefore(moment.tz('Pacific/Auckland').startOf('day'))) {
      setMessage({ text: 'Availability date must be a valid future date.', type: 'error' });
      return;
    }
    if (!region) {
      setMessage({ text: 'Region is required.', type: 'error' });
      return;
    }
    if (systemTypes.length === 0) {
      setMessage({ text: 'At least one system type is required.', type: 'error' });
      return;
    }

    const formattedAvailability = availability.format('YYYY-MM-DD HH:mm:ss');

    const payload = {
      customer_id: parseInt(customerId),
      repair_description: description.trim(),
      availability_1: formattedAvailability,
      region,
      system_types: systemTypes,
    };

    try {
      const url = `${API_URL}/api/requests?path=create`;
      const headers = { 'Content-Type': 'application/json' };
      console.log('Fetch URL:', url, 'Method:', 'POST', 'Headers:', headers, 'Payload:', payload);
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });
      const textData = await response.text();
      console.log('API response status:', response.status, 'Response:', textData);
      if (textData.trim() === '') {
        console.warn('Empty response from server');
        setMessage({ text: 'Server returned an empty response.', type: 'error' });
        return;
      }
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Response is not valid JSON:', parseError, 'Raw data:', textData);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        return;
      }

      if (response.ok) {
        setMessage({ text: data.message || 'Request submitted successfully!', type: 'success' });
        setTimeout(() => navigate('/customer-dashboard'), 2000);
      } else {
        setMessage({ text: `Failed to submit: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error submitting request:', error);
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    }
  };

  const filterPastDates = (date: moment.Moment) => {
    const today = moment.tz('Pacific/Auckland').startOf('day');
    return date.isBefore(today);
  };

  const handleSystemTypesChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string[];
    setSystemTypes(value);
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterMoment}>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Request a Technician</h2>
            {message.text && (
              <p className={`text-center mb-6 text-lg font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 text-lg font-medium mb-2">Job Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg resize-y transition duration-200"
                  rows={5}
                  placeholder="Describe the issue"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg font-medium mb-2">Availability Date *</label>
                <DatePicker
                  value={availabilityDate}
                  onChange={(date: moment.Moment | null) => setAvailabilityDate(date)}
                  shouldDisableDate={filterPastDates}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      size: 'medium',
                      fullWidth: true,
                      required: true,
                      InputProps: {
                        className: 'border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition duration-200'
                      }
                    },
                    popper: { placement: 'bottom-start' },
                  }}
                />
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel id="region-label">Region</InputLabel>
                  <Select
                    labelId="region-label"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as string)}
                    input={<OutlinedInput label="Region" />}
                    className="border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition duration-200"
                  >
                    {REGIONS.map((r) => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel id="system-types-label">System Types</InputLabel>
                  <Select
                    labelId="system-types-label"
                    multiple
                    value={systemTypes}
                    onChange={handleSystemTypesChange}
                    input={<OutlinedInput label="System Types" />}
                    renderValue={(selected) => (selected as string[]).join(', ')}
                    className="border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition duration-200"
                  >
                    {SYSTEM_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        <Checkbox checked={systemTypes.includes(type)} />
                        <ListItemText primary={type} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                Submit Request
              </button>
            </form>
            <button
              onClick={() => navigate('/customer-dashboard')}
              className="mt-6 w-full bg-gray-200 text-gray-800 text-xl font-semibold py-4 px-8 rounded-lg hover:bg-gray-300 hover:shadow-md transition duration-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </LocalizationProvider>
    </ErrorBoundary>
  );
}