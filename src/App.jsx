import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { bindToast } from './lib/toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Tracker from './pages/Tracker';
import Patterns from './pages/Patterns';
import Commitment from './pages/Commitment';
import Ledger from './pages/Ledger';
import Profile from './pages/Profile';
import Questions from './pages/Questions';
import NotesManager from './pages/NotesManager';

/* CodeMirror + markdown engine are heavy — load the note pages on demand */
const NoteEditor = lazy(() => import('./pages/NoteEditor'));
const NoteView = lazy(() => import('./pages/NoteView'));

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-mute)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.2em' }}>LOADING…</span>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading, configured } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (configured && !user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function App() {
  const [t, setT] = useState(null);
  useEffect(() => { bindToast(setT); }, []);
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/hash/:hash" element={<Commitment />} />
        <Route path="/patterns" element={<Protected><Patterns /></Protected>} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/note" element={<Protected><Suspense fallback={<Spinner />}><NoteEditor /></Suspense></Protected>} />
        <Route path="/note/:slug" element={<Suspense fallback={<Spinner />}><NoteView /></Suspense>} />
        <Route path="/notes" element={<Protected><NotesManager /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/file" element={<Protected><Ledger /></Protected>} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/" element={<Protected><Tracker /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <div className={`toast ${t ? 'show' : ''}`} role="status" aria-live="polite"
        dangerouslySetInnerHTML={{ __html: t?.html || '' }} />
    </>
  );
}
