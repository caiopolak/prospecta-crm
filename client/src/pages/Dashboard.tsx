import React from 'react';
import { motion } from 'framer-motion';
import { PageTransition } from '../components/PageTransition';
import { useVoIP } from '../context/VoIPContext';
import { 
  PhoneCall, Users, KanbanSquare, CheckSquare, 
  Target, Calendar, Sparkles, Play, Clock 
} from 'lucide-react';

export default function Dashboard() {
  const { dialNumber, startPowerQueue } = useVoIP();
  const [stats, setStats] = React.useState<any>(null);
  const [priorityLeads, setPriorityLeads] = React.useState<any[]>([]);
  const [recentCalls, setRecentCalls] = React.useState<any[]>([]);
  const [todayTasks, setTodayTasks] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState('');

  const load = () => {
    Promise.all([
      fetch('/api/dashboard/stats').then(r => r.json()),
      fetch('/api/leads/prioritarios').then(r => r.json()),
      fetch('/api/calls').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
    ]).then(([s, l, c, t]) => {
      setStats(s);
      setPriorityLeads(l);
      setRecentCalls(c.slice(0, 6));
      setTodayTasks(t.filter((x: any) => x.status === 'pendente').slice(0, 5));
      setLoadError('');
    }).catch(() => setLoadError('Não foi possível carregar o painel.'));
  };

  React.useEffect(() => {
    load();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
  };

  return (
    <PageTransition>
      <div>
        {/* Header with Motion CTA */}
        <div className="page-header">
          <div className="page-header-info">
            <h1>
              <span>Central de Trabalho</span>
              <span className="badge badge-success">Live HUD</span>
            </h1>
            <p>Cockpit de Cold Calls, Metas de Contato e Prospecção Ativa</p>
          </div>

          <div className="header-actions">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <button 
                className="btn btn-success"
                onClick={() => startPowerQueue(priorityLeads)}
                disabled={priorityLeads.length === 0}
              >
                <Play size={16} />
                <span>Iniciar Sessão de Cold Call</span>
              </button>
            </motion.div>
          </div>
        </div>

        {loadError && (
          <div className="empty-box" role="alert">
            <p>{loadError}</p>
            <button className="btn btn-secondary btn-small" onClick={load}>Tentar novamente</button>
          </div>
        )}

        {/* Staggered KPI Grid */}
        <motion.div variants={container} initial="hidden" animate="show" className="stats-grid">
          <motion.div variants={item} className="stat-card">
            <div className="stat-card-top">
              <span className="label">Total de Ligações</span>
              <div className="stat-icon-pill"><PhoneCall size={16} className="text-emerald" /></div>
            </div>
            <div className="value green">{stats ? stats.totalCalls : '…'}</div>
            <div className="stat-subtext">{stats ? `${stats.connectedCalls} contatos conectados` : '…'}</div>
          </motion.div>

          <motion.div variants={item} className="stat-card">
            <div className="stat-card-top">
              <span className="label">Taxa de Conexão</span>
              <div className="stat-icon-pill"><Target size={16} /></div>
            </div>
            <div className="value blue">{stats ? `${stats.connectRate}%` : '…'}</div>
            <div className="stat-subtext">Meta diária: 35% de conversão</div>
          </motion.div>

          <motion.div variants={item} className="stat-card">
            <div className="stat-card-top">
              <span className="label">Reuniões Agendadas</span>
              <div className="stat-icon-pill"><Calendar size={16} /></div>
            </div>
            <div className="value indigo">{stats ? stats.meetingsBooked : '…'}</div>
            <div className="stat-subtext">Geradas no Power Dialer</div>
          </motion.div>

          <motion.div variants={item} className="stat-card">
            <div className="stat-card-top">
              <span className="label">Pipeline em Jogo</span>
              <div className="stat-icon-pill"><KanbanSquare size={16} /></div>
            </div>
            <div className="value green">{stats ? formatCurrency(stats.pipelineValue) : '…'}</div>
            <div className="stat-subtext">{stats ? `${stats.totalDeals} negócios em negociação` : '…'}</div>
          </motion.div>

          <motion.div variants={item} className="stat-card">
            <div className="stat-card-top">
              <span className="label">Tarefas &amp; Follow-ups</span>
              <div className="stat-icon-pill"><CheckSquare size={16} /></div>
            </div>
            <div className={`value ${stats?.overdueTasks ? 'red' : ''}`}>
              {stats ? stats.pendingTasks : '…'}
            </div>
            <div className="stat-subtext">
              {stats ? (stats.overdueTasks ? `${stats.overdueTasks} atrasadas` : 'Em dia') : '…'}
            </div>
          </motion.div>
        </motion.div>

        {/* Main Grid */}
        <div className="grid-main">
          
          {/* Priority Cold Call Queue */}
          <div className="table-container">
            <div className="table-toolbar">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                  Fila de Discagem Prioritária
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Leads com alta intenção aguardando contato telefônico
                </p>
              </div>
            </div>

            {priorityLeads.length === 0 ? (
              <div className="empty-box">
                <Users size={36} />
                <h4>Nenhum lead pendente</h4>
                <p>Cadastre contatos ou importe um arquivo CSV para abastecer o discador.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Contato / Empresa</th>
                    <th>Telefone</th>
                    <th>Tentativas</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityLeads.map(lead => (
                    <motion.tr key={lead.id} whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <td>
                        <strong>{lead.name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {lead.role || 'Tomador'} &bull; <span style={{ color: 'var(--text-secondary)' }}>{lead.company}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#38BDF8' }}>
                          {lead.phone || 'Sem fone'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {lead.call_count || 0} ligações
                        </span>
                      </td>
                      <td>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="btn-dial-inline"
                          onClick={() => dialNumber(lead.phone, lead)}
                          disabled={!lead.phone}
                        >
                          <PhoneCall size={12} />
                          <span>Discar</span>
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Follow-up Tasks */}
            <div className="table-container" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} className="text-warning" />
                <span>Follow-ups Pendentes</span>
              </h3>

              {todayTasks.length === 0 ? (
                <div className="empty-box">Nenhum follow-up pendente para hoje.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {todayTasks.map((task: any) => (
                    <div key={task.id} className="task-item" style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                      <div className="task-info">
                        <div className="title" style={{ fontSize: 13, color: 'white' }}>{task.title}</div>
                        <div className="meta" style={{ fontSize: 11, marginTop: 3 }}>
                          {task.contact_name && <span>{task.contact_name} &bull; </span>}
                          {task.due_date && <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </div>
                      {task.contact_phone && (
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="btn-dial-inline"
                          onClick={() => dialNumber(task.contact_phone, { name: task.contact_name, phone: task.contact_phone, company: task.company_name })}
                        >
                          <PhoneCall size={12} />
                        </motion.button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Calls Feed */}
            <div className="table-container" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} className="text-cyan" />
                <span>Últimas Chamadas &amp; Desfechos</span>
              </h3>

              {recentCalls.length === 0 ? (
                <div className="empty-box">Nenhuma chamada realizada ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentCalls.map((call: any) => (
                    <div key={call.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13, color: 'white' }}>{call.contact_name || call.phone_number}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {call.company_name || 'Prospecção'} &bull; {call.duration_seconds}s
                        </div>
                      </div>
                      <div>
                        <span className={`badge badge-${call.disposition}`}>
                          {call.disposition?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </PageTransition>
  );
}
