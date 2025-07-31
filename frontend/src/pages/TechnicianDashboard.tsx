/**
 * TechnicianDashboard.tsx - Version V6.109
 * - Updated audio file path to /sounds/technician update.mp3.
 * - Fixed audio failing to play sometimes with improved error handling.
 * - Audio plays only on changes in available requests or status updates, not on refresh.
 * - Confirmed "Complete Job" and "Unassign Job" buttons are next to each other.
 * - Fetches available (pending, unassigned) and assigned (technician_id=logged-in) requests.
 * - Allows accepting/unassigning jobs with immediate UI updates, no sound.
 * - Moved Completed Jobs to Show/Hide Job History button.
 * - Sorts jobs by lastUpdated or created_at (descending).
 * - Polls every 1 minute (60,000 ms).
 * - Added selection for availability 1 or 2 when accepting a job.
 * - Combined customer address into one line with Google Maps link.
 * - Added customer phone numbers (primary and alternate).
 * - Logout redirects to landing page (/).
 * - Removed Back button.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, type MouseEventHandler } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment-timezone';
import deepEqual from 'deep-equal';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

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
  customer_name: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_postal_code: string | null;
  customer_phone_number: string | null;
  customer_alternate_phone_number: string | null;
  technician_note: string | null;
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
  const [availableRequests, setAvailableRequests] = useState<Request[]>([]);
  const [assignedRequests, setAssignedRequests] = useState<Request[]>([]);
  const [completedRequests, setCompletedRequests] = useState<Request[]>([]);
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [completingRequestId, setCompletingRequestId] = useState<number | null>(null);
  const [acceptingRequestId, setAcceptingRequestId] = useState<number | null>(null);
  const [selectedAvailability, setSelectedAvailability] = useState<1 | 2 | null>(null);
  const [technicianNote, setTechnicianNote] = useState<string>('');
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    return localStorage.getItem('audioEnabled') !== 'false';
  });
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const technicianId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Technician';
  const prevAvailable = useRef<Request[]>([]);
  const prevAssigned = useRef<Request[]>([]);
  const prevCompleted = useRef<Request[]>([]);
  const hasFetched = useRef(false);
  const updateAudio = new Audio('/sounds/technician update.mp3');

  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const newState = !prev;
      localStorage.setItem('audioEnabled', newState.toString());
      return newState;
    });
  };

  const sortRequests = (requests: Request[]): Request[] => {
    return [...requests].sort((a, b) => {
      const timeA = a.lastUpdated || moment(a.created_at).valueOf();
      const timeB = b.lastUpdated || moment(b.created_at).valueOf();
      return timeB - timeA;
    });
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch available requests
      const availableResponse = await fetch(`${API_URL}/api/requests/available?technicianId=${technicianId}`);
      if (!availableResponse.ok) throw new Error(`HTTP error! Status: ${availableResponse.status}`);
      const availableData: Request[] = await availableResponse.json();
      const sanitizedAvailable = availableData.map(req => ({
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
        customer_name: req.customer_name ?? null,
        customer_address: req.customer_address ?? null,
        customer_city: req.customer_city ?? null,
        customer_postal_code: req.customer_postal_code ?? null,
        customer_phone_number: req.customer_phone_number ?? null,
        customer_alternate_phone_number: req.customer_alternate_phone_number ?? null,
        technician_note: req.technician_note ?? null,
        lastUpdated: req.lastUpdated ?? Date.now()
      }));

      // Fetch assigned and completed requests
      const assignedResponse = await fetch(`${API_URL}/api/requests/technician/${technicianId}`);
      if (!assignedResponse.ok) throw new Error(`HTTP error! Status: ${assignedResponse.status}`);
      const assignedData: Request[] = await assignedResponse.json();
      const sanitizedAssigned = assignedData
        .filter(req => req.status === 'assigned')
        .map(req => ({
          id: req.id ?? 0,
          repair_description: req.repair_description ?? 'Unknown',
          created_at: req.created_at ?? null,
          status: req.status ?? 'assigned',
          customer_availability_1: req.customer_availability_1 ?? null,
          customer_availability_2: req.customer_availability_2 ?? null,
          technician_scheduled_time: req.technician_scheduled_time ?? null,
          technician_id: req.technician_id ?? null,
          technician_name: req.technician_name ?? null,
          region: req.region ?? null,
          customer_name: req.customer_name ?? null,
          customer_address: req.customer_address ?? null,
          customer_city: req.customer_city ?? null,
          customer_postal_code: req.customer_postal_code ?? null,
          customer_phone_number: req.customer_phone_number ?? null,
          customer_alternate_phone_number: req.customer_alternate_phone_number ?? null,
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));
      const sanitizedCompleted = assignedData
        .filter(req => req.status === 'completed_technician' || req.status === 'completed')
        .map(req => ({
          id: req.id ?? 0,
          repair_description: req.repair_description ?? 'Unknown',
          created_at: req.created_at ?? null,
          status: req.status ?? 'completed_technician',
          customer_availability_1: req.customer_availability_1 ?? null,
          customer_availability_2: req.customer_availability_2 ?? null,
          technician_scheduled_time: req.technician_scheduled_time ?? null,
          technician_id: req.technician_id ?? null,
          technician_name: req.technician_name ?? null,
          region: req.region ?? null,
          customer_name: req.customer_name ?? null,
          customer_address: req.customer_address ?? null,
          customer_city: req.customer_city ?? null,
          customer_postal_code: req.customer_postal_code ?? null,
          customer_phone_number: req.customer_phone_number ?? null,
          customer_alternate_phone_number: req.customer_alternate_phone_number ?? null,
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));

      // Play sound for new available or status updates
      if (audioEnabled) {
        if (!deepEqual(sanitizedAvailable, prevAvailable.current)) {
          const newJobs = sanitizedAvailable.filter(req => 
            !prevAvailable.current.some(prev => prev.id === req.id)
          );
          if (newJobs.length > 0) {
            updateAudio.play().catch(err => {
              console.error('Audio play failed:', err);
              setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
            });
          }
        }
        if (!deepEqual(sanitizedAssigned, prevAssigned.current) || !deepEqual(sanitizedCompleted, prevCompleted.current)) {
          const statusUpdates = [...sanitizedAssigned, ...sanitizedCompleted].filter(req => {
            const prevReq = [...prevAssigned.current, ...prevCompleted.current].find(prev => prev.id === req.id);
            return !prevReq || prevReq.status !== req.status;
          });
          if (statusUpdates.length > 0) {
            updateAudio.play().catch(err => {
              console.error('Audio play failed:', err);
              setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
            });
          }
        }
      }

      if (!deepEqual(sanitizedAvailable, prevAvailable.current) || 
          !deepEqual(sanitizedAssigned, prevAssigned.current) || 
          !deepEqual(sanitizedCompleted, prevCompleted.current)) {
        setAvailableRequests(sortRequests(sanitizedAvailable));
        setAssignedRequests(sortRequests(sanitizedAssigned));
        setCompletedRequests(sortRequests(sanitizedCompleted));
        prevAvailable.current = sanitizedAvailable;
        prevAssigned.current = sanitizedAssigned;
        prevCompleted.current = sanitizedCompleted;
      }
      setMessage({ text: `Found ${sanitizedAvailable.length} available, ${sanitizedAssigned.length} assigned, and ${sanitizedCompleted.length} completed request(s).`, type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      setMessage({ text: `Error fetching data: ${error.message}`, type: 'error' });
      setAvailableRequests([]);
      setAssignedRequests([]);
      setCompletedRequests([]);
    } finally {
      setIsLoading(false);
      hasFetched.current = true;
    }
  };

  useEffect(() => {
    if (!technicianId || role !== 'technician') {
      setMessage({ text: 'Please log in as a technician to view your dashboard.', type: 'error' });
      navigate('/login');
      return;
    }

    fetchData();
    const intervalId = setInterval(fetchData, 60000); // 1 minute
    return () => clearInterval(intervalId);
  }, [technicianId, role, navigate]);

  const handleAccept: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    setAcceptingRequestId(requestId);
    setSelectedAvailability(null);
    setMessage({ text: 'Select availability time.', type: 'info' });
  };

  const handleConfirmAccept = async () => {
    if (!acceptingRequestId || !selectedAvailability || !technicianId) return;
    const acceptedRequest = availableRequests.find(req => req.id === acceptingRequestId);
    if (!acceptedRequest) return;
    const scheduledTime = selectedAvailability === 1 ? acceptedRequest.customer_availability_1 : acceptedRequest.customer_availability_2;
    if (!scheduledTime) return;

    try {
      const response = await fetch(`${API_URL}/api/requests/accept/${acceptingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), scheduledTime })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Request accepted successfully!', type: 'success' });
        // Move request to assigned immediately
        const updatedRequest = {
          ...acceptedRequest,
          status: 'assigned' as const,
          technician_id: parseInt(technicianId),
          technician_scheduled_time: scheduledTime,
          lastUpdated: Date.now()
        };
        setAssignedRequests(prev => sortRequests([...prev, updatedRequest]));
        setAvailableRequests(prev => prev.filter(req => req.id !== acceptingRequestId));
        setAcceptingRequestId(null);
        setSelectedAvailability(null);
      } else {
        setMessage({ text: `Failed to accept: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error accepting request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleCancelAccept = () => {
    setAcceptingRequestId(null);
    setSelectedAvailability(null);
    setMessage({ text: '', type: '' });
  };

  const handleUnassign: MouseEventHandler<HTMLButtonElement> = async (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    if (!technicianId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/unassign/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId) })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Request unassigned successfully!', type: 'success' });
        // Move request to available immediately
        const unassignedRequest = assignedRequests.find(req => req.id === requestId);
        if (unassignedRequest) {
          const updatedRequest = {
            ...unassignedRequest,
            status: 'pending' as const,
            technician_id: null,
            technician_scheduled_time: null,
            lastUpdated: Date.now()
          };
          setAvailableRequests(prev => sortRequests([...prev, updatedRequest]));
          setAssignedRequests(prev => prev.filter(req => req.id !== requestId));
        }
      } else {
        setMessage({ text: `Failed to unassign: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error unassigning request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleComplete: MouseEventHandler<HTMLButtonElement> = (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    setCompletingRequestId(requestId);
    setTechnicianNote('');
    setMessage({ text: 'Enter completion notes.', type: 'info' });
  };

  const handleConfirmComplete = async () => {
    if (!completingRequestId || !technicianId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/complete-technician/${completingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), note: technicianNote })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Completion confirmed successfully!', type: 'success' });
        const completedRequest = assignedRequests.find(req => req.id === completingRequestId);
        if (completedRequest) {
          const updatedRequest = {
            ...completedRequest,
            status: 'completed_technician' as const,
            technician_note: technicianNote,
            lastUpdated: Date.now()
          };
          setCompletedRequests(prev => sortRequests([...prev, updatedRequest]));
          setAssignedRequests(prev => prev.filter(req => req.id !== completingRequestId));
        }
        setCompletingRequestId(null);
        setTechnicianNote('');
      } else {
        setMessage({ text: `Failed to complete: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error confirming completion:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const handleCancelComplete = () => {
    setCompletingRequestId(null);
    setTechnicianNote('');
    setMessage({ text: '', type: '' });
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    setMessage({ text: 'Logged out successfully!', type: 'success' });
    setTimeout(() => navigate('/'), 1000); // Redirect to landing page after logout
  };

  const toggleExpand = (requestId: number) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr || !moment(dateStr, moment.ISO_8601, true).isValid()) return 'Not specified';
    return moment.tz(dateStr, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
  };

  const getGoogleMapsLink = (address: string | null, city: string | null, postalCode: string | null): string => {
    const fullAddress = `${address}, ${city}, ${postalCode}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  };

  const DESCRIPTION_LIMIT = 100;

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center bg-gray-100 p-4">
        <div className="w-full max-w-4xl">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Welcome, {userName}</h2>
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
            <div className="flex justify-end mb-4 space-x-2">
              <button
                onClick={fetchData}
                className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition"
              >
                Refresh Requests
              </button>
              <button
                onClick={toggleAudio}
                className={`font-semibold py-2 px-4 rounded-lg transition ${audioEnabled ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-500 hover:bg-gray-600'} text-white`}
              >
                Audio Notifications: {audioEnabled ? 'On' : 'Off'}
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
                      <p className="text-gray-600 text-center mb-6">No completed jobs.</p>
                    ) : (
                      <div className="space-y-4 mb-8">
                        {completedRequests.map(request => {
                          const isExpanded = expandedRequests[request.id] || false;
                          const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                          const displayDescription = isExpanded || !isLong
                            ? request.repair_description ?? 'Unknown'
                            : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                          const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                          const fullAddress = `${request.customer_address}, ${request.customer_city}, ${request.customer_postal_code}`.trim();
                          return (
                            <div
                              key={request.id}
                              className={`border rounded-lg p-4 ${isRecentlyUpdated ? 'bg-yellow-100' : ''}`}
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
                              <p><strong>Customer Name:</strong> {request.customer_name ?? 'Not provided'}</p>
                              <p><strong>Customer Address:</strong> <a href={getGoogleMapsLink(request.customer_address, request.customer_city, request.customer_postal_code)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{fullAddress}</a></p>
                              <p><strong>Phone Number:</strong> {request.customer_phone_number ?? 'Not provided'}</p>
                              <p><strong>Alternate Phone Number:</strong> {request.customer_alternate_phone_number ?? 'Not provided'}</p>
                              <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                              <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                              <p><strong>Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                              <p><strong>Region:</strong> {request.region ?? 'Not provided'}</p>
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
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Available Service Requests</h3>
                    {availableRequests.length === 0 ? (
                      <p className="text-gray-600 text-center mb-6">No available service requests.</p>
                    ) : (
                      <div className="space-y-4 mb-8">
                        {availableRequests.map(request => {
                          const isExpanded = expandedRequests[request.id] || false;
                          const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                          const displayDescription = isExpanded || !isLong
                            ? request.repair_description ?? 'Unknown'
                            : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                          const fullAddress = `${request.customer_address}, ${request.customer_city}, ${request.customer_postal_code}`.trim();
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
                              <p><strong>Customer Name:</strong> {request.customer_name ?? 'Not provided'}</p>
                              <p><strong>Customer Address:</strong> <a href={getGoogleMapsLink(request.customer_address, request.customer_city, request.customer_postal_code)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{fullAddress}</a></p>
                              <p><strong>Phone Number:</strong> {request.customer_phone_number ?? 'Not provided'}</p>
                              <p><strong>Alternate Phone Number:</strong> {request.customer_alternate_phone_number ?? 'Not provided'}</p>
                              <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                              <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                              <p><strong>Region:</strong> {request.region ?? 'Not provided'}</p>
                              <button
                                data-id={request.id}
                                onClick={handleAccept}
                                className="mt-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                              >
                                Accept Job
                              </button>
                              {acceptingRequestId === request.id && (
                                <div className="mt-2 space-y-2">
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => setSelectedAvailability(1)}
                                      className={`font-semibold py-2 px-4 rounded-lg transition ${selectedAvailability === 1 ? 'bg-blue-500' : 'bg-gray-500'} text-white`}
                                    >
                                      Availability 1
                                    </button>
                                    <button
                                      onClick={() => setSelectedAvailability(2)}
                                      className={`font-semibold py-2 px-4 rounded-lg transition ${selectedAvailability === 2 ? 'bg-blue-500' : 'bg-gray-500'} text-white`}
                                    >
                                      Availability 2
                                    </button>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={handleConfirmAccept}
                                      className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                      disabled={!selectedAvailability}
                                    >
                                      Confirm Accept
                                    </button>
                                    <button
                                      onClick={handleCancelAccept}
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
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Assigned Jobs</h3>
                    {assignedRequests.length === 0 ? (
                      <p className="text-gray-600 text-center mb-6">No assigned jobs.</p>
                    ) : (
                      <div className="space-y-4 mb-8">
                        {assignedRequests.map(request => {
                          const isExpanded = expandedRequests[request.id] || false;
                          const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                          const displayDescription = isExpanded || !isLong
                            ? request.repair_description ?? 'Unknown'
                            : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                          const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                          const fullAddress = `${request.customer_address}, ${request.customer_city}, ${request.customer_postal_code}`.trim();
                          return (
                            <div
                              key={request.id}
                              className={`border rounded-lg p-4 ${isRecentlyUpdated ? 'bg-yellow-100' : ''}`}
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
                              <p><strong>Customer Name:</strong> {request.customer_name ?? 'Not provided'}</p>
                              <p><strong>Customer Address:</strong> <a href={getGoogleMapsLink(request.customer_address, request.customer_city, request.customer_postal_code)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{fullAddress}</a></p>
                              <p><strong>Phone Number:</strong> {request.customer_phone_number ?? 'Not provided'}</p>
                              <p><strong>Alternate Phone Number:</strong> {request.customer_alternate_phone_number ?? 'Not provided'}</p>
                              <p><strong>Availability 1:</strong> {formatDateTime(request.customer_availability_1)}</p>
                              <p><strong>Availability 2:</strong> {formatDateTime(request.customer_availability_2)}</p>
                              <p><strong>Scheduled Time:</strong> {formatDateTime(request.technician_scheduled_time)}</p>
                              <p><strong>Region:</strong> {request.region ?? 'Not provided'}</p>
                              {request.technician_note && (
                                <p><strong>Technician Note:</strong> {request.technician_note}</p>
                              )}
                              {request.status === 'assigned' && (
                                <div className="mt-2 space-x-2">
                                  <button
                                    data-id={request.id}
                                    onClick={handleComplete}
                                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                  >
                                    Complete Job
                                  </button>
                                  <button
                                    data-id={request.id}
                                    onClick={handleUnassign}
                                    className="bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-700 transition"
                                  >
                                    Unassign Job
                                  </button>
                                </div>
                              )}
                              {completingRequestId === request.id && (
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <label className="block text-gray-700 text-lg mb-2">Completion Notes</label>
                                    <textarea
                                      value={technicianNote}
                                      onChange={(e) => setTechnicianNote(e.target.value)}
                                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      rows={4}
                                      placeholder="Enter any completion notes"
                                    />
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={handleConfirmComplete}
                                      className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                    >
                                      Confirm Completion
                                    </button>
                                    <button
                                      onClick={handleCancelComplete}
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
              </>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}