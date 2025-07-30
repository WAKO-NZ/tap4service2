/**
 * TechnicianLogin.tsx - Version V1.0
 * - Styled to match CustomerRegister.tsx with dark theme and gradient background.
 * - Includes email and password fields, with Login and Register buttons side by side.
 * - Uses /api/technicians-login.php endpoint.
 * - Stores userId, role, name in localStorage on success.
 * - Redirects to /technician-dashboard on successful login or /technician-register for Register button.
 * - No page number displayed.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaWrench } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface LoginResponse {
  message?: string;
  userId?: number;
  name?: string;
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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    console.log('TechnicianLogin component mounted');
    return () => console.log('TechnicianLogin component unmounted');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });
    setIsSubmitting(true);

    if (!email || !password) {
      setMessage({ text: 'Please fill in all fields.', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    try {
      setMessage({ text: 'Logging in...', type: 'error' });
      const response = await fetch(`${API_URL}/api/technicians-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const textData = await response.text();
      let data: LoginResponse;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Login response is not JSON:', textData);
        setMessage({ text: 'Network error during login. Invalid server response.', type: 'error' });
        setIsSubmitting(false);
        return;
      }
      console.log('Login response:', { status: response.status, data });

      if (response.ok) {
        if (data.userId && data.name) {
          localStorage.setItem('userId', data.userId.toString());
          localStorage.setItem('role', 'technician');
          localStorage.setItem('userName', data.name);
          setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
          setTimeout(() => navigate('/technician-dashboard'), 2000);
        } else {
          setMessage({ text: 'Invalid response from server.', type: 'error' });
        }
      } else {
        setMessage({ text: data.error || 'Invalid email or password.', type: 'error' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage({ text: 'Network error during login.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleButtonClick = () => {
    if (formRef.current) {
      const formEvent = new Event('submit', { bubbles: true, cancelable: true });
      formRef.current.dispatchEvent(formEvent);
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
            <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
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
              <label htmlFor="password" className="block text-[clamp(1rem,2.5vw,1.125rem)] mb-2">
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
                className="flex-1 relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
                aria-label="Login"
              >
                <div className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4" />
                <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  {isSubmitting ? 'Logging in...' : 'Login'}
                </div>
              </button>
              <Link
                to="/technician-register"
                className="flex-1 relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                role="button"
                aria-label="Technician Registration"
              >
                <div className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4" />
                <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Register
                </div>
              </Link>
            </div>
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