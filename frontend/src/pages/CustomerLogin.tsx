/**
 * CustomerLogin.tsx - Version V1.32
 * - Handles customer login via POST /api/customers-login.php.
 * - Checks if verification token is required via GET /api/customers/verify/<email>.
 * - Shows verification token field if status is not 'verified' initially or if login fails with "Verification token required".
 * - Displays Email and Password labels as plain text (Typography) above input fields.
 * - Adds autoComplete attributes to email and password inputs.
 * - Replaces "Back to Home" button with "Register" button, navigating to /customer-register.
 * - Adds "Forgot Password" link.
 * - Styled to match LogTechnicalCallout.tsx with dark gradient background, gray card, blue gradient buttons.
 * - Uses MUI TextField with white text (#ffffff).
 * - Enhanced error handling with specific server error messages, including detailed verification token debugging and retry option.
 * - Improved retry logic for empty responses and added handling for 404 errors and invalid JSON responses.
 * - Added detailed logging for raw response text to debug empty response issues.
 * - Ensured inputs and buttons are selectable with proper focus management and no CSS conflicts.
 * - Improved error handling for 500 server errors.
 * - Added pointerEvents: 'auto' and tabIndex to ensure interactivity.
 */
import { useState, useRef, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, TextField, Typography, Container } from '@mui/material';
import { FaSignInAlt, FaUserPlus } from 'react-icons/fa';

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
    console.error('Error in CustomerLogin:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ffffff] p-8">
          <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
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

const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [showVerificationField, setShowVerificationField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const checkVerificationStatus = async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/api/customers/verify/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const text = await response.text();
      console.log(`Verification status response: ${text}, Status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = JSON.parse(text);
      if (data.status !== 'verified') {
        setShowVerificationField(true);
      }
    } catch (err: any) {
      console.error('Error checking verification status:', err);
      setError('Error checking verification status. Please try again.');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    retryCount.current = 0;

    while (retryCount.current < maxRetries) {
      try {
        console.log('handleSubmit triggered, event default prevented:', e.defaultPrevented);
        console.log('Sending payload:', { email, password, verification_token: verificationToken });
        const response = await fetch(`${API_URL}/api/customers-login.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, verification_token: verificationToken }),
        });
        const text = await response.text();
        console.log(`API response: attempt=${retryCount.current + 1}, status=${response.status}, response=${text}`);
        if (!response.ok) {
          if (response.status === 403 && text.includes('Verification token required')) {
            setShowVerificationField(true);
            setError('Verification token required. Please enter the 4-digit code sent to your email.');
            break;
          } else if (response.status === 500) {
            throw new Error('Server error during login');
          } else {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
        }
        const data = JSON.parse(text);
        if (data.success) {
          localStorage.setItem('userId', data.customerId);
          localStorage.setItem('role', 'customer');
          localStorage.setItem('userName', data.name);
          navigate('/customer-dashboard');
          break;
        } else {
          throw new Error(data.error || 'Login failed');
        }
      } catch (err: any) {
        console.error('Error logging in:', err);
        retryCount.current++;
        if (retryCount.current >= maxRetries) {
          setError('Error logging in: ' + (err.message || 'Please try again or contact support.'));
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch(`${API_URL}/api/resend-verification-customer.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const text = await response.text();
      console.log(`Resend verification response: ${text}, Status: ${response.status}`);
      const data = JSON.parse(text);
      if (response.ok) {
        setError('Verification code resent. Please check your email.');
      } else {
        setError(data.error || 'Failed to resend verification code.');
      }
    } catch (err: any) {
      console.error('Error resending verification code:', err);
      setError('Error resending verification code. Please try again.');
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="sm" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh', color: '#ffffff', pointerEvents: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Customer Login
          </Typography>
        </Box>

        {error && (
          <Typography sx={{ textAlign: 'center', mb: 2, color: '#ff0000' }}>
            {error}
          </Typography>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ backgroundColor: '#1f2937', p: 4, borderRadius: '12px', color: '#ffffff', pointerEvents: 'auto' }}>
          <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Email</Typography>
          <TextField
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && checkVerificationStatus(email)}
            fullWidth
            type="email"
            autoComplete="email"
            required
            sx={{
              mb: 2,
              '& .MuiInputLabel-root': { color: '#ffffff' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#ffffff' },
                '&:hover fieldset': { borderColor: '#3b82f6' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                '& input': { color: '#ffffff', pointerEvents: 'auto' }
              }
            }}
            InputProps={{ sx: { backgroundColor: '#374151', borderRadius: '8px', pointerEvents: 'auto' } }}
            tabIndex={0}
          />
          <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Password</Typography>
          <TextField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            type="password"
            autoComplete="current-password"
            required
            sx={{
              mb: 2,
              '& .MuiInputLabel-root': { color: '#ffffff' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#ffffff' },
                '&:hover fieldset': { borderColor: '#3b82f6' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                '& input': { color: '#ffffff', pointerEvents: 'auto' }
              }
            }}
            InputProps={{ sx: { backgroundColor: '#374151', borderRadius: '8px', pointerEvents: 'auto' } }}
            tabIndex={0}
          />
          {showVerificationField && (
            <>
              <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Verification Token</Typography>
              <TextField
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                fullWidth
                required
                inputProps={{ maxLength: 4 }}
                sx={{
                  mb: 2,
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff', pointerEvents: 'auto' }
                  }
                }}
                InputProps={{ sx: { backgroundColor: '#374151', borderRadius: '8px', pointerEvents: 'auto' } }}
                tabIndex={0}
              />
              <Button
                onClick={handleResendVerification}
                sx={{ mb: 2, color: '#3b82f6', textDecoration: 'underline' }}
                tabIndex={0}
              >
                Resend Verification Code
              </Button>
            </>
          )}
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              sx={{
                flex: 1,
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
                },
                pointerEvents: 'auto'
              }}
              tabIndex={0}
            >
              <FaSignInAlt style={{ marginRight: '8px' }} />
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <Button
              variant="outlined"
              component={Link}
              to="/customer-register"
              sx={{
                flex: 1,
                color: '#ffffff',
                borderColor: '#ffffff',
                borderRadius: '24px',
                padding: '12px 24px',
                '&:hover': {
                  borderColor: '#3b82f6',
                  color: '#3b82f6'
                },
                pointerEvents: 'auto'
              }}
              tabIndex={0}
            >
              <FaUserPlus style={{ marginRight: '8px' }} />
              Register
            </Button>
          </Box>
          <Box sx={{ mt: 2, textAlign: 'center', color: '#ffffff' }}>
            <Typography>
              <Link to="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'underline' }} tabIndex={0}>
                Forgot Password?
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </ErrorBoundary>
  );
};

export default CustomerLogin;