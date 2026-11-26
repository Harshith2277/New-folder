import React, { useState } from 'react';
import { LogOut, Scale, UserCheck, ShieldCheck } from 'lucide-react';
import CitizenDashboard from './components/CitizenDashboard';
import OfficerDashboard from './components/OfficerDashboard';
import LoginPage from './components/LoginPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  if (!currentUser) {
    return <LoginPage onLogin={(userData) => setCurrentUser(userData)} />;
  }

  const isCitizen = currentUser.role === 'citizen';
  const displayName =
    currentUser.user?.full_name ||
    currentUser.user?.citizenName ||
    currentUser.user?.officerName ||
    currentUser.user?.username ||
    '—';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: isCitizen ? '#f8fafc' : '#0f1117' }}>
      {/* ── Navbar ── */}
      <nav className="ss-nav">
        <div className="ss-nav-brand">
          <div className="ss-nav-logo">
            <Scale size={20} color="#fff" />
          </div>
          <span className="ss-nav-title">SchemeSaathi</span>
          <span className={`ss-nav-badge ${isCitizen ? '' : 'officer'}`}>
            {isCitizen ? 'Citizen Portal' : 'Officer Admin'}
          </span>
        </div>

        <div className="ss-nav-right">
          <div className="ss-user-pill">
            <div className={`ss-user-avatar ${isCitizen ? '' : 'officer'}`}>{initials}</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="ss-user-name">{displayName}</span>
              <span className="ss-user-role" style={{ color: isCitizen ? '#86efac' : '#a5b4fc', fontSize: '10px' }}>
                {isCitizen ? currentUser.user?.state || 'Citizen' : 'Officer Admin'}
              </span>
            </div>
          </div>
          <button
            className="ss-btn-logout"
            onClick={() => {
              localStorage.removeItem('schemesaathi_token');
              setCurrentUser(null);
            }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ flex: 1 }}>
        {isCitizen ? (
          <CitizenDashboard initialProfile={currentUser.user} />
        ) : (
          <OfficerDashboard initialOfficer={currentUser.user} />
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          background: isCitizen ? '#fff' : '#0f1117',
          borderTop: `1px solid ${isCitizen ? '#e8eaf0' : 'rgba(255,255,255,0.07)'}`,
          padding: '12px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: isCitizen ? '#94a3b8' : '#475569',
        }}
      >
        SchemeSaathi © {new Date().getFullYear()} · Transparent, Explainable Welfare Governance · Verified Indian Government Feeds
      </footer>
    </div>
  );
}
