/**
 * TechnicianDashboard.tsx - Version V5.316
 * - Fixes TypeScript error: prevStatuses undefined (2304).
 * - Retains fixes: requestId type (2322).
 * - Updates every 20 seconds, only if data differs (using deep-equal).
 * - Adds visual feedback (highlight updated jobs) and delta updates (field-level changes).
 * - Never logs out unless Logout is selected.
 * - Auto-updates in real-time for new jobs and status changes via WebSocket.
 * - Plays technician update.mp3 on updates.
 * - Includes all job details in WebSocket updates (Repair Description, Customer, Address, etc.).
 * - Hides Availability 1/2 when status is assigned/completed.
 * - Filters Available Jobs by technician's regions.
 * - Supports rescheduling with technician declination.
 * - Displays service_requests and pending_proposals details.
 * - Uses DD/MM/YYYY HH:MM:SS in Pacific/Auckland.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo, MouseEventHandler } from 'react';
import { useNavigate } from 'react-router-dom';
import { w3cwebsocket as W3CWebSocket } from 'websocket';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import moment from 'moment-timezone';
import deepEqual from 'deep-equal';

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
  lastUpdated?: number; // For visual feedback
}

interface ExpandedRequests {
  [key: number]: boolean;
}

interface ApiResponse {
  error?: string;
}

interface WebSocketMessage {
  type: 'update' | 'new_job' | 'ping' | 'pong' | 'proposal';
  requestId?: number;
  status?: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
  technician_scheduled_time?: string | null;
  customer_availability_1?: string | null;
  customer_availability_2?: string | null;
  technician_id?: number | null;
  repair_description?: string;
  created_at?: string;
  customer_name?: string;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_postal_code?: string | null;
  technician_note?: string | null;
  proposed_time?: string;
  proposal_status?: 'approved' | 'declined';
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
  const navigate = useNavigate();
  const technicianId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Technician';
  const prevAssignedRequests = useRef<Request[]>([]);
  const prevAvailableRequests = useRef<Request[]>([]);
  const prevStatuses = useRef<Map<number, string | null>>(new Map());
  const prevScheduledTimes = useRef<Map<number, string | null>>(new Map());

  const newJobAudio = new Audio('/sounds/technician update.mp3');
  let hasPlayed = false;

  const fetchTechnicianProfile = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/technician/profile/${technicianId}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: TechnicianProfile = await response.json();
      setTechnicianRegions(data.regions || []);
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
      const [assignedResponse, availableResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/requests/technician/${technicianId}`),
        fetch(`http://localhost:5000/api/requests/available?technicianId=${technicianId}`)
      ]);
      if (!assignedResponse.ok) throw new Error(`Assigned requests HTTP error! Status: ${assignedResponse.status}`);
      if (!availableResponse.ok) throw new Error(`Available requests HTTP error! Status: ${availableResponse.status}`);
      const assignedData: Request[] = await assignedResponse.json();
      const availableData: Request[] = await availableResponse.json();

      // Delta updates: only update changed fields
      const updatedAssigned = assignedRequests.map(req => {
        const newReq = assignedData.find(r => r.id === req.id);
        if (!newReq || deepEqual(newReq, req)) return req;
        return { ...newReq, lastUpdated: Date.now() };
      });
      assignedData.forEach(newReq => {
        if (!updatedAssigned.find(r => r.id === newReq.id)) {
          updatedAssigned.push({ ...newReq, lastUpdated: Date.now() });
        }
      });

      const filteredAvailable = Array.from(
        new Map(availableData
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

      // Only update state if data has changed
      if (!deepEqual(updatedAssigned, prevAssignedRequests.current)) {
        setAssignedRequests(updatedAssigned);
        prevAssignedRequests.current = updatedAssigned;
      }
      if (!deepEqual(updatedAvailable, prevAvailableRequests.current)) {
        setAvailableRequests(updatedAvailable);
        prevAvailableRequests.current = updatedAvailable;
      }

      // Update prevStatuses and prevScheduledTimes
      [...assignedData, ...filteredAvailable].forEach(req => {
        prevStatuses.current.set(req.id, req.status);
        prevScheduledTimes.current.set(req.id, req.technician_scheduled_time);
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching data:', error);
      setMessage({ text: `Error fetching data: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!technicianId || role !== 'technician') {
      setMessage({ text: 'Please log in as a technician to view your dashboard.', type: 'error' });
      navigate('/login');
      return;
    }

    const validateSession = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/technicians/${technicianId}`);
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
      const client = new W3CWebSocket('ws://localhost:5000');
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 15;
      const BASE_RECONNECT_INTERVAL = 10000; // 10s
      let reconnectDelay = BASE_RECONNECT_INTERVAL;

      client.onopen = () => {
        console.log('WebSocket Connected to ws://localhost:5000');
        reconnectAttempts = 0;
        reconnectDelay = BASE_RECONNECT_INTERVAL;
        setMessage({ text: 'WebSocket connected successfully.', type: 'success' });
        setTimeout(() => {
          if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'subscribe', technicianId }));
            console.log('Subscription sent:', { type: 'subscribe', technicianId });
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
            setMessage({ text: `WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'}). Retrying (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, type: 'error' });
            setTimeout(() => {
              if (client) client.close();
              connectWebSocket();
            }, reconnectDelay);
          } else {
            setMessage({ text: `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Please check the server at ws://localhost:5000.`, type: 'error' });
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
            setAssignedRequests(prev => {
              if (data.status === 'pending' && !data.technician_scheduled_time && data.technician_id === null) {
                if (prev.find(req => req.id === data.requestId)) {
                  setMessage({ text: 'Job rescheduled by customer. Assignment declined.', type: 'info' });
                  if (!hasPlayed) {
                    newJobAudio.play().catch(err => {
                      console.error('Audio play failed:', err);
                      setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
                    });
                    hasPlayed = true;
                    setTimeout(() => { hasPlayed = false; }, 1000);
                  }
                }
                const newAssigned = prev.filter(req => req.id !== data.requestId);
                if (!deepEqual(newAssigned, prevAssignedRequests.current)) {
                  prevAssignedRequests.current = newAssigned;
                  return newAssigned;
                }
                return prev;
              }
              const exists = prev.find(req => req.id === data.requestId);
              if (!exists) return prev;
              const updatedRequest: Request = {
                ...exists,
                status: data.status || exists.status,
                technician_id: data.technician_id !== undefined ? data.technician_id : exists.technician_id,
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
              const newAssigned = prev.map(req => req.id === data.requestId ? updatedRequest : req);
              if (!deepEqual(newAssigned, prevAssignedRequests.current)) {
                prevAssignedRequests.current = newAssigned;
                return newAssigned;
              }
              return prev;
            });
            setAvailableRequests(prev => {
              if (data.status !== 'pending' || data.technician_scheduled_time || data.technician_id) {
                const newAvailable = prev.filter(req => req.id !== data.requestId);
                if (!deepEqual(newAvailable, prevAvailableRequests.current)) {
                  prevAvailableRequests.current = newAvailable;
                  return newAvailable;
                }
                return prev;
              }
              const exists = prev.find(req => req.id === data.requestId);
              const updatedRequest: Request = {
                id: data.requestId,
                repair_description: data.repair_description || exists?.repair_description || 'Update received',
                created_at: data.created_at || exists?.created_at || moment.tz('Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss'),
                status: data.status || 'pending',
                customer_name: data.customer_name || exists?.customer_name || 'Unknown',
                customer_address: data.customer_address || exists?.customer_address || null,
                customer_city: data.customer_city || exists?.customer_city || null,
                customer_postal_code: data.customer_postal_code || exists?.customer_postal_code || null,
                technician_note: data.technician_note || exists?.technician_note || null,
                customer_availability_1: data.customer_availability_1 || exists?.customer_availability_1 || null,
                customer_availability_2: data.customer_availability_2 || exists?.customer_availability_2 || null,
                technician_scheduled_time: data.technician_scheduled_time || null,
                technician_id: data.technician_id || null,
                lastUpdated: Date.now(),
              };
              let newAvailable;
              if (exists && updatedRequest.customer_city && technicianRegions.includes(updatedRequest.customer_city)) {
                newAvailable = prev.map(req => req.id === data.requestId ? updatedRequest : req);
              } else if (!exists && updatedRequest.customer_city && technicianRegions.includes(updatedRequest.customer_city)) {
                newAvailable = [...prev, updatedRequest];
              } else {
                return prev;
              }
              if (!deepEqual(newAvailable, prevAvailableRequests.current)) {
                prevAvailableRequests.current = newAvailable;
                return newAvailable;
              }
              return prev;
            });
            const currentRequest = assignedRequests.find(req => req.id === data.requestId) || availableRequests.find(req => req.id === data.requestId);
            if (currentRequest && (prevStatuses.current.get(data.requestId) !== data.status || prevScheduledTimes.current.get(data.requestId) !== data.technician_scheduled_time) && !hasPlayed) {
              newJobAudio.play().catch(err => {
                console.error('Audio play failed:', err);
                setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
              });
              hasPlayed = true;
              setTimeout(() => { hasPlayed = false; }, 1000);
              fetchData();
            }
            prevStatuses.current.set(data.requestId, data.status || currentRequest?.status || 'pending');
            prevScheduledTimes.current.set(data.requestId, data.technician_scheduled_time || currentRequest?.technician_scheduled_time || null);
          } else if (data.type === 'new_job' && data.requestId !== undefined) {
            const newRequest: Request = {
              id: data.requestId,
              repair_description: data.repair_description || 'New job registered',
              created_at: data.created_at || moment.tz('Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss'),
              status: data.status || 'pending',
              customer_name: data.customer_name || 'Unknown',
              customer_address: data.customer_address || null,
              customer_city: data.customer_city || null,
              customer_postal_code: data.customer_postal_code || null,
              technician_note: data.technician_note || null,
              customer_availability_1: data.customer_availability_1 || null,
              customer_availability_2: data.customer_availability_2 || null,
              technician_scheduled_time: data.technician_scheduled_time || null,
              technician_id: data.technician_id || null,
              lastUpdated: Date.now(),
            };
            setAvailableRequests(prev => {
              if (prev.find(req => req.id === newRequest.id) || !newRequest.customer_city || !technicianRegions.includes(newRequest.customer_city)) {
                return prev;
              }
              if (!hasPlayed) {
                newJobAudio.play().catch(err => {
                  console.error('Audio play failed:', err);
                  setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
                });
                hasPlayed = true;
                setTimeout(() => { hasPlayed = false; }, 1000);
              }
              setMessage({ text: `New job available in ${newRequest.customer_city}!`, type: 'success' });
              const newAvailable = [...prev, newRequest];
              prevAvailableRequests.current = newAvailable;
              return newAvailable;
            });
            prevStatuses.current.set(newRequest.id, newRequest.status);
            prevScheduledTimes.current.set(newRequest.id, newRequest.technician_scheduled_time);
          } else if (data.type === 'proposal' && data.requestId !== undefined && data.proposal_status) {
            if (data.proposal_status === 'approved') {
              setMessage({ text: 'Customer approved your proposed time!', type: 'success' });
              fetchData();
            } else if (data.proposal_status === 'declined') {
              setMessage({ text: 'Customer declined your proposed time. Job returned to available jobs.', type: 'info' });
              setAssignedRequests(prev => {
                const newAssigned = prev.filter(req => req.id !== data.requestId);
                prevAssignedRequests.current = newAssigned;
                return newAssigned;
              });
              fetchData();
            }
            if (!hasPlayed) {
              newJobAudio.play().catch(err => {
                console.error('Audio play failed:', err);
                setMessage({ text: 'Audio notification failed. Ensure /public/sounds/technician update.mp3 exists.', type: 'error' });
              });
              hasPlayed = true;
              setTimeout(() => { hasPlayed = false; }, 1000);
            }
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('WebSocket message parse error:', error);
          setMessage({ text: 'Invalid WebSocket message received.', type: 'error' });
        }
      };

      client.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setMessage({ text: `WebSocket error: ${error.toString()}. Check server at ws://localhost:5000.`, type: 'error' });
      };

      return client;
    };

    validateSession();
    fetchTechnicianProfile().then(fetchData);
    const wsClient = connectWebSocket();
    const intervalId = setInterval(fetchData, 20000); // Update every 20 seconds

    return () => {
      if (wsClient) wsClient.close();
      clearInterval(intervalId);
    };
  }, [technicianId, role, navigate]);

  const handleSelectJob = (requestId: number) => {
    setSelectedRequestId(requestId);
    setSelectedAvailability(null);
    setMessage({ text: 'Select an availability time to accept the job.', type: 'info' });
  };

  const handleConfirmJob = async () => {
    if (!selectedRequestId || !technicianId || !selectedAvailability) return;
    try {
      const response = await fetch(`http://localhost:5000/api/requests/assign/${selectedRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), scheduledTime: moment.tz(selectedAvailability, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss') }),
      });
      const data: { message?: string; error?: string } = await response.json();
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
      const proposedDate = moment.tz(proposedTime, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
      const response = await fetch(`http://localhost:5000/api/requests/propose/${proposingRequestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: parseInt(technicianId),
          proposedTime: proposedDate,
        }),
      });
      const data: { message?: string; error?: string } = await response.json();
      if (response.ok) {
        setMessage({ text: 'Alternative time proposed, awaiting customer confirmation.', type: 'success' });
        if (!hasPlayed) {
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
      const response = await fetch(`http://localhost:5000/api/requests/complete-technician/${completingRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId), note: completionNote || null }),
      });
      const data: { message?: string; error?: string } = await response.json();
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
      const response = await fetch(`http://localhost:5000/api/requests/unassign/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: parseInt(technicianId) }),
      });
      const data: { message?: string; error?: string } = await response.json();
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
      const response = await fetch(`http://localhost:5000/api/requests/respond/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: parseInt(technicianId),
          action,
        }),
      });
      const data: { message?: string; error?: string } = await response.json();
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

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    setMessage({ text: 'Logged out successfully!', type: 'success' });
    setTimeout(() => navigate('/login'), 1000);
  };

  const toggleExpand = (requestId: number) => {
    setExpandedRequests(prev => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">7</div>
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