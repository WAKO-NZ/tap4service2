/**
 * RequestTechnician.tsx - Version V6.107 (Fixed for Vite and MUI X - Confirmed Fix for sectionListRef Error)
 * - Collects service request data and stores in localStorage.
 * - Redirects to /request-confirmation for submission.
 * - Uses slotProps.textField for customization to avoid sectionListRef errors (per MUI X docs and GitHub issues).
 * - Formats dates as YYYY-MM-DD HH:mm:ss for API.
 * - Validates inputs to prevent errors.
 */
import { useState, useEffect, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import moment from 'moment-timezone';

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

export default function RequestTechnician() {
  const [description, setDescription] = useState('');
  const [availability1Date, setAvailability1Date] = useState<moment.Moment | null>(null);
  const [availability1Time, setAvailability1Time] = useState<string>('');
  const [availability2Date, setAvailability2Date] = useState<moment.Moment | null>(null);
  const [availability2Time, setAvailability2Time] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!customerId || role !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      setTimeout(() => navigate('/login'), 1000);
    }
  }, [customerId, role, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
    };

    console.log('Storing request data:', payload);
    localStorage.setItem('pendingRequest', JSON.stringify(payload));
    navigate('/request-confirmation');
  };

  const filterPastDates = (date: moment.Moment) => {
    const today = moment.tz('Pacific/Auckland').startOf('day');
    return date.isBefore(today);
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