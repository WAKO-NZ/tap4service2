/**
     * TechnicianDashboard.tsx - Version V6.102
     * - Removes page number from top right corner.
     * - Fixes TypeError by ensuring availableRequests is always an array.
     * - Requires user interaction for audio playback.
     * - Fetches available jobs based on technician's selected regions.
     * - Retains polling every 20 seconds with deep-equal comparison.
     * - Plays technician update.mp3 on updates after interaction.
     * - Supports rescheduling, job acceptance, and completion.
     * - Uses YYYY-MM-DD HH:mm:ss for API compatibility, displays DD/MM/YYYY HH:mm:ss in Pacific/Auckland.
     */
    import { useState, useEffect, useRef, Component, type ErrorInfo, MouseEventHandler } from 'react';
    import { useNavigate } from 'react-router-dom';
    import DatePicker from 'react-datepicker';
    import 'react-datepicker/dist/react-datepicker.css';
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
      lastUpdated?: number;
    }

    interface ExpandedRequests {
      [key: number]: boolean;
    }

    interface TechnicianProfile {
      regions: string[];
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
      const [technicianRegions, setTechnicianRegions] = useState<string[]>([]);
      const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
      const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
      const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
      const [isLoading, setIsLoading] = useState(true);
      const [completionNote, setCompletionNote] = useState<string>('');
      const [completingRequestId, setCompletingRequestId] = useState<number | null>(null);
      const [proposingRequestId, setProposingRequestId] = useState<number | null>(null);
      const [proposedTime, setProposedTime] = useState<Date | null>(null);
      const [selectedAvailability, setSelectedAvailability] = useState<string | null>(null);
      const [hasInteracted, setHasInteracted] = useState(false);
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

      const fetchTechnicianProfile = async () => {
        try {
          const response = await fetch(`${API_URL}/api/technician/profile/${technicianId}`);
          if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
          const data: TechnicianProfile = await response.json();
          setTechnicianRegions(data.regions || []);
          console.log('Fetched technician regions:', data.regions);
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error fetching technician profile:', error);
          setMessage({ text: `Error fetching profile: ${error.message}. Defaulting to no region filter.`, type: 'error' });
          setTechnicianRegions([]);
        }
      };

      const fetchData = async () => {
        setIsLoading(true);
        try {
          const regionsQuery = technicianRegions.length > 0 ? `&regions=${encodeURIComponent(technicianRegions.join(','))}` : '';
          const [assignedResponse, availableResponse] = await Promise.all([
            fetch(`${API_URL}/api/requests/technician/${technicianId}`),
            fetch(`${API_URL}/api/requests/available?technicianId=${technicianId}${regionsQuery}`)
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
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error fetching data:', error);
          setMessage({ text: `Error fetching data: ${error.message}`, type: 'error' });
          setAssignedRequests([]);
          setAvailableRequests([]);
        } finally {
          setIsLoading(false);
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
        fetchTechnicianProfile().then(fetchData);
        const intervalId = setInterval(fetchData, 20000);

        return () => {
          clearInterval(intervalId);
        };
      }, [technicianId, role, navigate, hasInteracted, technicianRegions]);

      const handleLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        localStorage.removeItem('userName');
        setMessage({ text: 'Logged out successfully!', type: 'success' });
        setTimeout(() => navigate('/login'), 1000);
      };

      const handleSelectJob = (requestId: number) => {
        setSelectedRequestId(requestId);
        setSelectedAvailability(null);
        setMessage({ text: 'Select an availability time to accept the job.', type: 'info' });
      };

      const handleConfirmJob = async () => {
        if (!selectedRequestId || !technicianId || !selectedAvailability) return;
        try {
          const response = await fetch(`${API_URL}/api/requests/assign/${selectedRequestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              technicianId: parseInt(technicianId), 
              scheduledTime: moment.tz(selectedAvailability, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss') 
            }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Job accepted successfully! Payment authorized.', type: 'success' });
            setAvailableRequests(prev => prev.filter(req => req.id !== selectedRequestId));
            fetchData();
            setSelectedRequestId(null);
            setSelectedAvailability(null);
          } else {
            setMessage({ text: `Failed to accept job: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error assigning job:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const handleCancelSelection = () => {
        setSelectedRequestId(null);
        setProposingRequestId(null);
        setProposedTime(null);
        setSelectedAvailability(null);
        setMessage({ text: '', type: '' });
      };

      const handleRequestAlternative = (requestId: number) => {
        setProposingRequestId(requestId);
        setProposedTime(null);
        setMessage({ text: 'Select an alternative date and time to propose.', type: 'info' });
      };

      const handleProposeAlternative = async () => {
        if (!proposingRequestId || !technicianId || !proposedTime) return;
        try {
          const proposedDate = moment.tz(proposedTime, 'Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss');
          const response = await fetch(`${API_URL}/api/requests/propose/${proposingRequestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              technicianId: parseInt(technicianId),
              proposedTime: proposedDate,
            }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Alternative time proposed, awaiting customer confirmation.', type: 'success' });
            if (hasInteracted && !hasPlayed) {
              newJobAudio.play().catch(err => {
                console.error('Audio play failed:', err);
                setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
              });
              hasPlayed = true;
              setTimeout(() => { hasPlayed = false; }, 1000);
            }
            setProposingRequestId(null);
            setProposedTime(null);
          } else {
            setMessage({ text: `Failed to propose alternative: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error proposing alternative:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
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

      const handleRespondToRequest: MouseEventHandler<HTMLButtonElement> = async (event) => {
        event.preventDefault();
        const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
        const action = event.currentTarget.getAttribute('data-action') as 'accept' | 'decline';
        if (!technicianId) {
          setMessage({ text: 'Please log in as a technician to respond.', type: 'error' });
          return;
        }
        try {
          const request = availableRequests.find(req => req.id === requestId) || assignedRequests.find(req => req.id === requestId);
          if (!request) {
            setMessage({ text: 'Request not found.', type: 'error' });
            return;
          }
          const response = await fetch(`${API_URL}/api/requests/respond/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              technicianId: parseInt(technicianId),
              action,
            }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: data.message || `${action === 'accept' ? 'Accepted' : 'Declined'} successfully!`, type: 'success' });
            fetchData();
          } else {
            setMessage({ text: `Failed to ${action}: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error responding to request:', error);
          setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
        }
      };

      const getValidAvailabilityTimes = (request: Request): Date[] => {
        const times: Date[] = [];
        if (request.customer_availability_1) {
          times.push(moment.tz(request.customer_availability_1, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland').toDate());
        }
        if (request.customer_availability_2) {
          times.push(moment.tz(request.customer_availability_2, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland').toDate());
        }
        return times;
      };

      const formatDateTime = (dateStr: string | null): string => {
        if (!dateStr) return 'Not specified';
        return moment.tz(dateStr, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
      };

      const DESCRIPTION_LIMIT = 100;

      const activeAssignedRequests = assignedRequests.filter(req => req.status !== 'completed' && req.status !== 'cancelled');
      const completedAssignedRequests = assignedRequests.filter(req => req.status === 'completed');

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
              {isLoading ? (
                <p className="text-center text-gray-600">Loading requests...</p>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Available Jobs</h3>
                  {availableRequests.length === 0 ? (
                    <p className="text-gray-600 text-center mb-6">No available jobs in your selected regions.</p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {availableRequests.map(request => {
                        const isExpanded = expandedRequests[request.id] || false;
                        const isLong = request.repair_description.length > DESCRIPTION_LIMIT;
                        const displayDescription = isExpanded || !isLong
                          ? request.repair_description
                          : `${request.repair_description.slice(0, DESCRIPTION_LIMIT)}...`;
                        const availabilityOptions = getValidAvailabilityTimes(request).map(date => ({
                          value: moment.tz(date, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss'),
                          label: formatDateTime(moment.tz(date, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss')),
                        }));
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
                            <div className="mt-2 space-x-2">
                              <button
                                onClick={() => handleSelectJob(request.id)}
                                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                                disabled={selectedRequestId !== null || proposingRequestId !== null}
                              >
                                Accept Job
                              </button>
                            </div>
                            {selectedRequestId === request.id && availabilityOptions.length > 0 && (
                              <div className="mt-2 space-y-2">
                                <div>
                                  <label className="block text-gray-700 text-lg mb-2">Select Availability Time</label>
                                  {availabilityOptions.map(option => (
                                    <div key={option.value} className="flex items-center">
                                      <input
                                        type="radio"
                                        name={`availability-${request.id}`}
                                        value={option.value}
                                        checked={selectedAvailability === option.value}
                                        onChange={(e) => setSelectedAvailability(e.target.value)}
                                        className="mr-2"
                                      />
                                      <label>{option.label}</label>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={handleConfirmJob}
                                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                    disabled={!selectedAvailability}
                                  >
                                    Confirm Acceptance
                                  </button>
                                  <button
                                    onClick={() => handleRequestAlternative(request.id)}
                                    className="bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-700 transition"
                                    disabled={!selectedAvailability}
                                  >
                                    Request Alternative Date/Time
                                  </button>
                                  <button
                                    onClick={handleCancelSelection}
                                    className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {proposingRequestId === request.id && (
                                  <div className="mt-2 space-y-2">
                                    <div>
                                      <label className="block text-gray-700 text-lg mb-2">Propose Alternative Time</label>
                                      <DatePicker
                                        selected={proposedTime}
                                        onChange={(date: Date | null) => setProposedTime(date)}
                                        showTimeSelect
                                        timeFormat="HH:mm:ss"
                                        timeIntervals={15}
                                        dateFormat="dd/MM/yyyy HH:mm:ss"
                                        minDate={new Date()}
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholderText="Select alternative date and time"
                                      />
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={handleProposeAlternative}
                                        className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                        disabled={!proposedTime}
                                      >
                                        Submit Proposal
                                      </button>
                                      <button
                                        onClick={handleCancelSelection}
                                        className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
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
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Completed Jobs</h3>
                  {completedAssignedRequests.length === 0 ? (
                    <p className="text-gray-600 text-center mb-6">No completed jobs.</p>
                  ) : (
                    <div className="space-y-4">
                      {completedAssignedRequests.map(request => {
                        const isExpanded = expandedRequests[request.id] || false;
                        const isLong = request.repair_description.length > DESCRIPTION_LIMIT;
                        const displayDescription = isExpanded || !isLong
                          ? request.repair_description
                          : `${request.repair_description.slice(0, DESCRIPTION_LIMIT)}...`;
                        const isScheduled = request.status === 'completed' && request.technician_scheduled_time;
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
                          </div>
                        );
                      })}
                    </div>
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