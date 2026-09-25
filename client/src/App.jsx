import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import SimplifyPage from './pages/SimplifyPage';
import ComparePage from './pages/ComparePage';
import ChecklistPage from './pages/ChecklistPage';
import ChatPanel from './components/ChatPanel';

const NAV_LINKS = [
  { to: '/', label: 'Upload', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/simplify', label: 'Simplify' },
  { to: '/compare', label: 'Compare' },
  { to: '/checklist', label: 'Checklist' },
];

function App() {
  return (
    <SessionProvider>
      <Router>
        {/* Skip link: lets keyboard/screen-reader users jump past the nav straight to content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-blue-700 focus:px-4 focus:py-2 focus:rounded focus:shadow-lg"
        >
          Skip to main content
        </a>

        <div className="min-h-screen flex flex-col bg-slate-50 font-sans">

          <header className="bg-blue-600 text-white shadow-md">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold">LegalLens</h1>
              <nav className="space-x-6" aria-label="Main navigation">
                {NAV_LINKS.map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `hover:text-blue-200 transition ${isActive ? 'font-semibold underline underline-offset-4' : ''}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-grow container mx-auto px-4 py-8 relative">
            <Routes>
              <Route path="/" element={<UploadPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/simplify" element={<SimplifyPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/checklist" element={<ChecklistPage />} />
            </Routes>
          </main>

          {/* Persistent Chat Sidebar */}
          <ChatPanel />

          <footer className="bg-slate-800 text-slate-300 py-4 mt-auto">
            <div className="container mx-auto text-center px-4">
              <p className="text-sm border-t border-slate-600 pt-4">
                <strong>Disclaimer:</strong> LegalLens provides general information only and is not a substitute for advice from a licensed attorney.
              </p>
            </div>
          </footer>
        </div>
      </Router>
    </SessionProvider>
  );
}

export default App;
