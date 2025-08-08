/**
 * CustomerLogin.tsx - Version V1.0
 * - Located in /frontend/src/pages/
 * - Handles customer login via POST /api/customers-login.php.
 * - Redirects to /customer-dashboard based on redirect field in response.
 * - Styled with dark gradient background, grey inputs, blue gradient buttons, white text.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Container } from '@mui/material';
import { FaSignInAlt } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

interface LoginResponse {
  message?: string;
  userId?: number;
  role?: string;
  redirect?: string;
  error?: string;
}

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/customers-login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data: LoginResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      if (data.error) throw new Error(data.error);

      localStorage.setItem('userId', data.userId?.toString() || '0');
      localStorage.setItem('role', data.role || '');
      setMessage({ text: 'Login successful. Redirecting...', type: 'success' });
      setTimeout(() => {
        navigate(data.redirect || '/customer-dashboard');
      }, 1000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error logging in:', error);
      setMessage({ text: error.message || 'Failed to log in. Please try again.', type: 'error' });
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4, background: 'linear-gradient(to right, #1f2937, #111827)', minHeight: '100vh' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <img src="https://tap4service.co.nz/Tap4Service%20Logo%201.png" alt="Tap4Service Logo" style={{ maxWidth: '150px', marginBottom: '16px' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', mb: 2 }}>
          Customer Login
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
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
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
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              inputProps={{ autoComplete: 'current-password' }}
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
            <Button
              type="submit"
              variant="contained"
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
              <FaSignInAlt style={{ marginRight: '8px' }} />
              Log In
            </Button>
          </Box>
        </form>
      </Box>
    </Container>
  );
}