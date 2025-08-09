/**
 * CustomerLogin.tsx - Version V1.28
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
 * - Improved retry logic for empty responses and added handling for 404 errors on verify endpoint.
 * - Added detailed logging for response parsing and error handling.
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
          data = textData ? JSON.parse(textData) : {};
        } catch {
          console.error('Invalid server response format:', textData);
          setMessage({ text: `Verification check failed: Invalid server response`, type: 'error' });
          return;
        }
        setMessage({ text: data.error || `Verification check failed: Status ${response.status}`, type: 'error' });
        return;
      }

      const data = JSON.parse(textData);
      setRequiresVerification(data.status !== 'verified');
    } catch (err: unknown) {
      console.error('Error checking verification requirement:', err);
      setMessage({ text: 'Error checking account status', type: 'error' });
    }
  };

  const retryFetch = async (url: string, options: RequestInit, retries: number = 3, delay: number = 1000): Promise<Response> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        const text = await response.text();
        console.log(`Login API response: attempt=${attempt}, status=${response.status}, response=${text.substring(0, 100)}...`);
        if (!text && !response.ok) {
          throw new Error(`Empty response from server on attempt ${attempt}`);
        }
        return new Response(text, { status: response.status, headers: response.headers });
      } catch (err) {
        console.error(`Retry attempt ${attempt} failed:`, err);
        if (attempt === retries) {
          throw new Error(`Server returned an empty response after ${retries} retries`);
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error('Retry limit reached');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    const payload = { email, password, token: verificationToken || null };
    console.log('Sending payload:', payload);

    try {
      const response = await retryFetch(`${API_URL}/api/customers-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      if (!response.ok) {
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          console.error('Failed to parse response JSON:', responseText);
          setMessage({ text: `Login failed: Invalid response format`, type: 'error' });
          return;
        }
        console.error('Login failed:', { status: response.status, response: responseText });
        setMessage({ text: data.error || `HTTP error! Status: ${response.status}`, type: 'error' });
        if (data.error === 'Verification token required') {
          setRequiresVerification(true);
          verificationRef.current?.focus();
        }
        return;
      }

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        console.error('Failed to parse response JSON:', responseText);
        setMessage({ text: `Login failed: Invalid response format`, type: 'error' });
        return;
      }

      if (!data.success) {
        console.error('Login failed with response:', data);
        setMessage({ text: data.error || 'Login failed', type: 'error' });
        if (data.error === 'Verification token required') {
          setRequiresVerification(true);
          verificationRef.current?.focus();
        }
        return;
      }

      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('userName', data.user.name);
      console.log('Login successful, storing user data:', data.user);
      console.log('localStorage after setting:', localStorage);
      navigate('/customer-dashboard');
    } catch (err: unknown) {
      console.error('Error during login:', err);
      setMessage({ text: err instanceof Error ? err.message : 'An error occurred during login', type: 'error' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" className="h-16" />
          </div>
          <Typography className="text-center text-[clamp(1.5rem,4vw,2rem)] font-bold text-[#ffffff] mb-6">
            Customer Login
          </Typography>
          {message.text && (
            <Typography className="text-center mb-4 text-[clamp(0.875rem,2vw,1rem)]" sx={{ color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
              {message.text}
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
                onBlur={checkVerificationRequirement}
                fullWidth
                required
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
                required
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