/**
     * CustomerDashboard.tsx - Version V6.106
     * - Fetches customer service requests via /api/requests/customer/:customerId.
     * - Displays job status and technician name for assigned jobs.
     * - Allows rescheduling of pending or assigned jobs.
     * - Polls every 5 minutes or on manual refresh.
     * - Enhances display of technician acceptance.
     * - Uses YYYY-MM-DD HH:mm:ss for API, displays DD/MM/YYYY HH:mm:ss in Pacific/Auckland.
     */
    import { useState, useEffect, useRef, Component, type ErrorInfo, MouseEventHandler } from 'react';
    import { useNavigate } from 'react-router-dom';
    import moment from 'moment-timezone';
    import DatePicker from 'react-datepicker';
    import 'react-datepicker/dist/react-datepicker.css';
    import deepEqual from 'deep-equal';

    const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz';

    interface Request {
      id: number;
      repair_description: string | null;
      created_at: string | null;
      status: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
      customer_availability_1: string | null;
      customer_availability_2: string | null;
      technician_scheduled_time: string | null;
      technician_id: number | null;
      technician_name: string | null;
      region: string | null;
      lastUpdated?: number;
    }

    interface ExpandedRequests {
      [key: number]: boolean;
    }

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
        console.error('Error in CustomerDashboard:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return <div className="text-center text-red-500">Something went wrong. Please try again later.</div>;
        }
        return this.props.children;
      }
    }

    export default function CustomerDashboard() {
      const [requests, setRequests] = useState<Request[]>([]);
      const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
      const [isLoading, setIsLoading] = useState(true);
      const [reschedulingRequestId, setReschedulingRequestId] = useState<number | null>(null);
      const [newAvailability1, setNewAvailability1] = useState<Date | null>(null);
      const [newAvailability2, setNewAvailability2] = useState<Date | null>(null);
      const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
      const [showHistory, setShowHistory] = useState(false);
      const navigate = useNavigate();
      const customerId = localStorage.getItem('userId');
      const role = localStorage.getItem('role');
      const userName = localStorage.getItem('userName') || 'Customer';
      const prevRequests = useRef<Request[]>([]);
      const hasFetched = useRef(false);

      const updateAudio = new Audio('/sounds/customer update.mp3');
      let hasPlayed = false;

      const fetchData = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`${API_URL}/api/requests/customer/${customerId}`);
          if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
          const data: Request[] = await response.json();
          const sanitizedData = data.map(req => ({
            id: req.id ?? 0,
            repair_description: req.repair_description ?? 'Unknown',
            created_at: req.created_at ?? null,
            status: req.status ?? 'pending',
            customer_availability_1: req.customer_availability_1 ?? null,
            customer_availability_2: req.customer_availability_2 ?? null,
            technician_scheduled_time: req.technician_scheduled_time ?? null,
            technician_id: req.technician_id ?? null,
            technician_name: req.technician_name ?? null,
            region: req.region ?? null,
            lastUpdated: req.lastUpdated ?? Date.now()
          }));
          console.log('Fetched customer requests:', sanitizedData);
          if (!deepEqual(sanitizedData, prevRequests.current)) {
            setRequests(sanitizedData);
            if (!hasPlayed) {
              updateAudio.play().catch(err => {
                console.error('Audio play failed:', err);
                setMessage({ text: 'Audio notification failed. Ensure /public/sounds/customer update.mp3 exists.', type: 'error' });
              });
              hasPlayed = true;
              setTimeout(() => { hasPlayed = false; }, 1000);
            }
            prevRequests.current = sanitizedData;
          }
          setMessage({ text: `${sanitizedData.length} request(s) found.`, type: 'success' });
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error fetching data:', error);
          setMessage({ text: `Error fetching data: ${error.message}.`, type: 'error' });
          setRequests([]);
        } finally {
          setIsLoading(false);
          hasFetched.current = true;
        }
      };

      useEffect(() => {
        if (!customerId || role !== 'customer') {
          setMessage({ text: 'Please log in as a customer to view your dashboard.', type: 'error' });
          navigate('/login');
          return;
        }

        const validateSession = async () => {
          try {
            const response = await fetch(`${API_URL}/api/customers/${customerId}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            if (!data.valid) throw new Error('Invalid session');
            if (!hasFetched.current) {
              fetchData();
            }
          } catch (err: unknown) {
            const error = err as Error;
            console.error('Session validation failed:', error);
            setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
            navigate('/login');
          }
        };

        validateSession();
        const intervalId = setInterval(fetchData, 300000); // 5 minutes

        return () => clearInterval(intervalId);
      }, [customerId, role, navigate]);

      const handleRefresh = () => {
        setMessage({ text: 'Refreshing requests...', type: 'info' });
        fetchData();
      };

      const handleLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        localStorage.removeItem('userName');
        setMessage({ text: 'Logged out successfully!', type: 'success' });
        setTimeout(() => navigate('/login'), 1000);
      };

      const handleReschedule: MouseEventHandler<HTMLButtonElement> = (event) => {
        event.preventDefault();
        const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
        setReschedulingRequestId(requestId);
        setNewAvailability1(null);
        setNewAvailability2(null);
        setMessage({ text: 'Select new availability times.', type: 'info' });
      };

      const handleConfirmReschedule = async () => {
        if (!reschedulingRequestId || !newAvailability1 || !customerId) return;
        const payload = {
          customerId: parseInt(customerId),
          availability_1: moment.tz(newAvailability1, 'Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss'),
          availability_2: newAvailability2 ? moment.tz(newAvailability2, 'Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss') : null
        };
        try {
          const response = await fetch(`${API_URL}/api/requests/reschedule/${reschedulingRequestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Request rescheduled successfully! Technician unassigned.', type: 'success' });
            setReschedulingRequestId(null);
            setNewAvailability1(null);
            setNewAvailability2(null);
            fetchData();
          } else {
            setMessage({ text: `Failed to reschedule: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error rescheduling:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const handleCancelReschedule = () => {
        setReschedulingRequestId(null);
        setNewAvailability1(null);
        setNewAvailability2(null);
        setMessage({ text: '', type: '' });
      };

      const handleCancelRequest: MouseEventHandler<HTMLButtonElement> = async (event) => {
        const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
        if (!customerId) return;
        try {
          const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: parseInt(customerId) })
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Request cancelled successfully!', type: 'success' });
            fetchData();
          } else {
            setMessage({ text: `Failed to cancel request: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error cancelling request:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const handleConfirmCompletion: MouseEventHandler<HTMLButtonElement> = async (event) => {
        const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
        if (!customerId) return;
        try {
          const response = await fetch(`${API_URL}/api/requests/confirm-completion/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: parseInt(customerId) })
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Completion confirmed! Payment captured.', type: 'success' });
            fetchData();
          } else {
            setMessage({ text: `Failed to confirm completion: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error confirming completion:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const toggleExpand = (requestId: number) => {
        setExpandedRequests((prev: ExpandedRequests) => ({
          ...prev,
          [requestId]: !prev[requestId]
        }));
      };

      const formatDateTime = (dateStr: string | null): string => {
        if (!dateStr) return 'Not specified';
        return moment.tz(dateStr, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
      };

      const DESCRIPTION_LIMIT = 100;

      const activeRequests = requests.filter(req => req.status !== 'completed' && req.status !== 'cancelled');
      const completedRequests = requests.filter(req => req.status === 'completed' || req.status === 'cancelled');

      console.log('Rendering with requests:', requests);

      return (
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col items-center bg-gray-100 p-4">
            <div className="w-full max-w-4xl">
              <button
                onClick={() => navigate('/request-technician')}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-3xl font-bold py-6 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200 mb-8"
              >
                Request a Technician
              </button>
              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Welcome, {userName}</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate('/customer-edit-profile')}
                      className="bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition"
                    >
                      Logout
                    </button>
                  </div>
                </div>
                {message.text && (
                  <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : message.type === 'info' ? 'text-blue-500' : 'text-red-500'}`}>
                    {message.text}
                  </p>
                )}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleRefresh}
                    className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition mr-2"
                  >
                    Refresh Requests
                  </button>
                  <button
                    onClick={() => setShowHistory(prev => !prev)}
                    className="bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition"
                  >
                    {showHistory ? 'Hide History' : 'Show Job History'}
                  </button>
                </div>
                {isLoading && !hasFetched.current ? (
                  <p className="text-center text-gray-600">Loading requests...</p>
                ) : (
                  <>
                    {showHistory ? (
                      <>
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Job History</h3>
                        {completedRequests.length === 0 ? (
                          <p className="text-gray-600 text-center mb-6">No completed or cancelled service requests.</p>
                        ) : (
                          <div className="space-y-4">
                            {completedRequests.map(request => {
                              const isExpanded = expandedRequests[request.id] || false;
                              const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                              const displayDescription = isExpanded || !isLong
                                ? request.repair_description ?? 'Unknown'
                                : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                              const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                              return (
                                <div
                                  key={request.id}
                                  className={`border rounded-lg p-4 transition-all duration-300 ${isRecentlyUpdated ? 'bg-yellow-100' : ''}`}
                                >
                                  <p className="whitespace-normal break-words">
                                    <strong>Repair Description:</strong> {displayDescription}
                                    {isLong && (
                                      <button
                                        onClick={() => toggleExpand(request.id)}
                                        className="ml-2 text-blue-600 hover:underline"
                                      >
                                        {isExpanded ? 'Show Less' : 'Show More'}
                                      </button>
                                    )}
                                  </p>
                                  <p><strong>Created At:</strong> {formatDateTime(request.created_at)}</p>
                                  <p><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                                  <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                                  <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                                  {request.technician_name && (
                                    <p><strong className="text-blue-600">Technician:</strong> {request.technician_name}</p>
                                  )}
                                  {request.technician_scheduled_time && (
                                    <p><strong className="text-blue-600">Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                                  )}
                                  <p><strong>Region:</strong> {request.region ?? 'Not provided'}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Active Service Requests</h3>
                        {activeRequests.length === 0 ? (
                          <p className="text-gray-600 text-center mb-6">No active service requests.</p>
                        ) : (
                          <div className="space-y-4 mb-8">
                            {activeRequests.map(request => {
                              const isExpanded = expandedRequests[request.id] || false;
                              const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                              const displayDescription = isExpanded || !isLong
                                ? request.repair_description ?? 'Unknown'
                                : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                              const isScheduled = request.status === 'assigned' && request.technician_scheduled_time;
                              const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                              return (
                                <div
                                  key={request.id}
                                  className={`border rounded-lg p-4 relative transition-all duration-300 ${isRecentlyUpdated ? 'bg-yellow-100' : ''}`}
                                >
                                  <p className="whitespace-normal break-words">
                                    <strong>Repair Description:</strong> {displayDescription}
                                    {isLong && (
                                      <button
                                        onClick={() => toggleExpand(request.id)}
                                        className="ml-2 text-blue-600 hover:underline"
                                      >
                                        {isExpanded ? 'Show Less' : 'Show More'}
                                      </button>
                                    )}
                                  </p>
                                  <p><strong>Created At:</strong> {formatDateTime(request.created_at)}</p>
                                  <p><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                                  <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                                  <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                                  {request.technician_name && request.status === 'assigned' && (
                                    <p><strong className="text-blue-600">Technician Assigned:</strong> {request.technician_name}</p>
                                  )}
                                  {isScheduled && (
                                    <p><strong className="text-blue-600">Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                                  )}
                                  <p><strong>Region:</strong> {request.region ?? 'Not provided'}</p>
                                  <div className="mt-2 space-x-2">
                                    {(request.status === 'pending' || request.status === 'assigned') && (
                                      <>
                                        <button
                                          data-id={request.id}
                                          onClick={handleReschedule}
                                          className="bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-700 transition"
                                        >
                                          Reschedule
                                        </button>
                                        <button
                                          data-id={request.id}
                                          onClick={handleCancelRequest}
                                          className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {request.status === 'completed_technician' && (
                                      <button
                                        data-id={request.id}
                                        onClick={handleConfirmCompletion}
                                        className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                      >
                                        Confirm Completion
                                      </button>
                                    )}
                                  </div>
                                  {reschedulingRequestId === request.id && (
                                    <div className="mt-2 space-y-2">
                                      <div>
                                        <label className="block text-gray-700 text-lg mb-2">New Availability 1</label>
                                        <DatePicker
                                          selected={newAvailability1}
                                          onChange={(date: Date | null) => setNewAvailability1(date)}
                                          showTimeSelect
                                          timeFormat="HH:mm:ss"
                                          timeIntervals={15}
                                          dateFormat="dd/MM/yyyy HH:mm:ss"
                                          minDate={new Date()}
                                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholderText="Select first availability"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-gray-700 text-lg mb-2">New Availability 2 (Optional)</label>
                                        <DatePicker
                                          selected={newAvailability2}
                                          onChange={(date: Date | null) => setNewAvailability2(date)}
                                          showTimeSelect
                                          timeFormat="HH:mm:ss"
                                          timeIntervals={15}
                                          dateFormat="dd/MM/yyyy HH:mm:ss"
                                          minDate={newAvailability1 || new Date()}
                                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholderText="Select second availability"
                                        />
                                      </div>
                                      <div className="flex space-x-2">
                                        <button
                                          onClick={handleConfirmReschedule}
                                          className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                          disabled={!newAvailability1}
                                        >
                                          Confirm Reschedule
                                        </button>
                                        <button
                                          onClick={handleCancelReschedule}
                                          className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => navigate('/')}
                      className="mt-6 bg-gray-200 text-gray-800 text-xl font-semibold py-4 px-4 rounded-lg hover:bg-gray-300 transition w-full text-center"
                    >
                      Back
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>
      );
    }