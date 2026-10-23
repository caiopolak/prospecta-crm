import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { VoIPProvider, useVoIP } from './context/VoIPContext';
import { VoIPStudioModal } from './components/VoIPStudioModal';

// Pages
import Dashboard from './pages/Dashboard';
import ColdCallsQueue from './pages/ColdCallsQueue';
import Companies from './pages/Companies';
import Contacts from './pages/Contacts';
import Pipeline from './pages/Pipeline';
import Tasks from './pages/Tasks';
import Cadences from './pages/Cadences';
import CallHistory from './pages/CallHistory';
import VoIPSettings from './pages/VoIPSettings';

import {
  LayoutDashboard, PhoneCall, Building2, Users, KanbanSquare,
  Workflow, CheckSquare, History, Settings, PhoneForwarded,
  Menu, X, Compass
} from 'lucide-react';
import './App.css';

const NotFound: React.FC = () => (
  <div className="not-found-box">
    <Compass size={48} className="text-muted" />
    <h1>Página não encontrada</h1>
    <p>O endereço acessado não existe ou foi movido.</p>
    <Link to="/" className="btn btn-primary">Voltar para a Central de Trabalho</Link>
  </div>
);

const AppContent: React.FC = () => {
  const { openDialer, callStatus, queueIndex } = useVoIP();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Menu lateral">
        <div className="logo">
          <div className="logo-brand">
            <div className="logo-icon-wrapper">
              <PhoneForwarded size={20} />
            </div>
            <div className="logo-text">
              <h2>Prospecta</h2>
              <span>Cold Call &amp; CRM</span>
            </div>
          </div>
        </div>

        <nav aria-label="Navegação principal" onClick={() => setMenuOpen(false)}>
          <div className="nav-section-title">Central Operacional</div>
          <NavLink to="/" end>
            <LayoutDashboard size={18} />
            <span>Central de Trabalho</span>
          </NavLink>
          <NavLink to="/cold-calls">
            <PhoneCall size={18} />
            <span>Fila &amp; Power Dialer</span>
            {queueIndex >= 0 && <span className="nav-badge">Ao Vivo</span>}
          </NavLink>

          <div className="nav-section-title">Base de Vendas</div>
          <NavLink to="/empresas">
            <Building2 size={18} />
            <span>Empresas</span>
          </NavLink>
          <NavLink to="/contatos">
            <Users size={18} />
            <span>Contatos &amp; Leads</span>
          </NavLink>
          <NavLink to="/pipeline">
            <KanbanSquare size={18} />
            <span>Pipeline de Vendas</span>
          </NavLink>

          <div className="nav-section-title">Engenharia Outbound</div>
          <NavLink to="/cadencias">
            <Workflow size={18} />
            <span>Cadências</span>
          </NavLink>
          <NavLink to="/tarefas">
            <CheckSquare size={18} />
            <span>Tarefas &amp; Follow-ups</span>
          </NavLink>
          <NavLink to="/historico-chamadas">
            <History size={18} />
            <span>Histórico &amp; IA</span>
          </NavLink>
          <NavLink to="/configuracoes-voip">
            <Settings size={18} />
            <span>Configurações VoIP</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-open-dialpad-cta" onClick={openDialer}>
            <PhoneCall size={18} />
            <span>{callStatus === 'connected' ? 'Em Ligação (HUD)' : 'Abrir Discador'}</span>
          </button>
        </div>
      </aside>

      {menuOpen && (
        <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Main View */}
      <main className="main">
        <button
          className="sidebar-toggle"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cold-calls" element={<ColdCallsQueue />} />
            <Route path="/empresas" element={<Companies />} />
            <Route path="/contatos" element={<Contacts />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/cadencias" element={<Cadences />} />
            <Route path="/tarefas" element={<Tasks />} />
            <Route path="/historico-chamadas" element={<CallHistory />} />
            <Route path="/configuracoes-voip" element={<VoIPSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Global VoIP Dialpad & In-Call HUD */}
      <VoIPStudioModal />
    </div>
  );
};

export default function App() {
  return (
    <VoIPProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </VoIPProvider>
  );
}
