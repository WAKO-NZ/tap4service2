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
 * - Added logging to verify localStorage and verification token input.
 * - Fixed TypeScript error by importing Link from react-router-dom.
 * - Changed payload key from 'verification_token' to 'token' to match backend.
 * - Updated token request to use /api/resend-verification.php.
 * - Added localStorage.setItem('user_id') on successful login to fix session issues (V1.27).
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
    try {
      const payload = { email, password };
      if (requiresVerification || message.text.includes('Verification token required')) {
        Object.assign(payload, { token: verificationToken });
      }
      console.log('Submitting login payload:', payload);
      const response = await fetch(`${API_URL}/api/customers-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const textData = await response.text();
      console.log(`Login API response status: ${response.status}, Response: ${textData}`);
      
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        throw new Error('Invalid server response format');
      }

      if (response.ok && data.success) {
        localStorage.setItem('user_id', data.user.id.toString());
        console.log('Set user_id in localStorage:', data.user.id);
        setMessage({ text: 'Login successful', type: 'success' });
        setTimeout(() => navigate('/customer-dashboard'), 1500);
      } else {
        setMessage({ text: data.error || 'Login failed', type: 'error' });
        if (data.error === 'Verification token required') {
          setRequiresVerification(true);
          verificationRef.current?.focus();
        }
        console.log('Login error:', data.error);
      }
    } catch (err: any) {
      console.error(`Login fetch error: ${err.message}`);
      setMessage({ text: `Failed to connect to server: ${err.message}`, type: 'error' });
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setMessage({ text: 'Please enter an email address', type: 'error' });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/resend-verification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const textData = await response.text();
      console.log(`Resend verification API response status: ${response.status}, Response: ${textData}`);
      
      let data;
      try {
        data = JSON.parse(textData);
      } catch {
        throw new Error('Invalid server response format');
      }

      if (response.ok) {
        setMessage({ text: 'Verification code sent to your email', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Failed to resend verification code', type: 'error' });
      }
    } catch (err: any) {
      console.error(`Resend verification error: ${err.message}`);
      setMessage({ text: `Failed to resend verification code: ${err.message}`, type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="bg-gray-700 rounded-xl shadow-lg p-6 w-full max-w-md">
          <Typography
            variant="h4"
            sx={{
              color: '#ffffff',
              textAlign: 'center',
              mb: 3,
              fontWeight: 'bold',
              fontSize: 'clamp(1.5rem, 4vw, 2rem)'
            }}
          >
            Customer Login
          </Typography>
          {message.text && (
            <Typography
              sx={{
                color: message.type === 'success' ? '#10b981' : '#ff0000',
                textAlign: 'center',
                mb: 2,
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
              }}
            >
              {message.text}
            </Typography>
          )}
          <form ref={formRef} onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography sx={{ color: '#ffffff', mb: 1, fontWeight: 'bold' }}>Email</Typography>
                <TextField
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={checkVerificationRequirement}
                  fullWidth
                  autoComplete="username"
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
                {(requiresVerification || message.text.includes('Verification token required')) && (
                  <Typography sx={{ mt: 1 }}>
                    <Button
                      onClick={handleResendVerification}
                      sx={{ color: '#3b82f6', textTransform: 'none', p: 0 }}
                    >
                      <FaSync style={{ marginRight: '8px' }} />
                      Resend Verification Code
                    </Button>
                  </Typography>
                )}
              </Box>
            </Box>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}