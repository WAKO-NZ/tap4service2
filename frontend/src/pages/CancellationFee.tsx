/**
 * CancellationFee.tsx - Version V1.0
 * - Located in /frontend/src/pages/
 * - Displays a warning about a $45.00 cancellation fee for canceling a job.
 * - Provides details about the cancellation policy and reasons for the fee.
 * - Includes Confirm Cancellation and Back buttons.
 * - Sends DELETE /api/requests/{requestId} on confirmation.
 * - Styled with dark gradient background, white text, and blue/red gradient buttons.
 * - Uses ErrorBoundary for error handling.
 */
import { useState, useEffect, Component, type ErrorInfo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Typography, Container } from '@mui/material';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error in CancellationFee:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ffffff] p-8" style={{ color: '#ffffff' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#ffffff' }}>Something went wrong</h2>
          <p style={{ color: '#ffffff' }}>{this.state.errorMessage}</p>
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

const CancellationFee: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = new URLSearchParams(location.search).get('requestId');
  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);

  useEffect(() => {
    if (!requestId || !customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      setError('Invalid request or not logged in as a customer.');
      navigate('/customer-login');
    }
  }, [requestId, customerId, navigate]);

  const handleConfirmCancellation = async () => {
    if (!requestId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setError(null);
        navigate('/customer-dashboard', { state: { message: 'Request cancelled successfully. A $45.00 cancellation fee will be processed.' } });
      } else {
        setError(`Error cancelling request: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      setError('Error cancelling request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/customer-dashboard');
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="md" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Cancellation Fee Notice
          </Typography>
        </Box>

        {error && (
          <Typography sx={{ textAlign: 'center', mb: 2, color: '#ff0000' }}>
            {error}
          </Typography>
        )}

        {isLoading ? (
          <Typography sx={{ textAlign: 'center', color: '#ffffff' }}>
            Processing cancellation...
          </Typography>
        ) : (
          <Box sx={{ backgroundColor: '#1f2937', p: 4, borderRadius: '12px', color: '#ffffff' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Cancellation Policy
            </Typography>
            <Typography sx={{ mb: 2 }}>
              Canceling your service request (Request #{requestId}) will incur a <strong>$45.00 cancellation fee</strong>. This fee covers administrative costs and technician scheduling adjustments.
            </Typography>
            <Typography sx={{ mb: 2 }}>
              <strong>Why a Cancellation Fee?</strong>
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
                <li>Compensates for time reserved by our technicians.</li>
                <li>Covers administrative processing and rescheduling efforts.</li>
                <li>Ensures fair allocation of resources for other customers.</li>
              </ul>
            </Typography>
            <Typography sx={{ mb: 2 }}>
              The fee will be processed immediately upon confirmation. You will receive a confirmation email with payment details. If you have any questions, please contact our support team at <a href="mailto:support@tap4service.co.nz" style={{ color: '#3b82f6' }}>support@tap4service.co.nz</a>.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 4 }}>
              <Button
                variant="contained"
                onClick={handleConfirmCancellation}
                disabled={isLoading}
                sx={{
                  background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  borderRadius: '24px',
                  padding: '12px 24px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                }}
              >
                <FaTimes style={{ marginRight: '8px' }} />
                Confirm Cancellation
              </Button>
              <Button
                variant="outlined"
                onClick={handleBack}
                sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { borderColor: '#3b82f6' } }}
              >
                <FaArrowLeft style={{ marginRight: '8px' }} />
                Back to Dashboard
              </Button>
            </Box>
          </Box>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default CancellationFee;