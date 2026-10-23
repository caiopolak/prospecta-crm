import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';

const API = '/api';

interface Task {
  id: number;
  title: string;
  description: string;
  assigned_to: string;
  priority: string;
  status: string;
  due_date: string;
  company_id: number;
  contact_id: number;
  created_at: string;
}

const emptyTask = { title: '', description: '', assigned_to: '', priority: 'media', status: 'pendente', due_date: '', company_id: 0, contact_id: 0 };

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyTask);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/tasks`);
      if (!res.ok) throw new Error('Falha na requisição');
      setTasks(await res.json());
      setLoadError('');
    } catch {
      setLoadError('Não foi possível carregar as tarefas.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyTask); setFormError(''); setShowModal(true); };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({ title: t.title, description: t.description || '', assigned_to: t.assigned_to || '', priority: t.priority, status: t.status, due_date: t.due_date ? t.due_date.substring(0, 16) : '', company_id: t.company_id || 0, contact_id: t.contact_id || 0 });
    setFormError('');
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      setFormError('Informe o título da tarefa para continuar.');
      return;
    }
    setFormError('');
    const body = { ...form, due_date: form.due_date || null, company_id: form.company_id || null, contact_id: form.contact_id || null };
    if (editing) {
      await fetch(`${API}/tasks/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch(`${API}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowModal(false);
    load();
  };

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    await fetch(`${API}/tasks/${task.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: newStatus, due_date: task.due_date || null, company_id: task.company_id || null, contact_id: task.contact_id || null }),
    });
    load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('Excluir esta tarefa?')) return;
    await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    load();
  };

  const filtered = tasks.filter(t => {
    if (filter === 'pendente') return t.status === 'pendente';
    if (filter === 'em_andamento') return t.status === 'em_andamento';
    if (filter === 'concluida') return t.status === 'concluida';
    return true;
  });

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Tarefas</h1>
          <p>Acompanhe pendências, follow-ups e prazos da equipe comercial</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>+ Nova Tarefa</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'pendente', 'em_andamento', 'concluida'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todas' : f === 'pendente' ? 'Pendentes' : f === 'em_andamento' ? 'Em Andamento' : 'Concluidas'}
          </button>
        ))}
      </div>

      <div className="section-card">
        {loading ? (
          <div className="empty-box">Carregando…</div>
        ) : loadError ? (
          <div className="empty-box">
            <p>{loadError}</p>
            <button className="btn btn-secondary btn-small" onClick={load}>Tentar novamente</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">Nenhuma tarefa encontrada.</div>
        ) : (
          filtered.map(task => (
            <div key={task.id} className="task-item">
              <div
                className={`task-check ${task.status === 'concluida' ? 'done' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={task.status === 'concluida' ? `Reabrir tarefa ${task.title}` : `Concluir tarefa ${task.title}`}
                onClick={() => toggleStatus(task)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleStatus(task);
                  }
                }}
              >
                {task.status === 'concluida' ? '\u2713' : ''}
              </div>
              <div className="task-info" style={{ flex: 1 }}>
                <div className={`title ${task.status === 'concluida' ? 'done' : ''}`}>{task.title}</div>
                <div className="meta">
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  {' '}
                  <span className={`badge badge-${task.status}`}>{task.status}</span>
                  {task.due_date && <> • {new Date(task.due_date).toLocaleDateString('pt-BR')}</>}
                  {task.assigned_to && <> • {task.assigned_to}</>}
                </div>
              </div>
              <button className="btn btn-secondary btn-small" onClick={() => openEdit(task)}>Editar</button>
              <button className="btn btn-danger btn-small" onClick={() => remove(task.id)}>Excluir</button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="task-modal-title">{editing ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
            <div className="form-group">
              <label htmlFor="task-title">Titulo *</label>
              <input id="task-title" value={form.title} onChange={e => { setForm({...form, title: e.target.value}); if (formError) setFormError(''); }} />
            </div>
            <div className="form-group">
              <label htmlFor="task-description">Descricao</label>
              <textarea id="task-description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-priority">Prioridade</label>
                <select id="task-priority" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="task-status">Status</label>
                <select id="task-status" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluida">Concluida</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-due">Data Limite</label>
                <input id="task-due" type="datetime-local" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label htmlFor="task-assignee">Responsavel</label>
                <input id="task-assignee" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} />
              </div>
            </div>
            {formError && (
              <div className="form-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 14 }}>{formError}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
