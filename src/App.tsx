import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardShell } from './components/DashboardShell';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { Events } from './pages/Events';

import { EventBelegungsplan } from './pages/events/EventBelegungsplan';
import { Bookings } from './pages/Bookings';
import { Kanban } from './pages/Kanban';
import { Partners } from './pages/Partners';
import { PartnerTypes } from './pages/PartnerTypes';
import { Musiker } from './pages/Musiker';
import { MusicianDetail } from './pages/MusicianDetail';
import { Mitarbeiter } from './pages/Mitarbeiter';
import { PricingCategories } from './pages/PricingCategories';
import { HonorarnotePrint } from './pages/events/HonorarnotePrint';
import { BookingFlow } from './components/booking/BookingFlow';
import { SyncValidator } from './components/admin/SyncValidator';
import { Statistics } from './pages/Statistics';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/auth/Login';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Admins } from './pages/auth/Admins';
import { HonorarnotenOverview } from './pages/admin/invoices/HonorarnotenOverview';
import { HonorarnotePrintTemplate } from './pages/admin/invoices/HonorarnotePrintTemplate';
import { PartnerInvoicesOverview } from './pages/admin/invoices/PartnerInvoicesOverview';
import { PartnerInvoicePrintTemplate } from './pages/admin/invoices/PartnerInvoicePrintTemplate';

// Helper component to redirect users based on their role logic
function RoleBasedIndex() {
  const { appUser } = useAuth();
  
  if (appUser?.role === 'musiker') {
    return <Navigate to="/events" replace />;
  }
  if (appUser?.role === 'mitarbeiter') {
    return <Navigate to="/new-booking" replace />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
          <Route index element={<RoleBasedIndex />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="events" element={<Events />} />

          <Route path="events/:eventId/belegungsplan" element={<EventBelegungsplan />} />
          <Route path="new-booking" element={<BookingFlow />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="stammdaten/partner" element={<Partners />} />
          <Route path="stammdaten/partner-types" element={<PartnerTypes />} />
          <Route path="stammdaten/musiker" element={<Musiker />} />
          <Route path="stammdaten/musiker/:id" element={<MusicianDetail />} />
          <Route path="stammdaten/mitarbeiter" element={<Mitarbeiter />} />
          <Route path="stammdaten/pricing" element={<PricingCategories />} />
          <Route path="stammdaten/admin" element={<Admins />} />
          <Route path="invoices/honorarnoten" element={<HonorarnotenOverview />} />
          <Route path="invoices/partner" element={<PartnerInvoicesOverview />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/system-test" element={<SyncValidator />} />
        </Route>
        {/* Print-only routes without Dashboard Shell */}
        <Route path="/events/:eventId/honorarnote/:musikerId" element={<ProtectedRoute><HonorarnotePrint /></ProtectedRoute>} />
        <Route path="/invoices/honorarnoten/print/:year/:month/:musikerId" element={<ProtectedRoute><HonorarnotePrintTemplate /></ProtectedRoute>} />
        <Route path="/invoices/partner/print/:year/:month/:partnerId" element={<ProtectedRoute><PartnerInvoicePrintTemplate /></ProtectedRoute>} />
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
