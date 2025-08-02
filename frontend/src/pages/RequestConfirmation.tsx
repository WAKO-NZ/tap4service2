/**
        * RequestConfirmation.tsx - Version V1.2
        * - Loads pending request from localStorage.
        * - Displays details for confirmation.
        * - Submits POST to /api/requests (or alternative if 404 persists).
        * - Clears localStorage on submit/cancel.
        * - Formats dates in DD/MM/YYYY HH:mm:ss (Pacific/Auckland).
        * - Handles errors with messages.
        * - Uses date-fns and date-fns-tz instead of moment-timezone to eliminate hooks.js interference.
        */
       import { useState, useEffect, Component, type ErrorInfo } from 'react';
       import { useNavigate } from 'react-router-dom';
       import { formatInTimeZone } from 'date-fns-tz';

       const API_URL = import.meta.env.VITE_API_URL || 'https://tap4service.co.nz';

       interface PendingRequest {
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
         const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
         const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
         const navigate = useNavigate();
         const customerId = localStorage.getItem('userId');

         useEffect(() => {
           const stored = localStorage.getItem('pendingRequest');
           if (stored) {
             try {
               const parsed = JSON.parse(stored) as PendingRequest;
               if (parsed.customer_id.toString() !== customerId) {
                 throw new Error('Mismatch in customer ID');
               }
               setPendingRequest(parsed);
             } catch (err) {
               setMessage({ text: 'Invalid pending request. Please start over.', type: 'error' });
               localStorage.removeItem('pendingRequest');
               setTimeout(() => navigate('/request-technician'), 2000);
             }
           } else {
             setMessage({ text: 'No pending request found.', type: 'error' });
             setTimeout(() => navigate('/request-technician'), 2000);
           }
         }, [navigate, customerId]);

         const handleConfirm = async () => {
           if (!pendingRequest) return;
           try {
             const response = await fetch(`${API_URL}/api/requests`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(pendingRequest),
             });
             if (response.ok) {
               setMessage({ text: 'Request submitted successfully!', type: 'success' });
               localStorage.removeItem('pendingRequest');
               setTimeout(() => navigate('/customer-dashboard'), 2000);
             } else {
               const data = await response.json();
               setMessage({ text: `Failed to submit: ${data.error || 'Unknown error'}`, type: 'error' });
             }
           } catch (err: unknown) {
             const error = err as Error;
             console.error('Error submitting request:', error);
             setMessage({ text: `Error: ${error.message || 'Network error'}`, type: 'error' });
           }
         };

         const handleCancel = () => {
           localStorage.removeItem('pendingRequest');
           setMessage({ text: 'Request cancelled.', type: 'info' });
           navigate('/request-technician');
         };

         const formatDateTime = (dateStr: string | null): string => {
           if (!dateStr) return 'Not specified';
           try {
             return formatInTimeZone(new Date(dateStr), 'Pacific/Auckland', 'dd/MM/yyyy HH:mm:ss');
           } catch {
             return 'Invalid date';
           }
         };

         if (!pendingRequest) {
           return <div className="text-center text-gray-600">Loading...</div>;
         }

         return (
           <ErrorBoundary>
             <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
               <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                 <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Confirm Request</h2>
                 {message.text && (
                   <p className={`text-center mb-4 ${message.type === 'success' ? 'text-green-500' : message.type === 'info' ? 'text-blue-500' : 'text-red-500'}`}>
                     {message.text}
                   </p>
                 )}
                 <div className="space-y-4 mb-6">
                   <p><strong>Repair Description:</strong> {pendingRequest.repair_description}</p>
                   <p><strong>Availability 1:</strong> {formatDateTime(pendingRequest.availability_1)}</p>
                   <p><strong>Availability 2:</strong> {formatDateTime(pendingRequest.availability_2)}</p>
                   <p><strong>Region:</strong> {pendingRequest.region}</p>
                 </div>
                 <div className="flex space-x-4">
                   <button
                     onClick={handleConfirm}
                     className="flex-1 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition"
                   >
                     Confirm Submit
                   </button>
                   <button
                     onClick={handleCancel}
                     className="flex-1 bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition"
                   >
                     Cancel
                   </button>
                 </div>
                 <button
                   onClick={() => navigate('/customer-dashboard')}
                   className="mt-6 w-full bg-gray-200 text-gray-800 text-xl font-semibold py-4 px-8 rounded-lg hover:bg-gray-300 transition"
                 >
                   Back to Dashboard
                 </button>
               </div>
             </div>
           </ErrorBoundary>
         );
       }