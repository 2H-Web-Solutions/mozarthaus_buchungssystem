import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function DashboardShell() {
  return (
    <div className="min-h-screen bg-brand-main">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="print:hidden">
        <Header />
      </div>
      <main className="pl-64 pt-16 min-h-screen print:pl-0 print:pt-0 print:p-0">
        <div className="p-8 print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
