/**
 * CustomerEditProfile.tsx - Version V1.1
 * - Located in /frontend/src/pages/
 * - Allows customers to edit their profile details in customers and customer_details tables.
 * - Optionally allows changing the password with confirmation.
 * - Submits updates to /api/customer-update-profile.php.
 * - Fetches profile from /api/customer-profile.php.
 * - Styled to match TechnicianEditProfile.tsx with dark gradient background and blue gradient buttons.
 * - Includes error handling for API fetch with specific 403/500 messages.
 * - Uses autocomplete attributes for accessibility.
 * - Email is read-only to avoid validation conflicts.
 * - Added suburb field and rearranged fields in logical order in V1.1.
 */
import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, TextField, Typography, Container } from '@mui/material';
import { FaUserEdit, FaArrowLeft } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface ProfileData {
  id: number;
  email: string;
  name: string;
  surname: string;
  address: string | null;
  suburb: string | null;
  city: string | null;
  postal_code: string | null;
  phone_number: string | null;
  alternate_phone_number: string | null;
}

interface UpdateResponse {
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
    console.error('Error in CustomerEditProfile:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-[#ff0000] p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline" style={{ color: '#3b82f6' }}>
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => window.location.reload()}
              sx={{
                background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                color: '#ffffff',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '12px 24px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
              }}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CustomerEditProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>({
    id: parseInt(localStorage.getItem('userId') || '0'),
    email: '',
    name: '',
    surname: '',
    address: '',
    suburb: '',
    city: '',
    postal_code: '',
    phone_number: '',
    alternate_phone_number: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
  const customerId = parseInt(localStorage.getItem('userId') || '0', 10);

  useEffect(() => {
    if (!customerId || isNaN(customerId) || localStorage.getItem('role') !== 'customer') {
      setMessage({ text: 'Please log in as a customer.', type: 'error' });
      navigate('/customer-login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/customer-profile.php?customerId=${customerId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log('Fetched profile data:', data);
        setProfile({
          id: data.id || customerId,
          email: data.email || '',
          name: data.name || '',
          surname: data.surname || '',
          address: data.address || '',
          suburb: data.suburb || '',
          city: data.city || '',
          postal_code: data.postal_code || '',
          phone_number: data.phone_number || '',
          alternate_phone_number: data.alternate_phone_number || '',
        });
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Error fetching profile:', error);
        setMessage({ text: error.message || 'Failed to fetch profile data.', type: 'error' });
      }
    };

    fetchProfile();
  }, [navigate, customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    try {
      const payload = {
        customer_id: customerId,
        name: profile.name,
        surname: profile.surname,
        address: profile.address,
        suburb: profile.suburb,
        city: profile.city,
        postal_code: profile.postal_code,
        phone_number: profile.phone_number,
        alternate_phone_number: profile.alternate_phone_number,
        ...(newPassword && { password: newPassword }),
      };
      console.log('Submitting profile update:', payload);

      const response = await fetch(`${API_URL}/api/customer-update-profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data: UpdateResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      if (data.error) throw new Error(data.error);

      setMessage({ text: 'Profile updated successfully.', type: 'success' });
      setTimeout(() => navigate('/customer-dashboard'), 1000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error updating profile:', error);
      setMessage({ text: error.message || 'Failed to update profile.', type: 'error' });
    }
  };

  const handleButtonClick = () => {
    // Optional: Add animation or feedback for button click
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="sm" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', mb: 2 }}>
            Edit Profile
          </Typography>
        </Box>

        {message.text && (
          <Typography sx={{ textAlign: 'center', mb: 2, color: message.type === 'success' ? '#00ff00' : '#ff0000' }}>
            {message.text}
          </Typography>
        )}

        <Box sx={{ backgroundColor: '#374151', p: 3, borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)' }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="First Name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                fullWidth
                required
                inputProps={{ autoComplete: 'given-name' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Surname"
                value={profile.surname}
                onChange={(e) => setProfile({ ...profile, surname: e.target.value })}
                fullWidth
                required
                inputProps={{ autoComplete: 'family-name' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Email"
                value={profile.email}
                disabled
                fullWidth
                inputProps={{ autoComplete: 'email' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Address"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                fullWidth
                inputProps={{ autoComplete: 'street-address' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Suburb"
                value={profile.suburb || ''}
                onChange={(e) => setProfile({ ...profile, suburb: e.target.value })}
                fullWidth
                inputProps={{ autoComplete: 'address-level3' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="City"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                fullWidth
                inputProps={{ autoComplete: 'address-level2' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Postal Code"
                value={profile.postal_code || ''}
                onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
                fullWidth
                inputProps={{ autoComplete: 'postal-code' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Phone Number"
                value={profile.phone_number || ''}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                fullWidth
                inputProps={{ autoComplete: 'tel' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Alternate Phone Number"
                value={profile.alternate_phone_number || ''}
                onChange={(e) => setProfile({ ...profile, alternate_phone_number: e.target.value })}
                fullWidth
                inputProps={{ autoComplete: 'tel' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                inputProps={{ autoComplete: 'new-password' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
              <TextField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                inputProps={{ autoComplete: 'new-password' }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#ffffff' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#ffffff' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    '& input': { color: '#ffffff' }
                  },
                  '& .MuiInputBase-root': { backgroundColor: '#1f2937', borderRadius: '8px' }
                }}
              />
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
                    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                  }}
                  onClick={handleButtonClick}
                >
                  <FaUserEdit style={{ marginRight: '8px' }} />
                  Update Profile
                </Button>
                <Button
                  variant="contained"
                  component={Link}
                  to="/customer-dashboard"
                  sx={{
                    flex: 1,
                    background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    borderRadius: '24px',
                    padding: '12px 24px',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(255, 255, 255, 0.5)' }
                  }}
                >
                  <FaArrowLeft style={{ marginRight: '8px' }} />
                  Back to Dashboard
                </Button>
              </Box>
            </Box>
          </form>
        </Box>
      </Container>
    </ErrorBoundary>
  );
}