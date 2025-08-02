/**
 * CustomerDashboard.tsx - Version V1.6
 * - Displays customer service requests in pre-populated tabs, similar to CustomerEditProfile.tsx.
 * - Pre-fetches repair_description (labeled as Job Description) from Customer_Request via POST /api/requests/prefetch, falls back to GET /api/requests/customer/:customerId.
 * - Shows "No service requests found" if no active requests.
 * - Highlights new requests with blue border and text wrapping.
 * - Includes "Log a Problem for Tech Assistance" and "Edit Profile" buttons.
 * - Uses logo from public_html/Tap4Service Logo 1.png.
 * - Uses date-fns for date handling.
 * - Enhanced error handling with ErrorBoundary.
 * - Fixed TypeScript error 2349: corrected string call signatures and template literals.
 */
import React, { useEffect, useState, Component } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Box, Button, Card, CardContent, Typography, Container, Tabs, Tab } from '@mui/material';
import { FaSignOutAlt, FaPlus, FaUser } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface Request {
  id: number;
  repair_description: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in CustomerDashboard:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-red-500 p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please try refreshing the page or contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline">
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4 flex space-x-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRequestId, setNewRequestId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);
  const userName = localStorage.getItem('userName') || 'Customer';
  const role = localStorage.getItem('role') || '';

  useEffect(() => {
    console.log(`Component mounted, customerId: ${customerId}, role: ${role}`);

    if (role !== 'customer' || !customerId) {
      console.error('Unauthorized access attempt');
      navigate('/customer-login');
      return;
    }

    const fetchRequests = async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/api/requests`;
        console.log(`Pre-fetching requests from: ${url}/prefetch`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: 'prefetch' })
        });
        const textData = await response.text();
        console.log(`API response status: ${response.status}, Response: ${textData}`);

        if (!response.ok) {
          let data;
          try {
            data = JSON.parse(textData);
          } catch {
            throw new Error('Invalid server response format');
          }
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${data.error || 'Unknown error'}`);
        }

        const data = JSON.parse(textData);
        setRequests(data.requests || []);
        setError(null);
      } catch (err: any) {
        console.error(`Error fetching data: ${err.message}`);
        setError(err.message);
        // Fallback to GET endpoint
        try {
          console.log(`Falling back to GET: ${API_URL}/api/requests/customer/${customerId}`);
          const fallbackResponse = await fetch(`${API_URL}/api/requests/customer/${customerId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });
          const fallbackData = await fallbackResponse.json();
          console.log('Fallback API response:', fallbackData);

          if (!fallbackResponse.ok) {
            throw new Error(`Fallback HTTP error! Status: ${fallbackResponse.status}, Message: ${fallbackData.error || 'Unknown error'}`);
          }

          setRequests(fallbackData.requests || []);
          setError(null);
        } catch (fallbackErr: any) {
          console.error(`Fallback error: ${fallbackErr.message}`);
          setError(fallbackErr.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();

    // Check for new request
    const newRequest = localStorage.getItem('newRequestId');
    if (newRequest) {
      setNewRequestId(parseInt(newRequest, 10));
      localStorage.removeItem('newRequestId');
    }
  }, [navigate, customerId, role]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    navigate('/customer-login');
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="md" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Welcome, {userName}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, gap: 2 }}>
          <Button
            variant="contained"
            component={Link}
            to="/log-technical-callout"
            sx={{
              background: 'linear-gradient(to right, #3b82f6, #1e40af)',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '24px',
              padding: '12px 24px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)',
                '&::before': { left: '100%' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2))',
                transform: 'skewX(-12deg)',
                transition: 'left 0.3s'
              }
            }}
          >
            <FaPlus style={{ marginRight: '8px' }} />
            Log a Problem for Tech Assistance
          </Button>
          <Button
            variant="contained"
            component={Link}
            to="/edit-profile"
            sx={{
              background: 'linear-gradient(to right, #3b82f6, #1e40af)',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '24px',
              padding: '12px 24px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)',
                '&::before': { left: '100%' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2))',
                transform: 'skewX(-12deg)',
                transition: 'left 0.3s'
              }
            }}
          >
            <FaUser style={{ marginRight: '8px' }} />
            Edit Profile
          </Button>
          <Button
            variant="contained"
            onClick={handleLogout}
            sx={{
              background: 'linear-gradient(to right, #3b82f6, #1e40af)',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '24px',
              padding: '12px 24px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)',
                '&::before': { left: '100%' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2))',
                transform: 'skewX(-12deg)',
                transition: 'left 0.3s'
              }
            }}
          >
            <FaSignOutAlt style={{ marginRight: '8px' }} />
            Logout
          </Button>
        </Box>

        {loading && (
          <Typography sx={{ textAlign: 'center', color: '#d1d5db' }}>
            Loading...
          </Typography>
        )}

        {error && (
          <Typography color="error" sx={{ mb: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}

        {!loading && !error && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#d1d5db' }}>
              Your Service Requests
            </Typography>
            {requests.length === 0 ? (
              <Card sx={{ backgroundColor: '#1f2937', color: '#ffffff', p: 2, borderRadius: '12px' }}>
                <CardContent>
                  <Typography>No service requests found</Typography>
                </CardContent>
              </Card>
            ) : (
              <Box>
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  sx={{
                    mb: 2,
                    '& .MuiTab-root': { color: '#d1d5db' },
                    '& .Mui-selected': { color: '#3b82f6' },
                    '& .MuiTabs-indicator': { backgroundColor: '#3b82f6' }
                  }}
                >
                  {requests.map((request) => (
                    <Tab key={request.id} label={`Request ${request.id}`} />
                  ))}
                </Tabs>
                {requests.map((request, index) => (
                  <Box key={request.id} sx={{ display: activeTab === index ? 'block' : 'none' }}>
                    <Card
                      sx={{
                        backgroundColor: '#1f2937',
                        color: '#ffffff',
                        p: 2,
                        borderRadius: '12px',
                        border: newRequestId === request.id ? '2px solid #3b82f6' : 'none'
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                          Job Description
                        </Typography>
                        <Typography sx={{ wordBreak: 'break-word' }}>{request.repair_description}</Typography>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default CustomerDashboard;