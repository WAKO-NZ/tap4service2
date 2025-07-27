/**
     * RequestConfirmation.tsx - Version V6.102
     * - Removes page number from top right corner.
     * - Validates date formats before submitting to /api/requests.
     * - Submits request with dates in YYYY-MM-DD HH:mm:ss format.
     * - Retrieves form data from localStorage (pendingRequest).
     * - Adds DELETE request to /api/requests/:id on cancel.
     * - Redirects to /customer-dashboard on success or cancel.
     */
    import { useState } from 'react';
    import { useNavigate } from 'react-router-dom';
    import moment from 'moment-timezone';

    const API_URL = process.env.REACT_APP_API_URL || 'https://tap4service.co.nz/api';

    interface RequestResponse {
      message?: string;
      requestId?: number;
      error?: string;
    }

    export default function RequestConfirmation() {
      const navigate = useNavigate();
      const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'error' });
      const customerId = localStorage.getItem('userId');

      const handleAgree = async () => {
        const pendingRequest = localStorage.getItem('pendingRequest');
        if (!pendingRequest) {
          setMessage({ text: 'No request data found. Please try again.', type: 'error' });
          return;
        }

        const payload = JSON.parse(pendingRequest);
        // Validate date formats
        if (payload.availability_1) {
          const date1 = moment(payload.availability_1, 'YYYY-MM-DD HH:mm:ss', true);
          if (!date1.isValid()) {
            setMessage({ text: 'Invalid availability 1 date format.', type: 'error' });
            return;
          }
          payload.availability_1 = date1.format('YYYY-MM-DD HH:mm:ss');
        }
        if (payload.availability_2) {
          const date2 = moment(payload.availability_2, 'YYYY-MM-DD HH:mm:ss', true);
          if (!date2.isValid()) {
            setMessage({ text: 'Invalid availability 2 date format.', type: 'error' });
            return;
          }
          payload.availability_2 = date2.format('YYYY-MM-DD HH:mm:ss');
        }
        console.log('Submitting request:', payload);

        try {
          const response = await fetch(`${API_URL}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data: RequestResponse = await response.json();
          console.log('Server response:', { status: response.status, error: data.error });
          if (response.ok) {
            setMessage({ text: 'Service request submitted successfully! Payment pending technician acceptance.', type: 'success' });
            localStorage.removeItem('pendingRequest');
            setTimeout(() => navigate('/customer-dashboard'), 1000);
          } else {
            setMessage({ text: `Request failed: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (error) {
          console.error('Request error:', error);
          setMessage({ text: 'Network error. Please try again later.', type: 'error' });
        }
      };

      const handleCancel = async () => {
        const pendingRequest = localStorage.getItem('pendingRequest');
        if (!pendingRequest || !customerId) {
          localStorage.removeItem('pendingRequest');
          navigate('/customer-dashboard');
          return;
        }

        try {
          const payload = JSON.parse(pendingRequest);
          const response = await fetch(`${API_URL}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data: RequestResponse = await response.json();
          if (response.ok && data.requestId) {
            try {
              const cancelResponse = await fetch(`${API_URL}/requests/${data.requestId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: parseInt(customerId) }),
              });
              const cancelData = await cancelResponse.json();
              if (cancelResponse.ok) {
                setMessage({ text: 'Request cancelled successfully.', type: 'success' });
              } else {
                setMessage({ text: `Failed to cancel request: ${cancelData.error || 'Unknown error'}`, type: 'error' });
              }
            } catch (cancelError) {
              console.error('Cancel request error:', cancelError);
              setMessage({ text: 'Network error while cancelling request.', type: 'error' });
            }
          } else {
            setMessage({ text: `Failed to create request: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        } catch (error) {
          console.error('Request error:', error);
          setMessage({ text: 'Network error. Please try again later.', type: 'error' });
        } finally {
          localStorage.removeItem('pendingRequest');
          setTimeout(() => navigate('/customer-dashboard'), 1000);
        }
      };

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-4xl font-bold text-gray-800 mb-10">PAYMENT CONFIRMATION?</h2>
            <h2 className="text-2xl font-bold text-red-600 mb-8">Thank you for requesting our Technical Services! Each callout will cost $99.00 and will only be processed once a Technician has accepted to do the call out.</h2>
            {message.text && (
              <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}
            <p className="text-red-600 mb-8 text-lg">
              Payments are processed based on a callout acceptance. The technician will only be paid once you have confirmed that the callout is completed. This does not mean that the technician can resolve your problem during this callout, as additional material might be required or the system is beyond repair and will require replacement.
            </p>
            <div className="space-y-4">
              <button
                onClick={handleAgree}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                Agree to Payment
              </button>
              <button
                onClick={handleCancel}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                Cancel Request
              </button>
              <a
                href="/terms-and-conditions"
                target="_blank"
                className="block w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
              >
                View Terms and Conditions
              </a>
            </div>
          </div>
        </div>
      );
    }