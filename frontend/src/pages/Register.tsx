/**
     * Register.tsx - Version V6.102
     * - Removes page number from top right corner.
     * - Handles customer registration via /api/customers/register.
     * - Automatically logs in user and redirects to /customer-dashboard on success.
     * - Uses MUI for form styling and validation.
     * - Validates email, password, name, region, address, city, postal code.
     */
    import { useState, Component, type ErrorInfo } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { TextField } from '@mui/material';

    const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz/api';

    interface RegisterResponse {
      message?: string;
      customerId?: number;
      error?: string;
    }

    interface LoginResponse {
      valid: boolean;
      userId?: number;
      email?: string;
      name?: string;
      error?: string;
    }

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
        console.error('Error in Register:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return <div className="text-center text-red-500">Something went wrong. Please try again later.</div>;
        }
        return this.props.children;
      }
    }

    export default function Register() {
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [confirmPassword, setConfirmPassword] = useState('');
      const [name, setName] = useState('');
      const [region, setRegion] = useState('');
      const [address, setAddress] = useState('');
      const [city, setCity] = useState('');
      const [postalCode, setPostalCode] = useState('');
      const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
      const navigate = useNavigate();

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: '', type: 'error' });

        if (!email || !password || !name || !region) {
          setMessage({ text: 'Please fill in all required fields.', type: 'error' });
          return;
        }
        if (password !== confirmPassword) {
          setMessage({ text: 'Passwords do not match.', type: 'error' });
          return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
          setMessage({ text: 'Invalid email format.', type: 'error' });
          return;
        }

        const payload = {
          email,
          password,
          name,
          region,
          address: address || null,
          city: city || null,
          postal_code: postalCode || null,
        };

        try {
          // Register customer
          const registerResponse = await fetch(`${API_URL}/customers/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const registerData: RegisterResponse = await registerResponse.json();

          if (!registerResponse.ok) {
            setMessage({ text: registerData.error || 'Registration failed.', type: 'error' });
            return;
          }

          // Auto-login
          const loginResponse = await fetch(`${API_URL}/customers-login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const loginData: LoginResponse = await loginResponse.json();

          if (loginResponse.ok && loginData.valid) {
            localStorage.setItem('userId', loginData.userId!.toString());
            localStorage.setItem('role', 'customer');
            localStorage.setItem('email', loginData.email!);
            localStorage.setItem('userName', loginData.name!);
            setMessage({ text: 'Registration and login successful!', type: 'success' });
            setTimeout(() => navigate('/customer-dashboard'), 1000);
          } else {
            setMessage({ text: loginData.error || 'Auto-login failed.', type: 'error' });
          }
        } catch (error) {
          console.error('Registration error:', error);
          setMessage({ text: 'Network error. Please try again later.', type: 'error' });
        }
      };

      return (
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Register</h2>
              {message.text && (
                <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                  {message.text}
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Email</label>
                  <TextField
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    required
                    variant="outlined"
                    type="email"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Password</label>
                  <TextField
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    required
                    variant="outlined"
                    type="password"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Confirm Password</label>
                  <TextField
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fullWidth
                    required
                    variant="outlined"
                    type="password"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Name</label>
                  <TextField
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    required
                    variant="outlined"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Region</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                    required
                  >
                    <option value="">Select a region</option>
                    {[
                      'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay',
                      'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
                      'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast',
                    ].map((reg) => (
                      <option key={reg} value={reg}>{reg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Address (optional)</label>
                  <TextField
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">City (optional)</label>
                  <TextField
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-lg mb-2">Postal Code (optional)</label>
                  <TextField
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
                >
                  Register
                </button>
              </form>
              <button
                onClick={() => navigate('/login')}
                className="mt-6 w-full bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                Back to Login
              </button>
            </div>
          </div>
        </ErrorBoundary>
      );
    }