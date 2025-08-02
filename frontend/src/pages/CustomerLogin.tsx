/**
 * CustomerLogin.tsx - Version V1.0
 * - Handles customer login via POST /api/customers-login.php.
 * - Validates email, password, and optional 4-digit token for pending accounts.
 * - Stores user_id, role, and userName in localStorage on success.
 * - Redirects to /customer-dashboard on successful login.
 * - Uses dark gradient background, gray card, blue gradient buttons.
 * - All text set to white (#ffffff) for visibility.
 * - Enhanced error handling for non-JSON responses.
 */
import { useState, useRef, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button } from '@mui/material';
import { FaSignInAlt } from 'react-icons/fa';

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
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    if (!email.trim() || !password.trim()) {
      setMessage({ text: 'Email and password are required.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    const payload = {
      email: email.trim(),
      password,
      token: token.trim() || undefined
    };

    try {
      const url = `${API_URL}/api/customers-login.php`;
      const headers = { 'Content-Type': 'application/json' };
      const requestOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      };
      console.log('Sending login request: Method:', requestOptions.method, 'URL:', url, 'Headers:', headers, 'Payload:', payload);

      const response = await fetch(url, requestOptions);
      const responseText = await response.text();
      console.log('API response: Status:', response.status, 'Headers:', Object.fromEntries(response.headers), 'Response:', responseText);

      if (!response.ok) {
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error('Invalid server response format');
        }
        console.warn('Login failed:', data.error || 'Unknown error', 'Status:', response.status);
        if (response.status === 401) {
          setMessage({ text: data.error || 'Invalid email or password.', type: 'error' });
        } else if (response.status === 400) {
          setMessage({ text: data.error || 'Invalid input. Please check your data.', type: 'error' });
        } else {
          setMessage({ text: `Failed to login: ${data.error || 'Server error.'}`, type: 'error' });
        }
        window.scrollTo(0, 0);
        return;
      }

      if (responseText.trim() === '') {
        console.warn('Empty response from server');
        setMessage({ text: 'Server returned an empty response.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Response is not valid JSON:', parseError, 'Raw data:', responseText);
        setMessage({ text: 'Invalid server response format.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      if (!data.success || !data.user) {
        setMessage({ text: 'Login failed: Invalid response data.', type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('userName', data.user.name);
      setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
      console.log('Login successful, user:', data.user);
      setTimeout(() => navigate('/customer-dashboard'), 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error during login:', error);
      setMessage({ text: `Error: ${error.message}. Please try again or contact support.`, type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-[#ffffff] p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" className="mx-auto mb-6 max-w-[150px]" />
          <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent mb-6">
            Customer Login
          </h2>
          {message.text && (
            <p className={`text-center mb-6 text-[clamp(1rem,2.5vw,1.125rem)] ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6" ref={formRef}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              sx={{
                '& .MuiInputLabel-root': { color: '#ffffff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#ffffff' },
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  '& input': { color: '#ffffff' }
                }
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              sx={{
                '& .MuiInputLabel-root': { color: '#ffffff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#ffffff' },
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  '& input': { color: '#ffffff' }
                }
              }}
            />
            <TextField
              label="Verification Token (if pending)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { color: '#ffffff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#ffffff' },
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  '& input': { color: '#ffffff' }
                }
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
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
              <FaSignInAlt style={{ marginRight: '8px' }} />
              Login
            </Button>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}