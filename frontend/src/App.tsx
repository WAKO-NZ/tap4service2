/**
 * App.tsx - Version V1.5
 * - Located in /frontend/src/
 * - Defines routes for the Tap4Service application.
 * - Includes routes for customer and technician dashboards, login, profile editing, and job history.
 * - Added route for /customer-job-history.
 * - Added routes for /technician-login, /customer-login, /forgot-password, /reset-password.
 * - Replaced /request-technician with /log-technical-callout.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerDashboard from './pages/CustomerDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import CustomerEditProfile from './pages/CustomerEditProfile';
import TechnicianEditProfile from './pages/TechnicianEditProfile';
import LogTechnicalCallout from './pages/LogTechnicalCallout';
import CustomerJobHistory from './pages/CustomerJobHistory';
import CustomerLogin from './pages/CustomerLogin';
import TechnicianLogin from './pages/TechnicianLogin';
import CustomerRegister from './pages/CustomerRegister';
import TechnicianRegister from './pages/TechnicianRegister';
import RequestConfirmation from './pages/RequestConfirmation';
import TermsAndConditions from './pages/TermsAndConditions';
import ButtonTest from './pages/ButtonTest';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/technician-login" element={<TechnicianLogin />} />
        <Route path="/customer-login" element={<CustomerLogin />} />
        <Route path="/customer-register" element={<CustomerRegister />} />
        <Route path="/technician-register" element={<TechnicianRegister />} />
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />
        <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
        <Route path="/request-confirmation" element={<RequestConfirmation />} />
        <Route path="/log-technical-callout" element={<LogTechnicalCallout />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/customer-edit-profile" element={<CustomerEditProfile />} />
        <Route path="/technician-edit-profile" element={<TechnicianEditProfile />} />
        <Route path="/customer-job-history" element={<CustomerJobHistory />} />
        <Route path="/button-test" element={<ButtonTest />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<div className="text-center text-red-500 p-8">404: Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;