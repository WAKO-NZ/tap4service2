import { useNavigate } from 'react-router-dom';

export default function RequestConfirmation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">8</div>
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-10">PAYMENT CONFIRMATION?</h2>
        <h2 className="text-2xl font-bold text-red-600 mb-8">Thank you for requesting our Technical Services! Each callout will cost $99.00 and will only be processed once a Technician has accepted to do the call out.</h2>
        <p className="text-red-600 mb-8 text-lg">
          Payments are processed based on a callout acceptance. The technician will only be paid once you have confirmed that the callout is completed. This does not mean that the technician can resolve your problem during this callout, as additional material might be required or the system is beyond repair and will require replacement.
        </p>
        <div className="space-y-4">
          <button
            onClick={() => navigate('/request-technician')}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
          >
            Agree to Payment
          </button>
          <button
            onClick={() => navigate('/customer-dashboard')}
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