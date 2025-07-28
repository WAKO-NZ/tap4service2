/**
     * TechnicianDashboard.tsx - Version V6.102
     * - Fetches available jobs from service_requests, filtered by region server-side.
     * - Polls every 5 minutes while logged in.
     * - Includes Refresh button for manual fetching.
     * - Includes Log button for job history.
     * - Temporarily disables proposals fetch due to 404 error.
     * - Enhanced retry logic and user feedback for empty results.
     * - Uses YYYY-MM-DD HH:mm:ss for API, displays DD/MM/YYYY HH:mm:ss in Pacific/Auckland.
     */
    import { useState, useEffect, useRef, Component, type ErrorInfo, MouseEventHandler } from 'react';
    import { useNavigate } from 'react-router-dom';
    import moment from 'moment-timezone';
    import deepEqual from 'deep-equal';

    const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz';

    interface Request {
      id: number;
      repair_description: string;
      created_at: string;
      status: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
      customer_name: string;
      customer_address: string | null;
      customer_city: string | null;
      customer_postal_code: string | null;
      technician_note: string | null;
      customer_availability_1: string | null;
      customer_availability_2: string | null;
      technician_scheduled_time: string | null;
      technician_id: number | null;
      region: string;
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
        console.error('Error in TechnicianDashboard:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return <div className="text-center text-red-500">Something went wrong. Please try again later.</div>;
        }
        return this.props.children;
      }
    }

    export default function TechnicianDashboard() {
      const [assignedRequests, setAssignedRequests] = useState<Request[]>([]);
      const [availableRequests, setAvailableRequests] = useState<Request[]>([]);
      const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
      const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
      const [isLoading, setIsLoading] = useState(true);
      const [completionNote, setCompletionNote] = useState<string>('');
      const [completingRequestId, setCompletingRequestId] = useState<number | null>(null);
      const [hasInteracted, setHasInteracted] = useState(false);
      const [showHistory, setShowHistory] = useState(false);
      const [retryCount, setRetryCount] = useState(0);
      const navigate = useNavigate();
      const technicianId = localStorage.getItem('userId');
      const role = localStorage.getItem('role');
      const userName = localStorage.getItem('userName') || 'Technician';
      const prevAssignedRequests = useRef<Request[]>([]);
      const prevAvailableRequests = useRef<Request[]>([]);
      const prevStatuses = useRef<Map<number, string>>(new Map());
      const prevScheduledTimes = useRef<Map<number, string | null>>(new Map());

      const newJobAudio = new Audio('/sounds/technician update.mp3');
      let hasPlayed = false;

      const handleUserInteraction = () => {
        if (!hasInteracted) {
          setHasInteracted(true);
          setMessage({ text: 'Audio notifications enabled.', type: 'success' });
        }
      };

      const fetchData = async (isRetry = false) => {
        setIsLoading(true);
        try {
          const [assignedResponse, availableResponse] = await Promise.all([
            fetch(`${API_URL}/api/requests/technician/${technicianId}`),
            fetch(`${API_URL}/api/requests/available?technicianId=${technicianId}`)
          ]);

          if (!assignedResponse.ok) throw new Error(`Assigned requests HTTP error! Status: ${assignedResponse.status}`);
          if (!availableResponse.ok) throw new Error(`Available requests HTTP error! Status: ${availableResponse.status}`);

          const assignedData: Request[] = await assignedResponse.json();
          const availableData: Request[] | null = await availableResponse.json();

          const assignedArray = Array.isArray(assignedData) ? assignedData : [];
          const availableArray = Array.isArray(availableData) ? availableData : [];

          console.log('Fetched assigned requests:', assignedArray);
          console.log('Fetched available requests:', availableArray);

          const updatedAssigned = assignedRequests.map(req => {
            const newReq = assignedArray.find(r => r.id === req.id);
            if (!newReq || deepEqual(newReq, req)) return req;
            return { ...newReq, lastUpdated: Date.now() };
          });
          assignedArray.forEach(newReq => {
            if (!updatedAssigned.find(r => r.id === newReq.id)) {
              updatedAssigned.push({ ...newReq, lastUpdated: Date.now() });
            }
          });

          const filteredAvailable = Array.from(
            new Map(availableArray
              .filter(req => req.status === 'pending' && !req.technician_scheduled_time && !req.technician_id)
              .map(req => [req.id, req])
            ).values()
          );
          const updatedAvailable = availableRequests.map(req => {
            const newReq = filteredAvailable.find(r => r.id === req.id);
            if (!newReq || deepEqual(newReq, req)) return req;
            return { ...newReq, lastUpdated: Date.now() };
          });
          filteredAvailable.forEach(newReq => {
            if (!updatedAvailable.find(r => r.id === newReq.id)) {
              updatedAvailable.push({ ...newReq, lastUpdated: Date.now() });
            }
          });

          console.log('Updating state with assigned requests:', updatedAssigned);
          console.log('Updating state with available requests:', updatedAvailable);

          if (!deepEqual(updatedAssigned, prevAssignedRequests.current) && hasInteracted) {
            setAssignedRequests(updatedAssigned);
            prevAssignedRequests.current = updatedAssigned;
            if (!hasPlayed) {
              newJobAudio.play().catch(err => {
                console.error('Audio play failed:', err);
                setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
              });
              hasPlayed = true;
              setTimeout(() => { hasPlayed = false; }, 1000);
            }
          }
          if (!deepEqual(updatedAvailable, prevAvailableRequests.current) && hasInteracted) {
            setAvailableRequests(updatedAvailable);
            prevAvailableRequests.current = updatedAvailable;
            if (!hasPlayed) {
              newJobAudio.play().catch(err => {
                console.error('Audio play failed:', err);
                setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
              });
              hasPlayed = true;
              setTimeout(() => { hasPlayed = false; }, 1000);
            }
          }

          [...assignedArray, ...filteredAvailable].forEach(req => {
            prevStatuses.current.set(req.id, req.status);
            prevScheduledTimes.current.set(req.id, req.technician_scheduled_time);
          });

          if (availableArray.length === 0 && !isRetry && retryCount < 3) {
            setMessage({ text: `No available jobs found. Retrying (${retryCount + 1}/3)...`, type: 'info' });
            setRetryCount(prev => prev + 1);
            setTimeout(() => fetchData(true), 5000);
          } else if (availableArray.length === 0) {
            setMessage({ text: 'No available jobs in your selected regions. Check back later or update your service regions.', type: 'info' });
            setRetryCount(0);
          } else {
            setRetryCount(0);
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error fetching data:', error);
          setMessage({ text: `Error fetching data: ${error.message}. Retrying...`, type: 'error' });
          if (!isRetry && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            setTimeout(() => fetchData(true), 5000);
          } else {
            setMessage({ text: `Failed to fetch data after retries: ${error.message}. Please check your connection or contact support.`, type: 'error' });
            setAssignedRequests([]);
            setAvailableRequests([]);
            setRetryCount(0);
          }
        } finally {
          setIsLoading(false);
          console.log('Fetch complete, isLoading:', false);
        }
      };

      const toggleExpand = (requestId: number) => {
        setExpandedRequests(prev => ({
          ...prev,
          [requestId]: !prev[requestId],
        }));
      };

      useEffect(() => {
        if (!technicianId || role !== 'technician') {
          setMessage({ text: 'Please log in as a technician to view your dashboard.', type: 'error' });
          navigate('/login');
          return;
        }

        const validateSession = async () => {
          try {
            const response = await fetch(`${API_URL}/api/technicians/${technicianId}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            if (!data.valid) throw new Error('Invalid session');
          } catch (err: unknown) {
            const error = err as Error;
            console.error('Session validation failed:', error);
            setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
            navigate('/login');
          }
        };

        validateSession();
        setTimeout(fetchData, 1000);
        const intervalId = setInterval(fetchData, 300000); // 5 minutes

        return () => {
          clearInterval(intervalId);
        };
      }, [technicianId, role, navigate, hasInteracted]);

      const handleLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        localStorage.removeItem('userName');
        setMessage({ text: 'Logged out successfully!', type: 'success' });
        setTimeout(() => navigate('/login'), 1000);
      };

      const handleStartCompleteJob: MouseEventHandler<HTMLButtonElement> = (event) => {
        event.preventDefault();
        const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
        setCompletingRequestId(requestId);
        setCompletionNote('');
        setMessage({ text: 'Enter a note (optional) and confirm completion.', type: 'info' });
      };

      const handleConfirmCompleteJob = async () => {
        if (!completingRequestId || !technicianId) return;
        try {
          const response = await fetch(`${API_URL}/api/requests/complete-technician/${completingRequestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ technicianId: parseInt(technicianId), note: completionNote || null }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Job marked as completed! Awaiting customer confirmation.', type: 'success' });
            fetchData();
            setCompletingRequestId(null);
            setCompletionNote('');
          } else {
            setMessage({ text: `Failed to complete job: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error completing job:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const handleCancelCompleteJob = () => {
        setCompletingRequestId(null);
        setCompletionNote('');
        setMessage({ text: '', type: '' });
      };

      const handleUnacceptJob: MouseEventHandler<HTMLButtonElement> = async (event) => {
        event.preventDefault();
        const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
        if (!technicianId) return;
        try {
          const response = await fetch(`${API_URL}/api/requests/unassign/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ technicianId: parseInt(technicianId) }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Job unaccepted successfully!', type: 'success' });
            setAssignedRequests(prev => prev.filter(req => req.id !== requestId));
            fetchData();
          } else {
            setMessage({ text: `Failed to unaccept job: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error unaccepting job:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const handleRefresh = () => {
        setMessage({ text: 'Refreshing job list...', type: 'info' });
        fetchData();
      };

      const toggleHistory = () => {
        setShowHistory(prev => !prev);
      };

      const formatDateTime = (dateStr: string | null): string => {
        if (!dateStr) return 'Not specified';
        return moment.tz(dateStr, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
      };

      const DESCRIPTION_LIMIT = 100;

      const activeAssignedRequests = assignedRequests.filter(req => req.status !== 'completed' && req.status !== 'cancelled');
      const completedAssignedRequests = assignedRequests.filter(req => req.status === 'completed' || req.status === 'cancelled');

      console.log('Rendering with availableRequests:', availableRequests);

      return (
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col items-center bg-gray-100 p-4" onClick={handleUserInteraction}>
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 text-center">Welcome, {userName}</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate('/technician-edit-profile')}
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
                  className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition"
                >
                  Refresh Jobs
                </button>
                <button
                  onClick={toggleHistory}
                  className="ml-2 bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition"
                >
                  {showHistory ? 'Hide History' : 'Show Job History'}
                </button>
              </div>
              {isLoading ? (
                <p className="text-center text-gray-600">Loading requests...</p>
              ) : (
                <>
                  {showHistory ? (
                    <>
                      <h3 className="text-xl font-semibold text-gray-800 mb-4">Job History</h3>
                      {completedAssignedRequests.length === 0 ? (
                        <p className="text-gray-600 text-center mb-6">No completed or cancelled jobs.</p>
                      ) : (
                        <div className="space-y-4 mb-8">
                          {completedAssignedRequests.map(request => {
                            const isExpanded = expandedRequests[request.id] || false;
                            const isLong = request.repair_description.length > DESCRIPTION_LIMIT;
                            const displayDescription = isExpanded || !isLong
                              ? request.repair_description
                              : `${request.repair_description.slice(0, DESCRIPTION_LIMIT)}...`;
                            return (
                              <div key={request.id} className="border rounded-lg p-4">
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
                                <p><strong>Customer:</strong> {request.customer_name}</p>
                                <p><strong>Address:</strong> {request.customer_address || 'Not provided'}</p>
                                <p><strong>City:</strong> {request.customer_city || 'Not provided'}</p>
                                <p><strong>Postal Code:</strong> {request.customer_postal_code || 'Not provided'}</p>
                                <p><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                                {request.technician_scheduled_time && (
                                  <p><strong>Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                                )}
                                {request.technician_note && (
                                  <p><strong>Technician Note:</strong> {request.technician_note}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-semibold text-gray-800 mb-4">Available Jobs</h3>
                      {availableRequests.length === 0 ? (
                        <p className="text-gray-600 text-center mb-6">No available jobs in your selected regions. Check back later or update your service regions.</p>
                      ) : (
                        <div className="space-y-4 mb-8">
                          {availableRequests.map(request => {
                            const isExpanded = expandedRequests[request.id] || false;
                            const isLong = request.repair_description.length > DESCRIPTION_LIMIT;
                            const displayDescription = isExpanded || !isLong
                              ? request.repair_description
                              : `${request.repair_description.slice(0, DESCRIPTION_LIMIT)}...`;
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
                                <p><strong>Customer:</strong> {request.customer_name}</p>
                                <p><strong>Address:</strong> {request.customer_address || 'Not provided'}</p>
                                <p><strong>City:</strong> {request.customer_city || 'Not provided'}</p>
                                <p><strong>Postal Code:</strong> {request.customer_postal_code || 'Not provided'}</p>
                                <p><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                                <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                                <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                                <p><strong>Region:</strong> {request.region}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <h3 className="text-xl font-semibold text-gray-800 mb-4">Assigned Service Requests</h3>
                      {activeAssignedRequests.length === 0 ? (
                        <p className="text-gray-600 text-center mb-6">No active service requests assigned.</p>
                      ) : (
                        <div className="space-y-4 mb-8">
                          {activeAssignedRequests.map(request => {
                            const isExpanded = expandedRequests[request.id] || false;
                            const isLong = request.repair_description.length > DESCRIPTION_LIMIT;
                            const displayDescription = isExpanded || !isLong
                              ? request.repair_description
                              : `${request.repair_description.slice(0, DESCRIPTION_LIMIT)}...`;
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
                                <p><strong>Customer:</strong> {request.customer_name}</p>
                                <p><strong>Address:</strong> {request.customer_address || 'Not provided'}</p>
                                <p><strong>City:</strong> {request.customer_city || 'Not provided'}</p>
                                <p><strong>Postal Code:</strong> {request.customer_postal_code || 'Not provided'}</p>
                                <p><strong>Status:</strong> {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</p>
                                {isScheduled ? (
                                  <p><strong>Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                                ) : (
                                  <>
                                    <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                                    <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                                  </>
                                )}
                                {request.technician_note && (
                                  <p><strong>Technician Note:</strong> {request.technician_note}</p>
                                )}
                                {request.status === 'assigned' && (
                                  <>
                                    <button
                                      data-id={request.id}
                                      onClick={handleStartCompleteJob}
                                      className="mt-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition mr-2"
                                    >
                                      Complete Job
                                    </button>
                                    <button
                                      data-id={request.id}
                                      onClick={handleUnacceptJob}
                                      className="mt-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition"
                                    >
                                      Unaccept Job
                                    </button>
                                  </>
                                )}
                                {completingRequestId === request.id && (
                                  <div className="mt-2">
                                    <textarea
                                      value={completionNote}
                                      onChange={e => setCompletionNote(e.target.value)}
                                      placeholder="Enter completion note (optional)"
                                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg resize-y"
                                      rows={3}
                                    />
                                    <div className="mt-2 flex space-x-2">
                                      <button
                                        onClick={handleConfirmCompleteJob}
                                        className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                      >
                                        Confirm Completion
                                      </button>
                                      <button
                                        onClick={handleCancelCompleteJob}
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
        </ErrorBoundary>
      );
    }