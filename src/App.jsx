import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Register from './pages/Register';
import TeamPanel from './pages/TeamPanel';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';

function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '40px',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#00ff87', fontFamily: 'monospace', fontSize: '56px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '4px' }}>
          MarketWars
        </h1>
        <p style={{ color: '#8888aa', fontSize: '18px', margin: 0 }}>
          Хакатон-игра в реальном времени на фондовом рынке
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', width: '100%', maxWidth: '700px' }}>
        {[
          { to: '/register', label: '📋 Регистрация команды', desc: 'Создайте команду для участия', color: '#00ff87' },
          { to: '/dashboard', label: '📊 Дашборд', desc: 'Экран для проектора', color: '#4ecdc4' },
          { to: '/admin', label: '⚙️ Панель администратора', desc: 'Управление игрой', color: '#ffe66d' },
        ].map(({ to, label, desc, color }) => (
          <Link
            key={to}
            to={to}
            style={{
              background: '#12121a',
              border: `1px solid ${color}33`,
              borderRadius: '12px',
              padding: '24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, background 0.2s',
              display: 'block',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = '#1a1a28'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}33`; e.currentTarget.style.background = '#12121a'; }}
          >
            <p style={{ color, fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>{label}</p>
            <p style={{ color: '#8888aa', fontSize: '13px', margin: 0 }}>{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/team/:teamId" element={<TeamPanel />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
