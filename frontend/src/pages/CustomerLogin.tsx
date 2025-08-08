/**
 * CustomerLogin.tsx - Version V1.31
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
 * - Added logging to verify localStorage and verification token input.
 * - Fixed TypeScript error by importing Link from react-router-dom.
 * - Changed payload key from 'verification_token' to 'token' to match backend.
 * - Updated token request to use /api/resend-verification.php.
 * - Fixed redirect issue by forcing navigation to /customer-dashboard and adding debug logs in V1.27.
 * - Improved 500 error handling and navigation debugging in V1.28.
 * - Added retry button for server errors and enhanced error messages in V1.29.
 * - Improved retry logic and prevented refresh loops in V1.30.
 * - Fixed TypeScript error 'Cannot find name Exception' by using Error in V1.31.
 */
import { useState, useRef, Component, type ErrorInfo, type FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { FaSignInAlt, FaUserPlus, FaSync, FaRedo } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

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
    console.error('Error in CustomerLogin:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ffffff] p-8">
          <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-bold mb-4">Something went wrong</h2>
          <p>Please try again later or contact <a href="mailto:support@tap4service.co.nz" className="underline text-[#ffffff]">support@tap4service.co.nz</a>.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const [isResending, setIsResending] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef(email);

  useEffect(() => {
    emailRef.current = email;
    if (email) {
      const checkVerification = async () => {
        try {
          console.log('Checking verification status for email:', email);
          const response = await fetch(`${API_URL}/api/customers/verify/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          const data = await response.json();
          console.log('Verification status response:', data);
          setShowTokenField(data.status !== 'verified');
        } catch (err: unknown) {
          console.error('Error checking verification status:', err);
        }
      };
      checkVerification();
    }
  }, [email]);

  const handleResendToken = async () => {
    setIsResending(true);
    setMessage({ text: '', type: 'error' });
    try {
      console.log('Resending verification token for email:', emailRef.current);
      const response = await fetch(`${API_URL}/api/resend-verification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailRef.current }),
        credentials: 'include',
      });
      const data = await response.json();
      console.log('Resend token response:', data);
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      setMessage({ text: 'Verification token sent. Please check your email.', type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error resending token:', error);
      setMessage({ text: error.message || 'Failed to resend verification token.', type: 'error' });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage({ text: '', type: 'error' });
    setIsRetrying(false);
    try {
      const payload = { email, password, ...(showTokenField && token && { token }) };
      console.log('Submitting login payload:', payload);
      const response = await fetch(`${API_URL}/api/customers-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      console.log('Login response status:', response.status, 'Headers:', Object.fromEntries(response.headers));
      const data = await response.json();
      console.log('Login response body:', data);

      if (!response.ok) {
        if (response.status === 500) {
          throw new Error('Server error, please try again or contact support.');
        }
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      if (data.error) {
        if (data.error.includes('Verification token required')) {
          setShowTokenField(true);
          setMessage({ text: 'Please enter your verification token.', type: 'error' });
          return;
        }
        throw new Error(data.error);
      }

      localStorage.setItem('userId', data.userId?.toString() || '0');
      localStorage.setItem('role', data.role || '');
      console.log('Stored in localStorage: userId=', data.userId, 'role=', data.role);
      setMessage({ text: 'Login successful. Redirecting...', type: 'success' });
      console.log('Attempting to navigate to /customer-dashboard');
      navigate('/customer-dashboard', { replace: true }); // Force redirect with replace
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error logging in:', error);
      setMessage({ text: error.message || 'Failed to log in. Please try again or contact support.', type: 'error' });
      setIsRetrying(error.message.includes('Server error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setMessage({ text: '', type: 'error' });
    setIsRetrying(false);
    handleSubmit({ preventDefault: () => {} } as FormEvent);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-r from-[#1f2937] to-[#111827] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#374151] p-6 rounded-lg shadow-lg">
          <div className="text-center mb-6">
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" className="mx-auto mb-4 max-w-[150px]" />
            <Typography className="text-[clamp(1.5rem,4vw,2rem)] font-bold text-[#ffffff]">
              Customer Login
            </Typography>
          </div>

          {message.text && (
            <Typography className="text-center mb-4" sx={{ color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
            </Typography>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Email</Typography>
                <TextField
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoComplete="email"
                  className="bg-[#1f2937] text-[#ffffff] rounded-md"
                  InputProps={{ className: 'text-[#ffffff]' }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                    }
                  }}
                />
              </Box>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Password</Typography>
                <TextField
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  required
                  autoComplete="current-password"
                  className="bg-[#1f2937] text-[#ffffff] rounded-md"
                  InputProps={{ className: 'text-[#ffffff]' }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                    }
                  }}
                />
              </Box>
              {showTokenField && (
                <Box>
                  <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>
                    Verification Token{' '}
                    <Button
                      onClick={handleResendToken}
                      disabled={isResending}
                      sx={{ color: '#3b82f6', textTransform: 'none', ml: 1 }}
                    >
                      <FaSync style={{ marginRight: '4px' }} />
                      {isResending ? 'Resending...' : 'Resend Token'}
                    </Button>
                  </Typography>
                  <TextField
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    fullWidth
                    required
                    autoComplete="off"
                    className="bg-[#1f2937] text-[#ffffff] rounded-md"
                    InputProps={{ className: 'text-[#ffffff]' }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#ffffff' },
                        '&:hover fieldset': { borderColor: '#3b82f6' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                      }
                    }}
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || isRetrying}
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
                    }
                  }}
                >
                  <FaSignInAlt style={{ marginRight: '8px' }} />
                  Login
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
                    }
                  }}
                >
                  <FaUserPlus style={{ marginRight: '8px' }} />
                  Register
                </Button>
              </Box>
              {isRetrying && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button
                    onClick={handleRetry}
                    disabled={isSubmitting}
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
                    <FaRedo style={{ marginRight: '8px' }} />
                    Retry Login
                  </Button>
                </Box>
              )}
              <Box sx={{ mt: 2, textAlign: 'center', color: '#ffffff' }}>
                <Typography>
                  <Link to="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    Forgot Password?
                  </Link>
                </Typography>
              </Box>
            </Box>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}