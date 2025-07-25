/**
 * CustomerDashboard.tsx - Version V5.319
 * - Reintroduces "Request a Technician" button to navigate to /request-technician.
 * - Retains fixes: TS7016 (deep-equal), TS2322 (requestId, proposed_time, technician_id).
 * - Updates every 20 seconds, only if data differs (using deep-equal).
 * - Adds Pending Proposals section for approving/declining technician times.
 * - Never logs out unless Logout is selected.
 * - Auto-updates in real-time via WebSocket.
 * - Plays customer update.mp3 on updates.
 * - Includes all job details in WebSocket updates (Repair Description, Customer, Address, etc.).
 * - Hides Availability 1/2 when status is assigned/completed.
 * - Integrates with service_requests and pending_proposals tables.
 * - Uses DD/MM/YYYY HH:MM:SS in Pacific/Auckland.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, MouseEventHandler } from 'react';
import { useNavigate } from 'react-router-dom';
import { w3cwebsocket as W3CWebSocket } from 'websocket';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import moment from 'moment-timezone';
import deepEqual from 'deep-equal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

interface Request {
  id: number;
  repair_description: string;
  created_at: string;
  status: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  technician_scheduled_time: string | null;
  technician_id: number | null;
  technician_name: string | null;
  technician_note: string | null;
  payment_status: 'pending' | 'authorized' | 'captured';
  region: string;
  customer_name: string;
  customer_address: string | null;
  customer_city: string | null;
  customer_postal_code: string | null;
  lastUpdated?: number; // For visual feedback
}

interface Proposal {
  id: number;
  request_id: number;
  technician_id: number;
  technician_name: string;
  proposed_time: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

interface ExpandedRequests {
  [key: number]: boolean;
}

interface WebSocketMessage {
  type: 'update' | 'new_job' | 'ping' | 'pong' | 'proposal';
  requestId?: number;
  status?: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
  technician_id?: number | null;
  technician_scheduled_time?: string | null;
  customer_availability_1?: string | null;
  customer_availability_2?: string | null;
  repair_description?: string;
  created_at?: string;
  customer_name?: string;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_postal_code?: string | null;
  technician_note?: string | null;
  technician_name?: string | null;
  proposed_time?: string;
  proposal_status?: 'approved' | 'declined';
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
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<ExpandedRequests>({});
  const [reschedulingRequestId, setReschedulingRequestId] = useState<number | null>(null);
  const [newAvailability1, setNewAvailability1] = useState<Date | null>(null);
  const [newAvailability2, setNewAvailability2] = useState<Date | null>(null);
  const [confirmingRequestId, setConfirmingRequestId] = useState<number | null>(null);
  const navigate = useNavigate();
  const customerId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Customer';
  const prevRequests = useRef<Request[]>([]);
  const prevProposals = useRef<Proposal[]>([]);

  const updateAudio = new Audio('/sounds/customer update.mp3');
  let hasPlayed = false;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [requestsResponse, proposalsResponse] = await Promise.all([
        fetch(`${API_URL}/api/requests/customer/${customerId}`),
        fetch(`${API_URL}/api/requests/pending-proposals/${customerId}`)
      ]);
      if (!requestsResponse.ok) throw new Error(`Requests HTTP error! Status: ${requestsResponse.status}`);
      if (!proposalsResponse.ok) throw new Error(`Proposals HTTP error! Status: ${proposalsResponse.status}`);
      const requestsData: Request[] = await requestsResponse.json();
      const proposalsData: Proposal[] = await proposalsResponse.json();

      // Delta updates: only update changed fields
      const updatedRequests = requests.map(req => {
        const newReq = requestsData.find(r => r.id === req.id);
        if (!newReq || deepEqual(newReq, req)) return req;
        return { ...newReq, lastUpdated: Date.now() };
      });
      requestsData.forEach(newReq => {
        if (!updatedRequests.find(r => r.id === newReq.id)) {
          updatedRequests.push({ ...newReq, lastUpdated: Date.now() });
        }
      });

      const updatedProposals = proposals.map(prop => {
        const newProp = proposalsData.find(p => p.id === prop.id);
        if (!newProp || deepEqual(newProp, prop)) return prop;
        return newProp;
      });
      proposalsData.forEach(newProp => {
        if (!updatedProposals.find(p => p.id === newProp.id)) {
          updatedProposals.push(newProp);
        }
      });

      // Only update state if data has changed
      if (!deepEqual(updatedRequests, prevRequests.current)) {
        setRequests(updatedRequests);
        prevRequests.current = updatedRequests;
      }
      if (!deepEqual(updatedProposals, prevProposals.current)) {
        setProposals(updatedProposals);
        prevProposals.current = updatedProposals;
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      setMessage({ text: `Error fetching data: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
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
        if (!data.email) throw new Error('Invalid session');
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Session validation failed:', error);
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        navigate('/login');
      }
    };

    const connectWebSocket = () => {
      const client = new W3CWebSocket(WS_URL);
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 15;
      const BASE_RECONNECT_INTERVAL = 10000; // 10s
      let reconnectDelay = BASE_RECONNECT_INTERVAL;

      client.onopen = () => {
        console.log(`WebSocket Connected to ${WS_URL}`);
        reconnectAttempts = 0;
        reconnectDelay = BASE_RECONNECT_INTERVAL;
        setMessage({ text: 'WebSocket connected successfully.', type: 'success' });
        setTimeout(() => {
          if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'subscribe', customerId }));
            console.log('Subscription sent:', { type: 'subscribe', customerId });
          }
        }, 1000);
        const pingInterval = setInterval(() => {
          if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'ping' }));
            console.log('Ping sent');
          }
        }, 30000);
        client.onclose = (event) => {
          console.log('WebSocket Disconnected, code:', event.code, 'reason:', event.reason || 'No reason provided');
          clearInterval(pingInterval);
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            reconnectDelay = Math.min(reconnectDelay * 2, 60000);
            console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${reconnectDelay / 1000} seconds...`);
            setMessage({ text: `WebSocket disconnected (code: ${event.code}). Retrying (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, type: 'error' });
            setTimeout(() => {
              if (client) client.close();
              connectWebSocket();
            }, reconnectDelay);
          } else {
            setMessage({ text: `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Please check the server at ${WS_URL}.`, type: 'error' });
          }
        };
      };

      client.onmessage = (message) => {
        console.log('WebSocket Message Received:', message.data);
        try {
          const data = JSON.parse(message.data as string) as WebSocketMessage;
          if (data.type === 'pong') {
            console.log('Pong received');
            return;
          }
          if (data.type === 'update' && data.requestId !== undefined) {
            setRequests(prev => {
              const exists = prev.find(req => req.id === data.requestId);
              if (!exists) return prev;
              const updatedRequest: Request = {
                ...exists,
                status: data.status || exists.status,
                technician_id: data.technician_id !== undefined ? data.technician_id : exists.technician_id,
                technician_name: data.technician_name || exists.technician_name,
                technician_scheduled_time: data.technician_scheduled_time || exists.technician_scheduled_time,
                customer_availability_1: data.customer_availability_1 || exists.customer_availability_1,
                customer_availability_2: data.customer_availability_2 || exists.customer_availability_2,
                repair_description: data.repair_description || exists.repair_description,
                created_at: data.created_at || exists.created_at,
                customer_name: data.customer_name || exists.customer_name,
                customer_address: data.customer_address || exists.customer_address,
                customer_city: data.customer_city || exists.customer_city,
                customer_postal_code: data.customer_postal_code || exists.customer_postal_code,
                technician_note: data.technician_note || exists.technician_note,
                lastUpdated: Date.now(),
              };
              const newRequests = prev.map(req => req.id === data.requestId ? updatedRequest : req);
              if (!deepEqual(newRequests, prevRequests.current) && !hasPlayed) {
                updateAudio.play().catch(err => {
                  console.error('Audio play failed:', err);
                  setMessage({ text: 'Audio notification failed. Ensure /public/sounds/customer update.mp3 exists.', type: 'error' });
                });
                hasPlayed = true;
                setTimeout(() => { hasPlayed = false; }, 1000);
              }
              prevRequests.current = newRequests;
              return newRequests;
            });
            fetchData(); // Ensure consistency
          } else if (data.type === 'proposal' && data.requestId !== undefined && data.proposed_time !== undefined && data.technician_id !== undefined && data.technician_id !== null) {
            setProposals(prev => {
              if (data.requestId === undefined || data.technician_id === undefined || data.technician_id === null || data.proposed_time === undefined) return prev;
              const exists = prev.find(p => p.request_id === data.requestId && p.status === 'pending');
              if (exists) return prev;
              const newProposal: Proposal = {
                id: Date.now(), // Temporary ID, updated by fetchData
                request_id: data.requestId,
                technician_id: data.technician_id,
                technician_name: data.technician_name || 'Unknown',
                proposed_time: data.proposed_time,
                status: 'pending',
                created_at: moment.tz('Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss'),
              };
              const newProposals = [...prev, newProposal];
              if (!deepEqual(newProposals, prevProposals.current) && !hasPlayed) {
                updateAudio.play().catch(err => {
                  console.error('Audio play failed:', err);
                  setMessage({ text: 'Audio notification failed. Ensure /public/sounds/customer update.mp3 exists.', type: 'error' });
                });
                hasPlayed = true;
                setTimeout(() => { hasPlayed = false; }, 1000);
              }
              prevProposals.current = newProposals;
              return newProposals;
            });
            fetchData();
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('WebSocket message parse error:', error);
          setMessage({ text: 'Invalid WebSocket message received.', type: 'error' });
        }
      };

      client.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setMessage({ text: `WebSocket error: ${error.toString()}. Check server at ${WS_URL}.`, type: 'error' });
      };

      return client;
    };

    validateSession();
    const wsClient = connectWebSocket();
    fetchData();
    const intervalId = setInterval(fetchData, 20000); // Update every 20 seconds

    return () => {
      if (wsClient) wsClient.close();
      clearInterval(intervalId);
    };
  }, [customerId, role, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    setMessage({ text: 'Logged out successfully!', type: 'success' });
    setTimeout(() => navigate('/login'), 1000);
  };

  const handleReschedule = (requestId: number) => {
    setReschedulingRequestId(requestId);
    setNewAvailability1(null);
    setNewAvailability2(null);
    setMessage({ text: 'Select new availability times.', type: 'info' });
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingRequestId || !newAvailability1 || !customerId) return;
    try {
      const availability1 = moment.tz(newAvailability1, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
      const availability2 = newAvailability2 ? moment.tz(newAvailability2, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss') : null;
      const response = await fetch(`${API_URL}/api/requests/reschedule/${reschedulingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, availability_1: availability1, availability_2: availability2 }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Request rescheduled successfully!', type: 'success' });
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

  const handleConfirmCompletion: MouseEventHandler<HTMLButtonElement> = async (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    if (!customerId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/confirm-completion/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Completion confirmed! Payment captured.', type: 'success' });
        setConfirmingRequestId(null);
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

  const handleCancelRequest: MouseEventHandler<HTMLButtonElement> = async (event) => {
    const requestId = parseInt(event.currentTarget.getAttribute('data-id') || '');
    if (!customerId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
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

  const handleProposalResponse: MouseEventHandler<HTMLButtonElement> = async (event) => {
    const proposalId = parseInt(event.currentTarget.getAttribute('data-proposal-id') || '');
    const requestId = parseInt(event.currentTarget.getAttribute('data-request-id') || '');
    const action = event.currentTarget.getAttribute('data-action') as 'approve' | 'decline';
    if (!customerId) return;
    try {
      const response = await fetch(`${API_URL}/api/requests/confirm-proposal/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, proposalId, action }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: `Proposal ${action}d successfully!`, type: 'success' });
        if (!hasPlayed) {
          updateAudio.play().catch(err => {
            console.error('Audio play failed:', err);
            setMessage({ text: 'Audio notification failed. Ensure /public/sounds/customer update.mp3 exists.', type: 'error' });
          });
          hasPlayed = true;
          setTimeout(() => { hasPlayed = false; }, 1000);
        }
        fetchData();
      } else {
        setMessage({ text: `Failed to ${action} proposal: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`Error ${action}ing proposal:`, error);
      setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
    }
  };

  const toggleExpand = (requestId: number) => {
    setExpandedRequests(prev => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Not specified';
    return moment.tz(dateStr, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
  };

  const DESCRIPTION_LIMIT = 100;

  const activeRequests = requests.filter(req => req.status !== 'completed' && req.status !== 'cancelled');
  const completedRequests = requests.filter(req => req.status === 'completed');
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 text-center">Welcome, {userName}</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/request-technician')}
                className="bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Request a Technician
              </button>
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
          {isLoading ? (
            <p className="text-center text-gray-600">Loading requests...</p>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Pending Proposals</h3>
              {pendingProposals.length === 0 ? (
                <p className="text-gray-600 text-center mb-6">No pending proposals.</p>
              ) : (
                <div className="space-y-4 mb-8">
                  {pendingProposals.map(proposal => {
                    const request = requests.find(req => req.id === proposal.request_id);
                    if (!request) return null;
                    const isExpanded = expandedRequests[request.id] || false;
                    const isLong = request.repair_description.length > DESCRIPTION_LIMIT;
                    const displayDescription = isExpanded || !isLong
                      ? request.repair_description
                      : `${request.repair_description.slice(0, DESCRIPTION_LIMIT)}...`;
                    const isRecentlyUpdated = request.lastUpdated && (Date.now() - request.lastUpdated) < 2000;
                    return (
                      <div
                        key={proposal.id}
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
                        <p><strong>Proposed by:</strong> {proposal.technician_name}</p>
                        <p><strong>Proposed Time:</strong> {formatDateTime(proposal.proposed_time)}</p>
                        <p><strong>Created At:</strong> {formatDateTime(proposal.created_at)}</p>
                        <div className="mt-2 space-x-2">
                          <button
                            data-proposal-id={proposal.id}
                            data-request-id={proposal.request_id}
                            data-action="approve"
                            onClick={handleProposalResponse}
                            className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            data-proposal-id={proposal.id}
                            data-request-id={proposal.request_id}
                            data-action="decline"
                            onClick={handleProposalResponse}
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Active Service Requests</h3>
              {activeRequests.length === 0 ? (
                <p className="text-gray-600 text-center mb-6">No active service requests.</p>
              ) : (
                <div className="space-y-4 mb-8">
                  {activeRequests.map(request => {
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
                        {request.technician_name && (
                          <p><strong>Technician:</strong> {request.technician_name}</p>
                        )}
                        {request.technician_note && (
                          <p><strong>Technician Note:</strong> {request.technician_note}</p>
                        )}
                        <p><strong>Region:</strong> {request.region}</p>
                        <div className="mt-2 space-x-2">
                          {(request.status === 'pending' || request.status === 'assigned') && (
                            <>
                              <button
                                onClick={() => handleReschedule(request.id)}
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
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Completed Service Requests</h3>
              {completedRequests.length === 0 ? (
                <p className="text-gray-600 text-center mb-6">No completed service requests.</p>
              ) : (
                <div className="space-y-4">
                  {completedRequests.map(request => {
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
                        {request.technician_name && (
                          <p><strong>Technician:</strong> {request.technician_name}</p>
                        )}
                        {request.technician_note && (
                          <p><strong>Technician Note:</strong> {request.technician_note}</p>
                        )}
                        <p><strong>Region:</strong> {request.region}</p>
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