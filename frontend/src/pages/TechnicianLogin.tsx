/**
 * TechnicianLogin.tsx - Version V1.9
 * - Handles technician login with email, password, and optional 4-digit verification token for pending accounts.
 * - Shows verification token input field immediately when server returns 'Verification token required'.
 * - Updates technician status to 'verified' on successful token and email validation via /api/technicians-login.php.
 * - Includes 'Resend Verification Code' link to call /api/resend-verification-technician.php.
 * - Redirects to /technician-dashboard on success without delay.
 * - Displays error messages and scrolls to top on failure.
 * - Styled to match CustomerRegister.tsx with dark gradient background, gray card, blue gradient buttons, white text.
 */
import { useState, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaWrench } from 'react-icons/fa';

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
    console.error('Error in TechnicianLogin:', error, errorInfo);
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

export default function TechnicianLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  const handleResendVerification = async () => {
    setMessage({ text: '', type: 'error' });
    if (!email) {
      setMessage({ text: 'Please enter your email to resend the verification code.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/resend-verification-technician.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data: LoginResponse = await response.json();
      if (response.ok) {
        setMessage({ text: 'Verification code resent. Please check your email.', type: 'success' });
        setShowTokenField(true);
        setTimeout(() => tokenInputRef.current?.focus(), 100);
      } else {
        setMessage({ text: data.error || 'Failed to resend verification code.', type: 'error' });
      }
      window.scrollTo(0, 0);
    } catch (error: unknown) {
      console.error('Resend verification error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    if (!email || !password || (showTokenField && !verificationToken)) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' });
      window.scrollTo(0, 0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/technicians-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verification_token: showTokenField ? verificationToken : undefined }),
        credentials: 'include',
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
          if (data.error === 'Verification token required') {
            setShowTokenField(true);
            setMessage({ text: 'Your account is not verified. Please enter the 4-digit verification code sent to your email.', type: 'error' });
            setTimeout(() => tokenInputRef.current?.focus(), 100);
          } else if (data.error === 'Invalid verification token') {
            setShowTokenField(true);
            setMessage({ text: 'Invalid verification code. Please try again or resend the code.', type: 'error' });
            setTimeout(() => tokenInputRef.current?.focus(), 100);
          } else if (data.error === 'Verification token expired') {
            setShowTokenField(true);
            setMessage({ text: 'Verification code expired. Please request a new one.', type: 'error' });
            setTimeout(() => tokenInputRef.current?.focus(), 100);
          } else {
            setMessage({ text: data.error, type: 'error' });
          }
          window.scrollTo(0, 0);
        } else if (data.userId && data.role === 'technician') {
          localStorage.setItem('userId', data.userId.toString());
          localStorage.setItem('role', data.role);
          localStorage.setItem('userName', data.userName || 'Technician');
          setMessage({ text: 'Login successful!', type: 'success' });
          navigate('/technician-dashboard');
        } else {
          setMessage({ text: 'Invalid response from server.', type: 'error' });
          window.scrollTo(0, 0);
        }
      } else {
        setMessage({ text: data.error || 'Login failed. Please try again.', type: 'error' });
        window.scrollTo(0, 0);
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
      window.scrollTo(0, 0);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative w-full max-w-[clamp(20rem,80vw,32rem)] z-10 bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-[clamp(2rem,5vw,2.5rem)] font-bold text-center mb-6 bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent">
            Technician Login
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
                className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1.25rem,2.5vw,1.5rem)]"
                required
                aria-label="Password"
                autoComplete="current-password"
              />
            </div>
            {showTokenField && (
              <div>
                <label htmlFor="verificationToken" className="block text-[clamp(1rem,2.5vw,1.125rem)] text-white mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  id="verificationToken"
                  ref={tokenInputRef}
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-[clamp(1rem,2.5vw,1.125rem)]"
                  placeholder="Enter 4-digit code"
                  maxLength={4}
                  required
                  aria-label="Verification Code"
                />
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="block text-center mt-2 text-[clamp(0.875rem,2vw,1rem)] text-blue-400 hover:underline"
                  aria-label="Resend Verification Code"
                >
                  Resend Verification Code
                </button>
              </div>
            )}
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Submit Technician Login"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Login
                </div>
              </button>
              <Link
                to="/technician-register"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                role="button"
                aria-label="Register as Technician"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
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