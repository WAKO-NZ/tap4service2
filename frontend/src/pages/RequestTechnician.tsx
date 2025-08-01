/**
 * RequestTechnician.tsx - Version V6.127
 * - Submits service request to /api/requests?path=create as pending using POST.
 * - Validates inputs and displays messages.
 * - Redirects to dashboard on success.
 * - Uses MUI DatePicker with slotProps.textField for compatibility.
 * - Formats dates as YYYY-MM-DD HH:mm:ss for API.
 * - Includes system types multi-select and assigns technician by region.
 * - Fixed URL to ensure /api/requests?path=create.
 */
import { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import moment from 'moment-timezone';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

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
      return <div className="text-center text-red-500">Something went wrong. Please try again later.</div>;
    }
    return this.props.children;
  }
}

const timeRanges = [
  '00:00-02:00', '02:00-04:00', '04:00-06:00', '06:00-08:00',
  '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00',
  '16:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-00:00',
];

const regions = [
  'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', "Hawke's Bay",
  'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
  'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast',
];

const systemTypes = [
  'Alarm System', 'Gate Motor', 'Garage Motor', 'CCTV', 'Access Control', 'UNSURE',
];

export default function RequestTechnician() {
  const [description, setDescription] = useState('');
  const [availability1Date, setAvailability1Date] = useState<moment.Moment | null>(null);
  const [availability1Time, setAvailability1Time] = useState<string>('');
  const [availability2Date, setAvailability2Date] = useState<moment.Moment | null>(null);
  const [availability2Time, setAvailability2Time] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSystemTypes, setSelectedSystemTypes] = useState<string[]>([]);
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
      setMessage({ text: 'Repair description is required.', type: 'error' });
      return;
    }
    if (description.trim().length > 255) {
      setMessage({ text: 'Repair description must not exceed 255 characters.', type: 'error' });
      return;
    }
    if (!availability1Date || !moment(availability1Date).isValid() || !availability1Time) {
      setMessage({ text: 'Availability 1 date and time range are required.', type: 'error' });
      return;
    }
    if (!selectedRegion) {
      setMessage({ text: 'Region is required.', type: 'error' });
      return;
    }
    if (selectedSystemTypes.length === 0) {
      setMessage({ text: 'At least one system type is required.', type: 'error' });
      return;
    }

    const availability1 = moment.tz(availability1Date, 'Pacific/Auckland')
      .set({
        hour: parseInt(availability1Time.split('-')[0].split(':')[0]),
        minute: parseInt(availability1Time.split('-')[0].split(':')[1]),
        second: 0,
      });
    if (!availability1.isValid() || availability1.isBefore(moment.tz('Pacific/Auckland'))) {
      setMessage({ text: 'Availability 1 must be a valid future date and time.', type: 'error' });
      return;
    }
    const formattedAvailability1 = availability1.format('YYYY-MM-DD HH:mm:ss');

    let formattedAvailability2 = null;
    if (availability2Date && availability2Time) {
      if (!moment(availability2Date).isValid()) {
        setMessage({ text: 'Invalid availability 2 date.', type: 'error' });
        return;
      }
      const availability2 = moment.tz(availability2Date, 'Pacific/Auckland')
        .set({
          hour: parseInt(availability2Time.split('-')[0].split(':')[0]),
          minute: parseInt(availability2Time.split('-')[0].split(':')[1]),
          second: 0,
        });
      if (!availability2.isValid() || availability2.isBefore(moment.tz('Pacific/Auckland'))) {
        setMessage({ text: 'Availability 2 must be a valid future date and time.', type: 'error' });
        return;
      }
      formattedAvailability2 = availability2.format('YYYY-MM-DD HH:mm:ss');
    }

    const payload = {
      customer_id: parseInt(customerId),
      repair_description: description.trim(),
      availability_1: formattedAvailability1,
      availability_2: formattedAvailability2,
      region: selectedRegion,
      system_types: selectedSystemTypes,
    };

    try {
      const url = `${API_URL}/api/requests?path=create`;
      console.log('Fetch URL:', url, 'Method:', 'POST', 'Payload:', payload);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleSystemTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.selectedOptions;
    const selected = Array.from(options, (option) => option.value);
    setSelectedSystemTypes(selected);
  };

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterMoment}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Request a Technician</h2>
            {message.text && (
              <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 text-lg mb-2">Repair Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg resize-y"
                  rows={5}
                  placeholder="Describe the issue"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Availability 1 Date *</label>
                <DatePicker
                  value={availability1Date}
                  onChange={(date: moment.Moment | null) => setAvailability1Date(date)}
                  shouldDisableDate={filterPastDates}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: { variant: 'outlined', size: 'medium', fullWidth: true, required: true },
                    popper: { placement: 'bottom-start' },
                  }}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Availability 1 Time Range *</label>
                <select
                  value={availability1Time}
                  onChange={(e) => setAvailability1Time(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                  required
                >
                  <option value="">Select a time range</option>
                  {timeRanges.map((range) => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Availability 2 Date (Optional)</label>
                <DatePicker
                  value={availability2Date}
                  onChange={(date: moment.Moment | null) => setAvailability2Date(date)}
                  shouldDisableDate={filterPastDates}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: { variant: 'outlined', size: 'medium', fullWidth: true },
                    popper: { placement: 'bottom-start' },
                  }}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Availability 2 Time Range (Optional)</label>
                <select
                  value={availability2Time}
                  onChange={(e) => setAvailability2Time(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                >
                  <option value="">Select a time range</option>
                  {timeRanges.map((range) => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">Region *</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                  required
                >
                  <option value="">Select a region</option>
                  {regions.map((reg) => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 text-lg mb-2">System Types *</label>
                <select
                  multiple
                  value={selectedSystemTypes}
                  onChange={handleSystemTypeChange}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                  required
                >
                  {systemTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                Submit Request
              </button>
            </form>
            <button
              onClick={() => navigate('/customer-dashboard')}
              className="mt-6 w-full bg-gray-200 text-gray-800 text-xl font-semibold py-4 px-8 rounded-lg hover:bg-gray-300 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </LocalizationProvider>
    </ErrorBoundary>
  );
}