import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';
import { History, Sparkles, PhoneCall, CheckSquare, Plus, Trash2 } from 'lucide-react';
import { useVoIP } from '../context/VoIPContext';

export default function CallHistory() {
  const { dialNumber } = useVoIP();
  const [calls, setCalls] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'calls' | 'tasks'>('calls');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  // New Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTitleForm] = useState({ title: '', priority: 'media', task_type: 'ligacao', due_date: '' });

  const load = async () => {
    try {
      setLoading(true);
      const [cRes, tRes] = await Promise.all([
        fetch('/api/calls').then(r => r.json()),
        fetch('/api/tasks').then(r => r.json()),
      ]);
      setCalls(cRes);
      setTasks(tRes);
      setLoadError('');
    } catch {
      setLoadError('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveTask = async () => {
    if (!taskForm.title) return;
    await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskForm)
    });
    setShowTaskModal(false);
    setTitleForm({ title: '', priority: 'media', task_type: 'ligacao', due_date: '' });
    load();
  };

  const toggleTask = async (task: any) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: newStatus })
    });
    load();
  };

  const removeTask = async (id: number) => {
    if (!window.confirm('Excluir esta tarefa?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Histórico de Chamadas &amp; Tarefas</h1>
          <p>Registro imutável de gravações, transcrições e desfechos de Cold Calls</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>
            <Plus size={16} /> Nova Tarefa
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button 
          className={`btn ${activeTab === 'calls' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('calls')}
        >
          <History size={15} /> Histórico de Chamadas ({calls.length})
        </button>
        <button 
          className={`btn ${activeTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckSquare size={15} /> Tarefas &amp; Follow-ups ({tasks.filter((t: any) => t.status === 'pendente').length})
        </button>
      </div>

      {loading ? (
        <div className="empty-box">Carregando…</div>
      ) : loadError ? (
        <div className="empty-box">
          <p>{loadError}</p>
          <button className="btn btn-secondary btn-small" onClick={load}>Tentar novamente</button>
        </div>
      ) : activeTab === 'calls' ? (
        <div className="table-container">
          {calls.length === 0 ? (
            <div className="empty-box">Nenhuma chamada registrada no sistema.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contato / Empresa</th>
                  <th>Telefone</th>
                  <th>Desfecho</th>
                  <th>Duração</th>
                  <th>Resumo IA</th>
                  <th>Gravação</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ color: 'white' }}>{c.contact_name || 'Desconhecido'}</strong>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.company_name || 'Prospecção'}</div>
                    </td>
                    <td><span style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5 }}>{c.phone_number}</span></td>
                    <td>
                      <span className={`badge badge-${c.disposition}`}>
                        {c.disposition?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{c.duration_seconds}s</td>
                    <td style={{ maxWidth: 300, fontSize: 12.5 }}>
                      {c.ai_summary ? (
                        <span><Sparkles size={12} className="text-cyan" style={{ display: 'inline', marginRight: 4 }} />{c.ai_summary}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{c.notes || 'Sem notas'}</span>
                      )}
                    </td>
                    <td>
                      {c.recording_url ? (
                        <audio
                          controls
                          preload="none"
                          src={c.recording_url}
                          aria-label={`Gravação da chamada com ${c.contact_name || c.phone_number}`}
                          style={{ width: 160, height: 32 }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="table-container">
          {tasks.length === 0 ? (
            <div className="empty-box">Nenhuma tarefa cadastrada.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Prioridade</th>
                  <th>Vencimento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t: any) => (
                  <tr key={t.id}>
                    <td>
                      <button 
                        className={`btn-small ${t.status === 'concluida' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => toggleTask(t)}
                      >
                        {t.status === 'concluida' ? 'Concluída' : 'Pendente'}
                      </button>
                    </td>
                    <td>
                      <strong style={{ color: t.status === 'concluida' ? 'var(--text-muted)' : 'white', textDecoration: t.status === 'concluida' ? 'line-through' : 'none' }}>
                        {t.title}
                      </strong>
                      {t.contact_name && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Contato: {t.contact_name}</div>}
                    </td>
                    <td><span className="badge badge-neutral">{t.task_type || 'ligacao'}</span></td>
                    <td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td>
                    <td>{t.due_date ? new Date(t.due_date).toLocaleString('pt-BR') : 'Sem prazo'}</td>
                    <td>
                      {t.contact_phone && t.status === 'pendente' && (
                        <button 
                          className="btn-dial-inline"
                          style={{ marginRight: 6 }}
                          onClick={() => dialNumber(t.contact_phone, { name: t.contact_name, phone: t.contact_phone, company: t.company_name })}
                        >
                          <PhoneCall size={12} /> Discar
                        </button>
                      )}
                      <button className="btn btn-danger btn-small" onClick={() => removeTask(t.id)} aria-label={`Excluir tarefa: ${t.title}`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="call-task-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="call-task-modal-title">Nova Tarefa / Follow-up</h2>
            <div className="form-group">
              <label htmlFor="call-task-title">Título *</label>
              <input id="call-task-title" value={taskForm.title} onChange={e => setTitleForm({...taskForm, title: e.target.value})} placeholder="Ex: Retornar para envio de proposta" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="call-task-type">Tipo</label>
                <select id="call-task-type" value={taskForm.task_type} onChange={e => setTitleForm({...taskForm, task_type: e.target.value})}>
                  <option value="ligacao">Ligação / Cold Call</option>
                  <option value="reuniao">Reunião de Vendas</option>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="call-task-priority">Prioridade</label>
                <select id="call-task-priority" value={taskForm.priority} onChange={e => setTitleForm({...taskForm, priority: e.target.value})}>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="call-task-due">Data e Hora Limite</label>
              <input id="call-task-due" type="datetime-local" value={taskForm.due_date} onChange={e => setTitleForm({...taskForm, due_date: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTask}>Criar Tarefa</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
