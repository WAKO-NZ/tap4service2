import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginResponse {
  message?: string;
  userId?: number;
  name?: string;
  error?: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'technician'>('customer');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Login component mounted');
    return () => console.log('Login component unmounted');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: 'error' });
    setIsSubmitting(true);

    if (!email || !password || !role) {
      setMessage({ text: 'Please fill in all fields.', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    try {
      const endpoint = role === 'customer' ? '/api/customers/login' : '/api/technicians/login';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: LoginResponse = await response.json();
      console.log('Login response:', { status: response.status, data: JSON.stringify(data, null, 2) });

      if (response.ok) {
        if (data.userId && data.name) {
          localStorage.setItem('userId', data.userId.toString());
          localStorage.setItem('role', role);
          localStorage.setItem('userName', data.name);
          setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
          setTimeout(() => {
            navigate(role === 'customer' ? '/customer-dashboard' : '/technician-dashboard');
          }, 2000);
        } else {
          setMessage({ text: 'Invalid response from server.', type: 'error' });
        }
      } else {
        setMessage({ text: data.error || 'Invalid email or password.', type: 'error' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage({ text: 'Network error. Please try again later.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">5</div>
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Login</h2>
        {message.text && (
          <div className={`text-center mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <p>{message.text}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-lg mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'customer' | 'technician')}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
            >
              <option value="customer">Customer</option>
              <option value="technician">Technician</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-lg mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
      <button
        onClick={() => navigate('/')}
        className="mt-6 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
      >
        Back
      </button>
    </div>
  );
}