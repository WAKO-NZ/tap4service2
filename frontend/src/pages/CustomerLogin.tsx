/**
 * CustomerLogin.tsx - Version V1.10
 * - Handles customer login via POST /api/customers-login.php.
 * - Checks if email is verified; if not, displays message and resends verification email via POST /api/resend-verification.php.
 * - Stays on login page if unverified.
 * - Styled with dark gradient background, gray card, blue gradient buttons, and ripple effect.
 * - Enhanced error handling for session validation and API errors.
 * - Includes "Forgot Password" link.
 */
import { useState, useRef, Component, type ErrorInfo, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaSignInAlt } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface LoginResponse {
  message?: string;
  userId?: number;
  role?: string;
  userName?: string;
  error?: string;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error in CustomerLogin:', error, errorInfo);
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
            <Link
              to="/"
              className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const [isResending, setIsResending] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered, event:', e, 'default prevented:', e.defaultPrevented);
    setMessage({ text: '', type: 'error' });

    if (!email || !password) {
      setMessage({ text: 'Please fill in all fields.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    try {
      const url = `${API_URL}/api/customers-login.php`;
      console.log('Logging in at:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const textData = await response.text();
      let data: LoginResponse;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Login response is not JSON:', textData);
        setMessage({ text: `Network error: Invalid server response - ${textData.substring(0, 100)}...`, type: 'error' });
        window.scrollTo(0, 0);
        return;
      }
      console.log('Login response:', { status: response.status, data });

      if (response.ok) {
        if (data.error) {
          if (data.error === 'Account not verified') {
            setMessage({ text: 'Your email is not verified. Resending verification email...', type: 'error' });
            await resendVerificationEmail(email);
          } else {
            setMessage({ text: data.error, type: 'error' });
            window.scrollTo(0, 0);
          }
        } else if (data.userId && data.role === 'customer') {
          localStorage.setItem('userId', data.userId.toString());
          localStorage.setItem('role', data.role);
          localStorage.setItem('userName', data.userName || 'Customer');
          setMessage({ text: 'Login successful!', type: 'success' });
          navigate('/customer-dashboard');
        } else {
          setMessage({ text: 'Invalid response from server.', type: 'error' });
          window.scrollTo(0, 0);
        }
      } else {
        setMessage({ text: data.error || 'Login failed. Please try again.', type: 'error' });
        window.scrollTo(0, 0);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error logging in:', error);
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  const resendVerificationEmail = async (email: string) => {
    if (isResending) return;
    setIsResending(true);
    try {
      const url = `${API_URL}/api/resend-verification.php`;
      console.log('Resending verification email to:', email);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const textData = await response.text();
      console.log('Resend verification response status:', response.status, 'Response:', textData);

      if (!response.ok) {
        let data;
        try {
          data = textData ? JSON.parse(textData) : {};
        } catch {
          data = {};
        }
        console.warn('Resend verification failed:', data.error || 'Unknown error', 'Status:', response.status);
        setMessage({ text: `Failed to resend verification email: ${data.error || 'Server error'}`, type: 'error' });
        window.scrollTo(0, 0);
        return;
      }

      setMessage({ text: 'Verification email resent successfully. Please check your inbox.', type: 'success' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network error');
      console.error('Error resending verification email:', error);
      setMessage({ text: `Error resending verification email: ${error.message}`, type: 'error' });
      window.scrollTo(0, 0);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent mb-6">
            Customer Login
          </h2>
          {message.text && (
            <p className={`text-center mb-4 text-[clamp(1rem,2.5vw,1.125rem)] ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Email"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                required
                aria-label="Password"
                autoComplete="current-password"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Submit Customer Login"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaSignInAlt className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Login
                </div>
              </button>
              <Link
                to="/customer-register"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                role="button"
                aria-label="Register as Customer"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  Register
                </div>
              </Link>
            </div>
            <Link
              to="/forgot-password"
              className="block text-center mt-2 text-[clamp(0.875rem,2vw,1rem)] text-blue-400 hover:underline"
              aria-label="Forgot Password"
            >
              Forgot Password?
            </Link>
          </form>
          <Link
            to="/"
            className="block text-center mt-6 text-[clamp(0.875rem,2vw,1rem)] text-blue-400 hover:underline"
            aria-label="Back to Home"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </ErrorBoundary>
  );
}