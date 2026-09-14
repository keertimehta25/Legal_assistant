import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import ComparePage from './pages/ComparePage';
import ChecklistPage from './pages/ChecklistPage';
import ChatPanel from './components/ChatPanel';

function App() {
  return (
    <SessionProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
          
          <header className="bg-blue-600 text-white shadow-md">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold">LegalLens</h1>
              <nav className="space-x-6">
                <Link to="/" className="hover:text-blue-200 transition">Upload</Link>
                <Link to="/dashboard" className="hover:text-blue-200 transition">Dashboard</Link>
                <Link to="/compare" className="hover:text-blue-200 transition">Compare</Link>
                <Link to="/checklist" className="hover:text-blue-200 transition">Checklist</Link>
              </nav>
            </div>
          </header>

          <main className="flex-grow container mx-auto px-4 py-8 relative">
            <Routes>
              <Route path="/" element={<UploadPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
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
