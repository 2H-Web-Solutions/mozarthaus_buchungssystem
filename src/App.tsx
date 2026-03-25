import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DashboardShell } from './components/DashboardShell';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { Events } from './pages/Events';
import { EventDetails } from './pages/EventDetails';
import { Bookings } from './pages/Bookings';
import { Kanban } from './pages/Kanban';
import { Partners } from './pages/Partners';
import { BookingFlow } from './components/booking/BookingFlow';
import { SyncValidator } from './components/admin/SyncValidator';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardShell />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="new-booking" element={<BookingFlow />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="partners" element={<Partners />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/system-test" element={<SyncValidator />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
