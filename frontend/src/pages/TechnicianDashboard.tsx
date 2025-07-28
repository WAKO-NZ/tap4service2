/**
 * TechnicianDashboard.tsx - Version V6.103
 * - Fetches available (pending, unassigned) and assigned (technician_id=logged-in) requests.
 * - Allows accepting jobs (PUT /api/requests/accept/:id) with immediate display in Assigned Service Requests.
 * - Allows unassigning jobs (PUT /api/requests/unassign/:id) with immediate removal and return to Available.
 * - Shows assigned jobs with 'Complete Job' button, notes input, and timestamp.
 * - Excludes rescheduled jobs from assigned requests (status='pending').
 * - Plays sound only for new active jobs (recent lastUpdated) with On/Off toggle.
 * - Polls every 5 minutes or on manual refresh.
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
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [completingRequestId, setCompletingRequestId] = useState<number | null>(null);
  const [technicianNote, setTechnicianNote] = useState<string>('');
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    return localStorage.getItem('audioEnabled') !== 'false';
  });
  const navigate = useNavigate();
  const technicianId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Technician';
  const prevAvailable = useRef<Request[]>([]);
  const prevAssigned = useRef<Request[]>([]);
  const hasFetched = useRef(false);
  const updateAudio = new Audio('/sounds/customer update.mp3');

  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const newState = !prev;
      localStorage.setItem('audioEnabled', newState.toString());
      return newState;
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
        technician_note: req.technician_note ?? null,
        lastUpdated: req.lastUpdated ?? Date.now()
      }));

      // Fetch assigned requests
      const assignedResponse = await fetch(`${API_URL}/api/requests/technician/${technicianId}`);
      if (!assignedResponse.ok) throw new Error(`HTTP error! Status: ${assignedResponse.status}`);
      const assignedData: Request[] = await assignedResponse.json();
      const sanitizedAssigned = assignedData
        .filter(req => req.status === 'assigned' || req.status === 'completed_technician')
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
          technician_note: req.technician_note ?? null,
          lastUpdated: req.lastUpdated ?? Date.now()
        }));

      // Play sound for new assigned jobs
      if (audioEnabled && !deepEqual(sanitizedAssigned, prevAssigned.current)) {
        const newJobs = sanitizedAssigned.filter(req => 
          req.status === 'assigned' && 
          (!prevAssigned.current.some(prev => prev.id === req.id) || 
           (req.lastUpdated && (Date.now() - req.lastUpdated) < 2000))
        );
        if (newJobs.length > 0) {
          updateAudio.play().catch(err => {
            console.error('Audio play failed:', err);
            setMessage({ text: 'Audio notification failed.', type: 'error' });
          });
        }
      }

      if (!deepEqual(sanitizedAvailable, prevAvailable.current) || !deepEqual(sanitizedAssigned, prevAssigned.current)) {
        setAvailableRequests(sanitizedAvailable);
        setAssignedRequests(sanitizedAssigned);
        prevAvailable.current = sanitizedAvailable;
        prevAssigned.current = sanitizedAssigned;
      }
      setMessage({ text: `Found ${sanitizedAvailable.length} available and ${sanitizedAssigned.length} assigned request(s).`, type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      setMessage({ text: `Error fetching data: ${error.message}`, type: 'error' });
      setAvailableRequests([]);
      setAssignedRequests([]);
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
    const intervalId = setInterval(fetchData, 300000); // 5 minutes
    return () => clearInterval(intervalId);
  }, [technicianId, role, navigate]);

  const handleAccept: MouseEventHandler<HTMLButtonElement> = async (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    if (!technicianId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/accept/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId) })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Request accepted successfully!', type: 'success' });
        // Move request to assigned immediately
        const acceptedRequest = availableRequests.find(req => req.id === requestId);
        if (acceptedRequest) {
          const updatedRequest = {
            ...acceptedRequest,
            status: 'assigned' as const,
            technician_id: parseInt(technicianId),
            technician_scheduled_time: acceptedRequest.customer_availability_1,
            lastUpdated: Date.now()
          };
          setAssignedRequests(prev => [...prev, updatedRequest]);
          setAvailableRequests(prev => prev.filter(req => req.id !== requestId));
          if (audioEnabled) {
            updateAudio.play().catch(err => {
              console.error('Audio play failed:', err);
              setMessage({ text: 'Audio notification failed.', type: 'error' });
            });
          }
        }
      } else {
        setMessage({ text: `Failed to accept: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error accepting request:', error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
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
          setAvailableRequests(prev => [...prev, updatedRequest]);
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
        setMessage({ text: 'Request marked as completed!', type: 'success' });
        setAssignedRequests(prev =>
          prev.map(req =>
            req.id === completingRequestId
              ? { ...req, status: 'completed_technician' as const, technician_note: technicianNote, technician_scheduled_time: moment().tz('Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss'), lastUpdated: Date.now() }
              : req
          )
        );
        setCompletingRequestId(null);
        setTechnicianNote('');
      } else {
        setMessage({ text: `Failed to complete: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error completing request:', error);
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
    setTimeout(() => navigate('/login'), 1000);
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
            </div>
            {isLoading && !hasFetched.current ? (
              <p className="text-center text-gray-600">Loading requests...</p>
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
                          <p><strong>Customer Address:</strong> {request.customer_address ?? 'Not provided'}</p>
                          <p><strong>Customer City:</strong> {request.customer_city ?? 'Not provided'}</p>
                          <p><strong>Customer Postal Code:</strong> {request.customer_postal_code ?? 'Not provided'}</p>
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
                        </div>
                      );
                    })}
                  </div>
                )}
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Assigned Service Requests</h3>
                {assignedRequests.length === 0 ? (
                  <p className="text-gray-600 text-center mb-6">No assigned service requests.</p>
                ) : (
                  <div className="space-y-4 mb-8">
                    {assignedRequests.map(request => {
                      const isExpanded = expandedRequests[request.id] || false;
                      const isLong = (request.repair_description?.length ?? 0) > DESCRIPTION_LIMIT;
                      const displayDescription = isExpanded || !isLong
                        ? request.repair_description ?? 'Unknown'
                        : `${request.repair_description?.slice(0, DESCRIPTION_LIMIT) ?? 'Unknown'}...`;
                      const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
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
                          <p><strong>Customer Address:</strong> {request.customer_address ?? 'Not provided'}</p>
                          <p><strong>Customer City:</strong> {request.customer_city ?? 'Not provided'}</p>
                          <p><strong>Customer Postal Code:</strong> {request.customer_postal_code ?? 'Not provided'}</p>
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