import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PageTransition } from '../components/PageTransition';
import { Pagination } from '../components/Pagination';
import Checkbox from '../components/Checkbox';
import { useVoIP } from '../context/VoIPContext';
import { PhoneCall, Play, Users, Search, Headphones, Smartphone } from 'lucide-react';

export default function ColdCallsQueue() {
  const { dialNumber, startPowerQueue, callingMode, setCallingMode, networkInfo, queueIndex, callStatus, resumeQueue, toast } = useVoIP();
  const [queue, setQueue] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const loadQueue = () => {
    fetch('/api/calls/queue')
      .then(r => r.json())
      .then(data => {
        setQueue(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const filtered = queue.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    item.phone?.includes(search)
  );

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSel = (id: number) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const pageIds = pageItems.map(i => i.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePageSelected = pageIds.some(id => selected.has(id));
  const toggleAllPage = () => setSelected(prev => {
    const n = new Set(prev);
    if (allPageSelected) pageIds.forEach(id => n.delete(id));
    else pageIds.forEach(id => n.add(id));
    return n;
  });

  const toLead = (item: any) => ({
    id: item.id,
    name: item.name,
    phone: item.phone,
    company: item.company_name,
    company_id: item.company_id,
    role: item.role,
    email: item.email,
    tags: item.tags,
    observations: item.observations
  });

  const dialSelected = () => {
    const leads = queue.filter(i => selected.has(i.id) && i.phone).map(toLead);
    if (leads.length === 0) {
      toast('Nenhum lead selecionado tem telefone.', 'error');
      return;
    }
    startPowerQueue(leads);
  };

  return (
    <PageTransition>
      <div>
        <div className="page-header">
          <div className="page-header-info">
            <h1>
              <span>Fila de Cold Calls &amp; Power Dialer</span>
              {callStatus === 'connected' || callStatus === 'on_hold' ? (
                <span className="badge badge-success">Em Ligação</span>
              ) : queueIndex >= 0 ? (
                <span className="badge badge-success">Sessão Ativa — Lead {queueIndex + 1}</span>
              ) : (
                <span className="badge badge-neutral">Pronto para discar</span>
              )}
            </h1>
            <p>Disquagem automatizada com roteiro dinâmico e detecção de desfechos</p>
          </div>

          <div className="header-actions">
            {/* Quick Calling Mode Switcher */}
            <div className="calling-mode-pill-box" style={{ marginRight: 8 }}>
              <button
                type="button"
                className={`mode-pill ${callingMode === 'pc_voip' ? 'active' : ''}`}
                onClick={() => setCallingMode('pc_voip')}
              >
                <Headphones size={13} />
                <span>PC Headset</span>
              </button>

              <button
                type="button"
                className={`mode-pill ${callingMode === 'mobile_gsm' ? 'active' : ''}`}
                onClick={() => setCallingMode('mobile_gsm')}
              >
                <Smartphone size={13} />
                <span>Celular GSM</span>
                {networkInfo?.isMobileConnected && <span className="wifi-dot connected"></span>}
              </button>
            </div>

            {queueIndex >= 0 && callStatus === 'idle' && (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ marginRight: 8 }}>
                <button className="btn btn-primary" onClick={resumeQueue}>
                  <Play size={16} />
                  <span>Retomar fila (Lead {queueIndex + 1})</span>
                </button>
              </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <button 
                className="btn btn-success glow-pulse"
                onClick={() => startPowerQueue(filtered)}
                disabled={filtered.length === 0}
              >
                <Play size={16} />
                <span>
                  Iniciar Power Dialer ({filtered.length} Leads)
                </span>
              </button>
            </motion.div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={16} className="text-muted" />
              <input 
                type="text" 
                placeholder="Buscar por nome, empresa ou telefone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Total na Fila: <strong>{filtered.length} contatos</strong>
            </div>
          </div>

          {selected.size > 0 && (
            <div
              role="region"
              aria-label="Ações em massa"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 12px', margin: '4px 0 10px', borderRadius: 8, fontSize: 13,
                color: '#6EE7B7', background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.35)'
              }}
            >
              <strong>{selected.size} selecionado(s)</strong>
              <button className="btn btn-primary btn-small" onClick={dialSelected}>
                <Play size={13} /> Iniciar fila com selecionados
              </button>
              <button className="btn btn-secondary btn-small" onClick={() => setSelected(new Set())}>
                Limpar seleção
              </button>
            </div>
          )}

          {loading ? (
            <div className="empty-box">Carregando fila de chamadas...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-box">
              <Users size={36} />
              <h4>Nenhum lead na fila</h4>
              <p>Adicione empresas e contatos com telefones válidos para iniciar a prospecção.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                      <Checkbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected && !allPageSelected}
                        onChange={toggleAllPage}
                        aria-label="Selecionar todos da página"
                      />
                  </th>
                  <th>Contato</th>
                  <th>Empresa</th>
                  <th>Telefone</th>
                  <th>Tentativas Anteriores</th>
                  <th>Último Status</th>
                  <th>Ação Rápida</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(item => (
                  <motion.tr key={item.id} whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <td>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onChange={() => toggleSel(item.id)}
                          aria-label={`Selecionar ${item.name}`}
                        />
                    </td>
                    <td>
                      <strong style={{ color: 'white' }}>{item.name}</strong>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.role || 'Tomador de Decisão'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'white' }}>{item.company_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.company_segment} &bull; {item.city}/{item.state}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#38BDF8' }}>
                        {item.phone}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{item.total_attempts || 0} tentativas</span>
                    </td>
                    <td>
                      {item.last_disposition ? (
                        <span className={`badge badge-${item.last_disposition}`}>
                          {item.last_disposition.replace('_', ' ')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nunca ligado</span>
                      )}
                    </td>
                    <td>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-dial-inline"
                        onClick={() => dialNumber(item.phone, {
                          id: item.id,
                          name: item.name,
                          phone: item.phone,
                          company: item.company_name,
                          company_id: item.company_id,
                          role: item.role,
                          email: item.email,
                          tags: item.tags,
                          observations: item.observations
                        })}
                      >
                        <PhoneCall size={13} />
                        <span>Discar Agora</span>
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && (
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
