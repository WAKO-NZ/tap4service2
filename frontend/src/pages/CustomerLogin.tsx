/**
 * CustomerLogin.tsx - Version V1.26
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
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const verificationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('Component mounted, API_URL:', API_URL);
    console.log('Native fetch available:', typeof window.fetch === 'function');
  }, []);

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
      console.log('Verification requirement:', data.status !== 'verified');
    } catch (err: any) {
      console.error(`Error checking verification: ${err.message}`);
      setMessage({ text: `Error checking verification status: ${err.message}`, type: 'error' });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!email.trim()) {
      setMessage({ text: 'Email is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }
    if (!password.trim()) {
      setMessage({ text: 'Password is required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    const payload = {
      email: email.trim(),
      password: password.trim(),
      token: requiresVerification || verificationToken.trim() ? verificationToken.trim() : null
    };
    console.log('Sending payload:', { ...payload, token: verificationToken.trim() ? '[REDACTED]' : null }); // Log with redacted token

    try {
      const response = await fetch(`${API_URL}/api/customers-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const textData = await response.text();
      console.log('Login API response: Status:', response.status, 'Headers:', Object.fromEntries(response.headers), 'Response:', textData);

      if (!response.ok) {
        let data;
        try {
          data = JSON.parse(textData);
        } catch {
          throw new Error('Invalid server response format');
        }
        console.warn('Login failed:', data.error || 'Unknown error', 'Status:', response.status);
        if (response.status === 401 && data.error === 'Verification token required') {
          setRequiresVerification(true); // Show verification token field
          setMessage({ text: 'Verification token not accepted. Please re-enter or request a new one below.', type: 'error' });
          if (verificationRef.current) {
            verificationRef.current.focus(); // Focus the input
            console.log('Focused verification input, current value:', verificationRef.current.value);
          }
          return; // Allow resubmit with new token
        } else if (response.status === 403) {
          setMessage({ text: 'Invalid credentials or verification required.', type: 'error' });
        } else if (response.status === 400) {
          setMessage({ text: `Invalid input: ${data.error || 'Check your form data.'}`, type: 'error' });
        } else {
          setMessage({ text: `Failed to login: ${data.error || 'Server error. Please try again or contact support.'}`, type: 'error' });
        }
        window.scrollTo(0, 0);
        return;
      }

      if (textData.trim() === '') {
        console.warn('Empty response from server');
        setMessage({ text: 'Server returned an empty response.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Response is not valid JSON:', parseError, 'Raw data:', textData);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      setMessage({ text: data.message || 'Login successful!', type: 'success' });
      console.log('Login successful, storing user data:', data);
      localStorage.setItem('userId', data.user.id.toString());
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('userName', data.user.name);
      console.log('localStorage after setting:', {
        userId: localStorage.getItem('userId'),
        role: localStorage.getItem('role'),
        userName: localStorage.getItem('userName')
      });
      setTimeout(() => {
        const userId = localStorage.getItem('userId');
        const role = localStorage.getItem('role');
        console.log('Before redirect, localStorage:', { userId, role });
        if (userId && role) {
          navigate('/customer-dashboard');
        } else {
          console.error('localStorage data missing before redirect');
          setMessage({ text: 'Login data not stored properly. Please try again.', type: 'error' });
        }
      }, 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error logging in:', error);
      setMessage({ text: `Error: ${error.message}. Please try again or contact support.`, type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  const requestNewVerificationToken = async () => {
    console.log('Requesting new verification token for email:', email);
    setVerificationToken(''); // Clear current token
    try {
      const response = await fetch(`${API_URL}/api/resend-verification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() })
      });
      const textData = await response.text();
      console.log(`New token request response: Status: ${response.status}, Response: ${textData}`);
      if (!response.ok) {
        let data;
        try {
          data = JSON.parse(textData);
        } catch {
          throw new Error('Invalid server response format');
        }
        throw new Error(data.error || 'Failed to request new token');
      }
      const data = JSON.parse(textData);
      setMessage({ text: data.message || 'New verification token requested. Check your email.', type: 'error' });
      if (verificationRef.current) verificationRef.current.focus();
    } catch (err: any) {
      console.error(`Error requesting new verification token: ${err.message}`);
      setMessage({ text: `Error requesting new token: ${err.message}`, type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-[#ffffff] p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" className="mx-auto mb-6 max-w-[150px]" />
          <Typography variant="h4" sx={{ textAlign: 'center', mb: 4, fontWeight: 'bold', background: 'linear-gradient(to right, #d1d5db, #3b82f6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Customer Login
          </Typography>
          {message.text && (
            <Typography className={`text-center mb-6 text-[clamp(1rem,2.5vw,1.125rem)] ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
              {(message.text.includes('Verification token') && !message.text.includes('successful')) && (
                <Button
                  onClick={requestNewVerificationToken}
                  variant="outlined"
                  sx={{ ml: 1, color: '#3b82f6', borderColor: '#3b82f6', '&:hover': { borderColor: '#1e40af', color: '#1e40af' } }}
                  startIcon={<FaSync />}
                >
                  Request New Token
                </Button>
              )}
            </Typography>
          )}
          <form onSubmit={handleSubmit} className="space-y-6" ref={formRef}>
            <Box>
              <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Email</Typography>
              <TextField
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={checkVerificationRequirement}
                fullWidth
                autoComplete="email"
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
                fullWidth
                autoComplete="current-password"
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
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}