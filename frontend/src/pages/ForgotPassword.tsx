/**
 * ForgotPassword.tsx - Version V1.1
 * - Allows users to request a password reset by entering their email.
 * - Sends a request to /api/forgot-password.php.
 * - Displays success or error messages.
 * - Fixed FaUser error by replacing with FaArrowLeft for navigation.
 */
import { useState, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaEnvelope, FaArrowLeft } from 'react-icons/fa'; // Import FaArrowLeft for navigation

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface ForgotResponse {
  message?: string;
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
    console.error('Error in ForgotPassword:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-red-500 p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline">
              support@tap4service.co.nz
            </a>.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });

    if (!email) {
      setMessage({ text: 'Please enter your email.', type: 'error' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/forgot-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const textData = await response.text();
      let data: ForgotResponse;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error('Forgot password response is not JSON:', textData);
        setMessage({ text: `Network error: ${textData.substring(0, 100)}...`, type: 'error' });
        return;
      }

      if (response.ok) {
        setMessage({ text: data.message || 'Password reset email sent. Check your inbox.', type: 'success' });
        setTimeout(() => navigate('/customer-login'), 3000); // Redirect after success
      } else {
        setMessage({ text: data.error || 'Failed to send reset email.', type: 'error' });
      }
    } catch (error: unknown) {
      console.error('Forgot password error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
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
            Forgot Password
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
                autoComplete="email"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Submit Password Reset Request"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaEnvelope className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                  Send Reset Link
                </div>
              </button>
              <Link
                to="/customer-login"
                className="flex-1 relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Back to Customer Login"
              >
                <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
                <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
                <div className="relative flex items-center justify-center h-12 z-10">
                  <FaArrowLeft className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" /> {/* Replaced FaUser with FaArrowLeft */}
                  Back to Login
                </div>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}