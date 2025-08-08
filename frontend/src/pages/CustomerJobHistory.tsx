/**
 * CustomerJobHistory.tsx - Version V1.0
 * - Located in /frontend/src/pages/
 * - Fetches and displays job history for a customer via GET /api/customer_request.php?path=requests.
 * - Displays fields: id, repair_description, created_at, status, customer_availability_1, customer_availability_2, region, system_types, technician_name, technician_email, technician_phone, technician_note.
 * - Styled with dark gradient background, gray card, blue gradient buttons, white text.
 * - Added error handling for fetch failures.
 * - Fixed job history fetch by including customerId in request URL in V1.0.
 */
import { useState, useEffect, Component, type ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { Box, Button, Card, CardContent, Typography, Container } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FaArrowLeft } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface Request {
  id: number;
  repair_description: string | null;
  created_at: string | null;
  status: 'pending' | 'assigned' | 'completed_technician' | 'completed' | 'cancelled';
  customer_availability_1: string | null;
  customer_availability_2: string | null;
  region: string | null;
  system_types: string[];
  technician_id: number | null;
  technician_name: string | null;
  technician_email: string | null;
  technician_phone: string | null;
  customer_id: number | null;
  technician_note: string | null;
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
    console.error('Error in CustomerJobHistory:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ffffff] p-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#ffffff' }}>Something went wrong</h2>
          <p style={{ color: '#ffffff' }}>
            Please try refreshing the page or contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline" style={{ color: '#3b82f6' }}>
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4 flex space-x-2 justify-center">
            <Button
              onClick={() => window.location.reload()}
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CustomerJobHistory: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);

  const fetchData = async () => {
    if (!customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    try {
      console.log(`Fetching job history for customerId: ${customerId}`);
      const response = await fetch(`${API_URL}/api/customer_request.php?path=requests&customerId=${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fetch failed:', { status: response.status, response: errorText });
        throw new Error(`HTTP error! Status: ${response.status} Response: ${errorText}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const sanitizedRequests = Array.isArray(data.requests)
        ? data.requests
            .map((req: Request) => ({
              ...req,
              system_types: Array.isArray(req.system_types) ? req.system_types : JSON.parse(req.system_types || '[]'),
            }))
            .sort((a: Request, b: Request) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
        : [];
      console.log('Sanitized requests:', sanitizedRequests);
      setRequests(sanitizedRequests);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching job history:', error);
      setMessage({ text: error.message || 'Failed to fetch job history.', type: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate, customerId]);

  return (
    <ErrorBoundary>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Container maxWidth="lg" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', mb: 2 }}>
              Job History
            </Typography>
          </Box>

          {message.text && (
            <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/customer-dashboard')}
              sx={{
                color: '#ffffff',
                borderColor: '#ffffff',
                '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' }
              }}
            >
              <FaArrowLeft style={{ marginRight: '8px' }} />
              Back to Dashboard
            </Button>
          </Box>

          <Typography variant="h5" sx={{ color: '#ffffff', mb: 2, fontWeight: 'bold', textAlign: 'center' }}>
            Your Past Service Requests
          </Typography>

          {requests.length === 0 ? (
            <Typography sx={{ color: '#ffffff', textAlign: 'center' }}>
              No service requests found.
            </Typography>
          ) : (
            <>
              {requests.map((request) => (
                <Card key={request.id} sx={{ mb: 2, backgroundColor: '#374151', color: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' }}>
                  <CardContent>
                    <Typography sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      Request #{request.id} - {request.status}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography sx={{ color: '#ffffff' }}><strong>Description:</strong> {request.repair_description || 'Not specified'}</Typography>
                      <Typography sx={{ color: '#ffffff' }}><strong>Created:</strong> {request.created_at ? formatInTimeZone(new Date(request.created_at), 'Pacific/Auckland', 'yyyy-MM-dd HH:mm:ss') : 'Not specified'}</Typography>
                      <Typography sx={{ color: '#ffffff' }}><strong>Availability 1:</strong> {request.customer_availability_1 || 'Not specified'}</Typography>
                      <Typography sx={{ color: '#ffffff' }}><strong>Availability 2:</strong> {request.customer_availability_2 || 'Not specified'}</Typography>
                      <Typography sx={{ color: '#ffffff' }}><strong>Region:</strong> {request.region || 'Not specified'}</Typography>
                      <Typography sx={{ color: '#ffffff' }}><strong>System Types:</strong> {request.system_types.join(', ') || 'Not specified'}</Typography>
                      {request.technician_name && (
                        <Typography sx={{ color: '#ffffff' }}><strong>Technician:</strong> {request.technician_name}</Typography>
                      )}
                      {request.technician_email ? (
                        <Typography sx={{ color: '#ffffff' }}>
                          <strong>Technician Email:</strong>{' '}
                          <a href={`mailto:${request.technician_email}`} style={{ color: '#3b82f6' }}>{request.technician_email}</a>
                        </Typography>
                      ) : (
                        <Typography sx={{ color: '#ffffff' }}><strong>Technician Email:</strong> Not specified</Typography>
                      )}
                      {request.technician_phone ? (
                        <Typography sx={{ color: '#ffffff' }}>
                          <strong>Technician Phone:</strong>{' '}
                          <a href={`tel:${request.technician_phone}`} style={{ color: '#3b82f6' }}>{request.technician_phone}</a>
                        </Typography>
                      ) : (
                        <Typography sx={{ color: '#ffffff' }}><strong>Technician Phone:</strong> Not specified</Typography>
                      )}
                      <Typography sx={{ color: '#ffffff' }}><strong>Technician Note:</strong> {request.technician_note || 'Not specified'}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </Container>
      </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default CustomerJobHistory;