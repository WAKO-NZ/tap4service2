/**
 * App.tsx - Version V1.14
 * - Located in /frontend/src/
 * - Defines routes for the Tap4Service application.
 * - Includes routes for customer and technician dashboards, login, profile editing, and job history.
 * - Added route for /customer-job-history.
 * - Added routes for /technician-login, /customer-login, /forgot-password, /reset-password.
 * - Replaced /request-technician with /log-technical-callout.
 * - Added Material-UI theme with disablePortal for Popper to fix aria-hidden warning.
 * - Added modal state management for accessibility.
 * - Fixed TypeScript error by using boolean inert.
 * - Set isModalOpen to true for landing page and cancellation fee page to prevent inert disabling buttons.
 * - Added route for /cancellation-fee.
 * - Fixed TS2307 error by ensuring CancellationFee.tsx exists and is imported correctly.
 * - Fixed useLocation error by moving BrowserRouter to wrap the entire App component.
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
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
import CancellationFee from './pages/CancellationFee';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' },
    secondary: { main: '#22c55e' },
  },
  components: {
    MuiPopper: {
      defaultProps: {
        disablePortal: true,
      },
    },
    MuiSelect: {
      defaultProps: {
        autoFocus: false,
      },
    },
    MuiTextField: {
      defaultProps: {
        autoFocus: false,
      },
    },
  },
});

function AppContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsModalOpen(location.pathname === '/' || location.pathname === '/cancellation-fee');
  }, [location.pathname]);

  const handleModalToggle = (open: boolean) => {
    if (location.pathname !== '/' && location.pathname !== '/cancellation-fee') {
      setIsModalOpen(open);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <div id="root" {...(isModalOpen ? {} : { inert: true })}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/technician-login" element={<TechnicianLogin />} />
          <Route path="/customer-login" element={<CustomerLogin />} />
          <Route path="/customer-register" element={<CustomerRegister />} />
          <Route path="/technician-register" element={<TechnicianRegister />} />
          <Route path="/customer-dashboard" element={<CustomerDashboard />} />
          <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
          <Route path="/request-confirmation" element={<RequestConfirmation />} />
          <Route path="/log-technical-callout" element={<LogTechnicalCallout onModalToggle={handleModalToggle} />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/customer-edit-profile" element={<CustomerEditProfile />} />
          <Route path="/technician-edit-profile" element={<TechnicianEditProfile />} />
          <Route path="/customer-job-history" element={<CustomerJobHistory />} />
          <Route path="/button-test" element={<ButtonTest />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/cancellation-fee" element={<CancellationFee />} />
          <Route path="*" element={<div className="text-center text-red-500 p-8">404: Page Not Found</div>} />
        </Routes>
      </div>
    </ThemeProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;