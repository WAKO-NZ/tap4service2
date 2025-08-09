/**
 * CustomerLogin.tsx - Version V1.27
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
 * - Added logging for empty response handling and improved error display.
 * - Added retry mechanism for empty responses with exponential backoff.
 * - Fixed TypeScript error by importing Link from react-router-dom.
 * - Changed payload key from 'verification_token' to 'token' to match backend.
 * - Updated token request to use /api/resend-verification.php.
 */
import { useState, useRef, Component, type ErrorInfo, type FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { FaSignInAlt, FaUserPlus, FaSync } from 'react-icons/fa';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const verificationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('Component mounted, API_URL:', API_URL);
    console.log('Native fetch available:', typeof window.fetch === 'function');
    checkVerificationRequirement();
  }, [email]);

  const checkVerificationRequirement = async () => {
    if (!email.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/customers/verify/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const textData = await response.text();
      console.log(`Verify API response status: ${response.status}, Response: ${textData}`);

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
      setRequiresVerification(data.status !== 'verified');
      if (data.status !== 'verified') {
        setMessage({ text: 'Verification token required for unverified account', type: 'error' });
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error checking verification requirement:', err);
      setMessage({ text: err.message || 'Error checking verification status', type: 'error' });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    const payload = { email, password, token: verificationToken || null };
    console.log('Sending payload:', payload);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(`${API_URL}/api/customers-login.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
        const textData = await response.text();
        console.log('Login API response:', {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          response: textData,
        });

        if (!response.ok) {
          let data;
          try {
            data = JSON.parse(textData);
            setMessage({ text: data.error || `HTTP error! Status: ${response.status}`, type: 'error' });
          } catch {
            setMessage({ text: textData || `HTTP error! Status: ${response.status}`, type: 'error' });
          }
          console.error('Login failed:', { status: response.status, response: textData });
          return;
        }

        if (!textData) {
          console.error('Empty response from server, attempt:', attempt + 1);
          if (attempt < maxRetries) {
            setRetryCount(attempt + 1);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            attempt++;
            continue;
          } else {
            setMessage({ text: 'Server returned an empty response after retries', type: 'error' });
            return;
          }
        }

        const data = JSON.parse(textData);
        if (data.success) {
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('role', data.user.role);
          localStorage.setItem('userName', data.user.name);
          console.log('Login successful, storing user data:', data.user);
          console.log('localStorage after setting:', localStorage);
          navigate('/customer-dashboard');
        } else {
          console.error('Login failed with response:', data);
          setMessage({ text: data.error || 'Login failed', type: 'error' });
          if (data.error.includes('Verification token required')) {
            setRequiresVerification(true);
          }
        }
        return;
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Error during login, attempt:', attempt + 1, error);
        if (attempt < maxRetries) {
          setRetryCount(attempt + 1);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          attempt++;
        } else {
          setMessage({ text: error.message || 'An error occurred during login', type: 'error' });
          return;
        }
      }
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch(`${API_URL}/api/resend-verification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const textData = await response.text();
      console.log(`Resend verification API response status: ${response.status}, Response: ${textData}`);

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
      setMessage({ text: data.message || 'Verification token sent', type: 'success' });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error resending verification:', err);
      setMessage({ text: err.message || 'Error resending verification token', type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-r from-gray-800 to-gray-900 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" className="max-w-[150px] mx-auto mb-4" />
            <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-bold text-[#ffffff]">Customer Login</h1>
          </div>
          {message.text && (
            <Typography sx={{ color: message.type === 'success' ? '#00ff00' : '#ff0000', textAlign: 'center', mb: 2 }}>
              {message.text}
              {message.text.includes('Verification token') && (
                <Button
                  onClick={handleResendVerification}
                  sx={{ ml: 2, color: '#3b82f6' }}
                >
                  <FaSync style={{ marginRight: '8px' }} />
                  Resend Token
                </Button>
              )}
            </Typography>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <Box>
              <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Email</Typography>
              <TextField
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                fullWidth
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  }
                }}
                InputProps={{ className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]' }}
              />
            </Box>
            <Box>
              <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Password</Typography>
              <TextField
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                fullWidth
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  }
                }}
                InputProps={{ className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]' }}
              />
            </Box>
            {(requiresVerification || message.text.includes('Verification token required')) && (
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Verification Code</Typography>
                <TextField
                  id="verification-token"
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  fullWidth
                  inputRef={verificationRef}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#ffffff' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& input': { color: '#ffffff' }
                    }
                  }}
                  InputProps={{ className: 'bg-gray-700 text-[#ffffff] border-gray-600 focus:border-blue-500 rounded-md text-[clamp(1rem,2.5vw,1.125rem)]' }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
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
            <Box sx={{ mt: 2, textAlign: 'center', color: '#ffffff' }}>
              <Typography>
                <Link to="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                  Forgot Password?
                </Link>
              </Typography>
            </Box>
            {retryCount > 0 && (
              <Typography sx={{ color: '#ff0000', textAlign: 'center', mt: 2 }}>
                Retry attempt {retryCount} of 3
              </Typography>
            )}
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}