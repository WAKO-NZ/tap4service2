import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CustomerRegister from './pages/CustomerRegister';
import TechnicianRegister from './pages/TechnicianRegister';
import Login from './pages/Login';
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
        <Route path="/customer-register" element={<CustomerRegister />} />
        <Route path="/technician-register" element={<TechnicianRegister />} />
        <Route path="/login" element={<Login />} />
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />
        <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
        <Route path="/request-confirmation" element={<RequestConfirmation />} />
        <Route path="/request-technician" element={<RequestTechnician />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/customer-edit-profile" element={<CustomerEditProfile />} />
        <Route path="/technician-edit-profile" element={<TechnicianEditProfile />} />
        <Route path="/button-test" element={<ButtonTest />} />
      </Routes>
    </BrowserRouter>
  );
}