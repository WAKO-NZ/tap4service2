/**
     * RequestTechnician.tsx - Version V5.324
     * - Removes credit card fields (card_number, expiry_date, cvv) as BNZ Pay will be integrated later.
     * - Redirects to /request-confirmation on submit instead of calling /api/requests.
     * - Stores form data in localStorage for use in RequestConfirmation.tsx.
     * - Retains MUI DatePicker, region selection, and validation.
     * - Uses DD/MM/YYYY HH:mm:ss in Pacific/Auckland for dates.
     */
    import { useState, useEffect, Component, type ErrorInfo } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { DatePicker } from '@mui/x-date-pickers/DatePicker';
    import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
    import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
    import { TextField } from '@mui/material';
    import moment from 'moment-timezone';

    const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz/api';

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
      '00:00-02:00',
      '02:00-04:00',
      '04:00-06:00',
      '06:00-08:00',
      '08:00-10:00',
      '10:00-12:00',
      '12:00-14:00',
      '14:00-16:00',
      '16:00-18:00',
      '18:00-20:00',
      '20:00-22:00',
      '22:00-00:00',
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

      const handleSubmit = async (e: React.FormEvent) => {
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
        if (!availability1Date || !availability1Time) {
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
        if (!availability1.isValid()) {
          setMessage({ text: 'Invalid availability 1 date or time.', type: 'error' });
          return;
        }
        const formattedAvailability1 = availability1.format('DD/MM/YYYY HH:mm:ss');

        let formattedAvailability2 = null;
        if (availability2Date && availability2Time) {
          const availability2 = moment.tz(availability2Date, 'Pacific/Auckland')
            .set({
              hour: parseInt(availability2Time.split('-')[0].split(':')[0]),
              minute: parseInt(availability2Time.split('-')[0].split(':')[1]),
              second: 0,
            });
          if (!availability2.isValid()) {
            setMessage({ text: 'Invalid availability 2 date or time.', type: 'error' });
            return;
          }
          formattedAvailability2 = availability2.format('DD/MM/YYYY HH:mm:ss');
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
              <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">4</div>
              <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Request a Technician</h2>
                {message.text && (
                  <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                    {message.text}
                  </p>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-gray-700 text-lg mb-2">Repair Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg resize-y"
                      rows={5}
                      required
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-lg mb-2">Availability 1 Date</label>
                    <DatePicker
                      value={availability1Date}
                      onChange={(date: moment.Moment | null) => setAvailability1Date(date)}
                      shouldDisableDate={filterPastDates}
                      format="DD/MM/YYYY"
                      enableAccessibleFieldDOMStructure={false}
                      slots={{
                        textField: (params) => <TextField {...params} fullWidth required />
                      }}
                      slotProps={{
                        popper: { placement: 'bottom-start' },
                        textField: { variant: 'outlined', size: 'medium' },
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-lg mb-2">Availability 1 Time Range</label>
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
                    <label className="block text-gray-700 text-lg mb-2">Availability 2 Date (optional)</label>
                    <DatePicker
                      value={availability2Date}
                      onChange={(date: moment.Moment | null) => setAvailability2Date(date)}
                      shouldDisableDate={filterPastDates}
                      format="DD/MM/YYYY"
                      enableAccessibleFieldDOMStructure={false}
                      slots={{
                        textField: (params) => <TextField {...params} fullWidth />
                      }}
                      slotProps={{
                        popper: { placement: 'bottom-start' },
                        textField: { variant: 'outlined', size: 'medium' },
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-lg mb-2">Availability 2 Time Range (optional)</label>
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
                    <label className="block text-gray-700 text-lg mb-2">Select Region</label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                      required
                    >
                      <option value="">Select a region</option>
                      {[
                        'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay',
                        'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
                        'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast',
                      ].map((reg) => (
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
              </div>
              <button
                onClick={() => navigate('/')}
                className="mt-6 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                Back
              </button>
            </div>
          </LocalizationProvider>
        </ErrorBoundary>
      );
    }