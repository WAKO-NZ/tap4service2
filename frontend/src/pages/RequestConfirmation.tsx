/**
     * RequestConfirmation.tsx - Version V6.106
     * - Displays service request details from localStorage.
     * - Submits to POST /api/requests on confirmation.
     * - Redirects to /customer-dashboard on success.
     */
    import { useState, useEffect, Component, type ErrorInfo } from 'react';
    import { useNavigate } from 'react-router-dom';
    import moment from 'moment-timezone';

    const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz';

    interface RequestData {
      customer_id: number;
      repair_description: string;
      availability_1: string;
      availability_2: string | null;
      region: string;
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
        console.error('Error in RequestConfirmation:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return <div className="text-center text-red-500">Something went wrong. Please try again later.</div>;
        }
        return this.props.children;
      }
    }

    export default function RequestConfirmation() {
      const [requestData, setRequestData] = useState<RequestData | null>(null);
      const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
      const navigate = useNavigate();
      const customerId = localStorage.getItem('userId');
      const role = localStorage.getItem('role');

      useEffect(() => {
        if (!customerId || role !== 'customer') {
          setMessage({ text: 'Please log in as a customer.', type: 'error' });
          setTimeout(() => navigate('/login'), 1000);
          return;
        }

        const storedData = localStorage.getItem('pendingRequest');
        if (!storedData) {
          setMessage({ text: 'No request data found. Please submit a new request.', type: 'error' });
          setTimeout(() => navigate('/request-technician'), 1000);
          return;
        }

        try {
          const parsedData: RequestData = JSON.parse(storedData);
          if (parsedData.customer_id !== parseInt(customerId!)) {
            setMessage({ text: 'Invalid request data.', type: 'error' });
            localStorage.removeItem('pendingRequest');
            setTimeout(() => navigate('/request-technician'), 1000);
            return;
          }
          setRequestData(parsedData);
        } catch (err) {
          setMessage({ text: 'Error parsing request data.', type: 'error' });
          localStorage.removeItem('pendingRequest');
          setTimeout(() => navigate('/request-technician'), 1000);
        }
      }, [customerId, role, navigate]);

      const handleConfirm = async () => {
        if (!requestData) return;

        console.log('Submitting request:', requestData);

        try {
          const response = await fetch(`${API_URL}/api/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
          });
          const data = await response.json();
          if (response.ok) {
            setMessage({ text: 'Request submitted successfully!', type: 'success' });
            localStorage.removeItem('pendingRequest');
            setTimeout(() => navigate('/customer-dashboard'), 1000);
          } else {
            setMessage({ text: `Failed to submit request: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Request error:', error);
          setMessage({ text: `Network error: ${error.message || 'Please try again later.'}`, type: 'error' });
        }
      };

      const handleCancel = () => {
        localStorage.removeItem('pendingRequest');
        navigate('/request-technician');
      };

      const formatDateTime = (dateStr: string | null): string => {
        if (!dateStr) return 'Not specified';
        return moment.tz(dateStr, 'Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
      };

      if (!requestData) {
        return <div className="text-center text-gray-600">Loading...</div>;
      }

      return (
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Confirm Service Request</h2>
              {message.text && (
                <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                  {message.text}
                </p>
              )}
              <div className="space-y-4">
                <p><strong>Repair Description:</strong> {requestData.repair_description}</p>
                <p><strong>Availability 1:</strong> {formatDateTime(requestData.availability_1)}</p>
                <p><strong>Availability 2:</strong> {formatDateTime(requestData.availability_2)}</p>
                <p><strong>Region:</strong> {requestData.region}</p>
              </div>
              <div className="mt-6 flex space-x-4">
                <button
                  onClick={handleConfirm}
                  className="w-full bg-green-600 text-white text-lg font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                >
                  Confirm Request
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full bg-gray-600 text-white text-lg font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
              <button
                onClick={() => navigate('/request-technician')}
                className="mt-4 w-full bg-gray-200 text-gray-800 text-lg font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Back
              </button>
            </div>
          </div>
        </ErrorBoundary>
      );
    }