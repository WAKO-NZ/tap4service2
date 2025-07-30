/**
 * App.tsx - Version V1.1
 * - Added routes for /technician-login and /customer-login.
 * - Removed /login route, replaced with TechnicianLogin and CustomerLogin.
 * - Maintains routes for dashboards, registration, profile editing, and other pages.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TechnicianLogin from './pages/TechnicianLogin';
import CustomerLogin from './pages/CustomerLogin';
import CustomerRegister from './pages/CustomerRegister';
import TechnicianRegister from './pages/TechnicianRegister';
import CustomerDashboard from './pages/CustomerDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import RequestConfirmation from './pages/RequestConfirmation';
import RequestTechnician from './pages/RequestTechnician';
import TermsAndConditions from './pages/TermsAndConditions';
import CustomerEditProfile from './pages/CustomerEditProfile';
import TechnicianEditProfile from './pages/TechnicianEditProfile';
import ButtonTest from './pages/ButtonTest';

export default function App() {
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
        <Route path="/request-technician" element={<RequestTechnician />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/customer-edit-profile" element={<CustomerEditProfile />} />
        <Route path="/technician-edit-profile" element={<TechnicianEditProfile />} />
        <Route path="/button-test" element={<ButtonTest />} />
        <Route path="*" element={<div className="text-center text-red-500 p-8">404: Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}